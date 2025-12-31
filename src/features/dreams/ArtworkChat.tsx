import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  Avatar,
  Collapse,
  Card,
  CardActionArea,
  CardContent,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Snackbar,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RefreshIcon from '@mui/icons-material/Refresh';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FeedIcon from '@mui/icons-material/Feed';
import { useSnackbar as useNotistackSnackbar } from 'notistack';

import {
  getDream,
  getArtChat,
  appendArtChat,
  clearArtChat,
  analyzeDream,
  toggleArtworkInsight,
  interpretFinal,
  interpretBlockArt,
  API_URL,
  getRollingSummary,
} from '../../utils/api';

import { GlassInputBox } from '../profile/GlassInputBox';
import { MoonButton } from './MoonButton';

import { useProfile } from 'src/features/profile/ProfileContext';
import { AVATAR_OPTIONS } from 'src/features/profile/ProfileEditForm';

type Role = 'user' | 'assistant';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  role: Role;
  timestamp: number;
  meta?: { kind?: string; insightArtworksLiked?: boolean } | null;
  insightArtworksLiked?: boolean;
}

const MAX_TURNS = 8;
const TARGET_PAIRS_FOR_INTERPRET = 7;
const HEADER_BASE = 56;

const toTimestamp = (raw: any) => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
};

const getPairsCount = (msgs: Message[]) => {
  let count = 0;
  for (let i = 0; i < msgs.length - 1; i++) {
    if (msgs[i].sender === 'user' && msgs[i + 1].sender === 'assistant') {
      count++;
    }
  }
  return count;
};

export const ArtworkChat: React.FC = () => {
  const { id, artworkIdx } = useParams<{ id: string; artworkIdx?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useNotistackSnackbar();

  const { profile, getIconComponent } = useProfile();

  const userAvatarIcon = profile?.avatarIcon ?? null;
  const userAvatarSrc = profile?.avatarImage ?? undefined;
  const UserAvatarIcon = getIconComponent(userAvatarIcon);

  type AvatarOption = (typeof AVATAR_OPTIONS)[number];

  const userAvatarBgColor =
    AVATAR_OPTIONS.find((o: AvatarOption) => o.icon === userAvatarIcon)?.color ??
    '#f0f0f0';

  const [dream, setDream] = useState<any | null>(null);
  const [artwork, setArtwork] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rollingSummary, setRollingSummary] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [generatingInterpretation, setGeneratingInterpretation] =
    useState(false);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [finalInterpretationText, setFinalInterpretationText] =
    useState('');
  const [loadingFinalInterpretation, setLoadingFinalInterpretation] =
    useState(false);
  const [refreshingFinal, setRefreshingFinal] = useState(false);

  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // kickoff guards
  const kickoffDoneRef = useRef<string | null>(null);
  const kickoffInProgressRef = useRef<boolean>(false);

  // 🔐 защита от гонок: актуальный ключ чата
  const latestChatKeyRef = useRef<string | null>(null);

  // ✅ безопасно читаем state из навигации
  const rawState = location.state as any | null | undefined;
  const stateAny = (rawState && typeof rawState === 'object') ? rawState : {};
  const stateArtworkIndex = stateAny.artworkIndex as number | undefined;
  const artworkIdFromState: string | undefined = stateAny.artworkId;

  // ✅ индекс текущего арта
  const currentIdx = useMemo(() => {
    if (typeof stateArtworkIndex === 'number') {
      return stateArtworkIndex;
    }
    const idx = Number(artworkIdx ?? 0);
    return Number.isNaN(idx) ? 0 : idx;
  }, [artworkIdx, stateArtworkIndex]);

  // ✅ blockId (для бэкенда/сводок)
  const blockId = useMemo(
    () => `artwork__${currentIdx}`,
    [currentIdx]
  );

  // ✅ artDialogId (для UI/логики фронта)
const artDialogId = useMemo(
  () => (id ? `${id}__art__${currentIdx}` : ''),
  [id, currentIdx]
);

// ✅ dreamId (чистый UUID для бэкенда)
const dreamId = id ?? '';

 const artworkId = useMemo(() => {
  if (artworkIdFromState) {
    console.log("🔑 [ARTWORK_ID] from state:", artworkIdFromState);
    return artworkIdFromState;
  }
  if (artwork && typeof artwork === 'object') {
    const keys = Object.keys(artwork);
    const resolved = 
      artwork.artworkId ??
      artwork.artwork_id ??
      artwork.id ??
      artwork._id ??
      artwork.uniqueId ??
      undefined;
    
    console.log("🔑 [ARTWORK_ID] from artwork object", { 
      keys, 
      resolved,
      artworkId: artwork.artworkId,
      artwork_id: artwork.artwork_id,
      id: artwork.id,
      _id: artwork._id,
      uniqueId: artwork.uniqueId
    });
    
    return resolved;
  }
  console.log("🔑 [ARTWORK_ID] undefined (no artwork)");
  return undefined;
}, [artworkIdFromState, artwork]);

// сбрасываем состояние kickoff при смене произведения / artworkId
useEffect(() => {
  kickoffDoneRef.current = null;
  kickoffInProgressRef.current = false;
}, [currentIdx, artworkId]);

  // подсказки для луны
  const [interpretHintShown, setInterpretHintShown] = useState(false);
  const [interpretSnackbarOpen, setInterpretSnackbarOpen] = useState(false);
  const [interpretSnackbarMessage, setInterpretSnackbarMessage] =
    useState('');
  const [interpretSnackbarSeverity, setInterpretSnackbarSeverity] =
    useState<'success' | 'error'>('success');

  const showInterpretSnackbar = (
    message: string,
    severity: 'success' | 'error' = 'success',
  ) => {
    setInterpretSnackbarMessage(message);
    setInterpretSnackbarSeverity(severity);
    setInterpretSnackbarOpen(true);
  };

  const accentColor = 'rgba(88, 120, 255, 0.85)';
  const glassBackground = 'rgba(255, 255, 255, 0.1)';
  const glassBorder = 'rgba(255, 255, 255, 0.18)';
  const assistantAvatarUrl = '/logo.png';

  const renderAssistantAvatar = useCallback(
    (variant: 'default' | 'interpretation' = 'default') => (
      <Avatar
        src={assistantAvatarUrl}
        alt="Assistant"
        sx={{
          width: 36,
          height: 36,
          bgcolor: assistantAvatarUrl
            ? 'rgba(255,255,255,0.08)'
            : variant === 'interpretation'
            ? 'rgba(139,92,246,0.85)'
            : 'rgba(255,255,255,0.3)',
          border: `1px solid ${glassBorder}`,
          boxShadow: assistantAvatarUrl
            ? '0 6px 18px rgba(24,32,80,0.35)'
            : 'none',
          '& img': { objectFit: 'cover' },
        }}
      >
        {!assistantAvatarUrl && <SmartToyIcon />}
      </Avatar>
    ),
    [assistantAvatarUrl],
  );

 // загружаем сон + произведение
  useEffect(() => {
  (async () => {
    console.log("📦 [DREAM LOAD] start", { id, currentIdx });
    setLoading(true);
    setError(null);
    try {
      if (!id) {
        setError('ID не указан');
        return;
      }

      // 1. Сначала пробуем взять artwork из location.state — это синхронно
      const stateAny = (location.state as any) ?? {};
      const stateArtwork = stateAny.artwork;
      const stateIdx =
        typeof stateAny.artworkIndex === 'number'
          ? stateAny.artworkIndex
          : undefined;

      console.log("📦 [DREAM LOAD] state", { stateArtwork: !!stateArtwork, stateIdx, currentIdx });

      if (
  stateArtwork &&
  (stateIdx === undefined ||
    stateIdx === currentIdx ||
    Number(stateIdx) === currentIdx)
) {
  console.log("📦 [DREAM LOAD] setting artwork from state");

  // ✅ Убедимся, что artworkId — это UUID
  const resolvedArtworkId = 
    stateArtwork.artworkId ?? 
    stateArtwork.artwork_id ?? 
    stateArtwork.id ?? 
    stateArtwork._id ?? 
    stateArtwork.uniqueId;

  setArtwork({
    ...stateArtwork,
    artworkId: resolvedArtworkId,
  });
}

      // 2. Затем уже грузим сон и, если нужно, доуточняем artwork из similarArtworks
      const d = await getDream(id);
      if (!d) {
        setError('Сон не найден');
        return;
      }
      console.log("📦 [DREAM LOAD] dream loaded, similarArtworks count:", d?.similarArtworks?.length ?? 0);
      setDream(d);

      if (
  !stateArtwork && // если из state не поставили,
  d?.similarArtworks &&
  Array.isArray(d.similarArtworks)
) {
  const candidate = d.similarArtworks[currentIdx];
  console.log("🖼️ [ARTWORK CANDIDATE]", { 
    currentIdx, 
    candidate,
    keys: candidate ? Object.keys(candidate) : [],
  });

  // ✅ Исправляем artworkId на реальный UUID
  if (candidate) {
    const resolvedArtworkId = 
      candidate.artworkId ?? 
      candidate.artwork_id ?? 
      candidate.id ?? 
      candidate._id ?? 
      candidate.uniqueId;
    
    setArtwork({
      ...candidate,
      artworkId: resolvedArtworkId,
    });
  } else {
    setArtwork(null);
  }
}

      if (d?.globalFinalInterpretation) {
        setFinalInterpretationText(d.globalFinalInterpretation);
      }
    } catch (e: any) {
      console.error("📦 [DREAM LOAD] error", e);
      setError(e?.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
      console.log("📦 [DREAM LOAD] done");
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [id, currentIdx, location.state]);


// 🔄 МГНОВЕННЫЙ СБРОС ЧАТА ПРИ СМЕНЕ ПРОИЗВЕДЕНИЯ
  useEffect(() => {
    if (!artDialogId || !blockId) return;

    console.log('[CHAT RESET] switching artwork, clearing local messages', {
      artDialogId,
      blockId,
      artworkId,
    });

    // Убираем старые сообщения, чтобы не мигали в новом арте
    setMessages([]);
    setError(null);
    setHighlightedMessageId(null);
    // messagesLoading и sendingReply трогать не обязательно —
    // их выставит useEffect загрузки/отправки
  }, [artDialogId, blockId, artworkId]);



// ✅ ЕДИНСТВЕННЫЙ useEffect для загрузки истории + kickoff (защищённый)
useEffect(() => {
  let isCancelled = false;

  (async () => {
    const hasArtwork = Boolean(artwork);

    // ✅ формируем уникальный ключ текущего чата
    const chatKey = `${dreamId}::${blockId}::${artworkId}`;
    latestChatKeyRef.current = chatKey;

    console.log('🔄 [CHAT USE_EFFECT TRIGGERED]', {
      artDialogId,
      blockId,
      artworkId,
      hasArtwork,
      dreamId,
      chatKey,
    });

    if (!artDialogId || !blockId || !artwork || !dreamId || !artworkId) {
      console.log('[CHAT LOAD] missing deps (waiting)');
      return;
    }

    setMessagesLoading(true);
    setError(null);

    try {
      // ✅ ЗАГРУЖАЕМ ROLLING SUMMARY
// ✅ ЗАГРУЖАЕМ ROLLING SUMMARY
try {
  const summaryData = await getRollingSummary(dreamId, blockId, artworkId);
  if (!isCancelled && summaryData) {
    setRollingSummary(summaryData.summary ?? null);
  }
} catch (e) {
  console.warn('[SUMMARY LOAD] Non-critical error:', e);
}

      // ✅ ЗАГРУЖАЕМ СООБЩЕНИЯ
      const resp = await getArtChat(dreamId, blockId, artworkId);
      const rawMsgs = resp?.messages ?? [];

      // ✅ проверяем, актуален ли ещё этот чат
      if (latestChatKeyRef.current !== chatKey) {
        console.log('[CHAT LOAD] stale response, ignoring', { chatKey });
        return;
      }

      if (isCancelled) return;

      const msgs: Message[] = rawMsgs.map((m: any) => ({
        id: m.id,
        text: m.content,
        sender: m.role === 'user' ? 'user' : 'assistant',
        role: (m.role as Role) || (m.role === 'user' ? 'user' : 'assistant'),
        timestamp: toTimestamp(m.created_at ?? Date.now()),
        meta: m.meta ?? null,
        insightArtworksLiked: Boolean(m.meta?.insightArtworksLiked),
      }));

      const shouldRunKickoff =
        msgs.length === 0 && !kickoffInProgressRef.current;

      if (!shouldRunKickoff) {
        console.log('[CHAT LOAD] showing existing messages', msgs.length);
        setMessages(msgs);
        return;
      }

      kickoffInProgressRef.current = true;
      setSendingReply(true);

      try {
        const kickoffPrompt =
          'Сформулируй первый вопрос для обсуждения этого произведения в контексте сна пользователя. ' +
          'Тон: тёплый, поддерживающий, без преамбулы, без списков. Коротко (1–2 предложения). ' +
          'Используй детали описания произведения и сна.';

        const blockText = JSON.stringify(artwork, null, 2);

        const ai = await analyzeDream(
          blockText,
          [],
          kickoffPrompt,
          dreamId,
          blockId,
          dream?.dreamSummary ?? null,
          dream?.autoSummary ?? null,
          artworkId,
        );

        const assistantText =
          ai?.choices?.[0]?.message?.content ||
          'Что в этом произведении кажется вам наиболее созвучным вашему сну?';

        const saved = await appendArtChat({
          dreamId,
          blockId,
          artworkId,
          role: 'assistant',
          content: assistantText,
        });

        // ✅ Логируем результат
        console.log('[kickoff] Kickoff message saved:', saved);

        // ✅ снова проверяем актуальность
        if (latestChatKeyRef.current !== chatKey) {
          console.log('[CHAT LOAD] stale kickoff response, ignoring', { chatKey });
          return;
        }

        if (isCancelled) return;

        const finalMsgs: Message[] = [
          ...msgs,
          {
            id: saved.id,
            text: saved.content,
            sender: 'assistant',
            role: 'assistant',
            timestamp: toTimestamp(saved.createdAt ?? Date.now()),
            meta: saved.meta ?? null,
            insightArtworksLiked: Boolean(saved.meta?.insightArtworksLiked),
          },
        ];

        setMessages(finalMsgs);
      } catch (e: any) {
        if (!isCancelled) {
          setError(e?.message || 'Не удалось начать диалог');
        }
      } finally {
        kickoffInProgressRef.current = false;
        setSendingReply(false);
      }
    } catch (e: any) {
      if (!isCancelled) {
        setError(e?.message || 'Ошибка загрузки чата');
      }
    } finally {
      if (!isCancelled) {
        setMessagesLoading(false);
      }
    }
  })();

  return () => {
    isCancelled = true;
  };
}, [
  artDialogId,
  blockId,
  artwork,
  artworkId,
  dreamId,
  dream?.dreamSummary,
  dream?.autoSummary,
]);
  // messageId из query/state
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const messageIdFromQuery = searchParams.get('messageId') || undefined;
  const messageIdFromState = (location.state as any)?.highlightMessageId || undefined;
  const requestedMessageId = messageIdFromQuery ?? messageIdFromState;

  useEffect(() => {
    const run = async () => {
      const targetMessageId = requestedMessageId;
      if (!targetMessageId) return;
      if (messages.length === 0) return;

      const messageElement = messageRefs.current[targetMessageId];
      if (messageElement) {
        messageElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        setHighlightedMessageId(targetMessageId);
        if (highlightTimeoutRef.current)
          window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = window.setTimeout(() => {
          setHighlightedMessageId(null);
          highlightTimeoutRef.current = null;
        }, 4000);
        return;
      }

      // ищем в других произведениях
      if (!dream?.similarArtworks || !Array.isArray(dream.similarArtworks) || !id) {
        enqueueSnackbar('Сообщение не найдено в этом блоке', {
          variant: 'warning',
        });
        return;
      }

      enqueueSnackbar('Ищу сообщение в других похожих произведениях...', {
        variant: 'info',
      });

      const total = dream.similarArtworks.length;
      for (let i = 0; i < total; i++) {
        const otherBlockId = `artwork__${i}`;
if (otherBlockId === blockId) continue;

if (!id) continue;

const otherArtwork = dream.similarArtworks?.[i];
const otherArtworkId = otherArtwork?.artworkId;

try {
  const resp = await getArtChat(id, otherBlockId, otherArtworkId);
  const msgs = resp.messages || [];
  const found = msgs.find(
    (m: any) => String(m.id) === String(targetMessageId),
  );
  if (found) {
    navigate(
      `/dreams/${id}/artwork-chat/${i}?messageId=${encodeURIComponent(
        targetMessageId,
      )}`,
      {
        state: {
          highlightMessageId: targetMessageId,
          artwork: otherArtwork,
          artworkId: otherArtworkId,  // ✅ передаём artworkId
          artworkIndex: i,
          origin: 'insights',
        },
      },
    );
    enqueueSnackbar('Сообщение найдено — перенаправляю', {
      variant: 'success',
    });
    return;
  }
} catch (err: any) {
  console.warn('Ошибка при поиске в блоке', otherBlockId, err);
}
      }

      enqueueSnackbar('Сообщение не найдено в похожих произведениях', {
        variant: 'warning',
      });
    };

    run();

    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [messages, requestedMessageId, dream, blockId, id, navigate, enqueueSnackbar]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // сбрасываем подсказку про луну при смене произведения
  useEffect(() => {
    setInterpretHintShown(false);
  }, [id, blockId]);

  const pairs = getPairsCount(messages);
  const illumination = Math.max(
    0,
    Math.min(pairs / TARGET_PAIRS_FOR_INTERPRET, 1),
  );
  const canBlockInterpret = pairs >= TARGET_PAIRS_FOR_INTERPRET;

  // подсказка, когда луна заполнилась
  useEffect(() => {
    if (interpretHintShown) return;
    if (pairs >= TARGET_PAIRS_FOR_INTERPRET) {
      showInterpretSnackbar(
        'Луна полностью наполнилась — можно открыть интерпретацию этого произведения 🌙',
        'success',
      );
      setInterpretHintShown(true);
    }
  }, [pairs, interpretHintShown]);

  const runInterpretation = async () => {
  if (!artDialogId || !blockId || !artwork) return;

  if (pairs < TARGET_PAIRS_FOR_INTERPRET) {
    showInterpretSnackbar(
      'Луна ещё наполняется — продолжите диалог, чтобы открыть интерпретацию произведения 🌙',
      'success',
    );
    return;
  }

  if (sendingReply || generatingInterpretation) return;

  setGeneratingInterpretation(true);
  setSendingReply(true);

  try {
    if (!artworkId) {
  enqueueSnackbar('Не удалось определить ID произведения', { variant: 'error' });
  return;
}

const result = await interpretBlockArt(
  dreamId,
  blockId,
  artworkId,
);

    const assistantText = result.interpretation || 'Вот интерпретация произведения...';

    // Получаем обновлённую историю
    const resp = await getArtChat(dreamId, blockId, artworkId);
    const lastMsg = resp.messages?.[resp.messages.length - 1];

    if (lastMsg && lastMsg.meta?.kind === 'art_block_interpretation') {
      setMessages((prev) => [
        ...prev,
        {
          id: lastMsg.id,
          text: lastMsg.content,
          sender: 'assistant',
          role: 'assistant',
          timestamp: toTimestamp(lastMsg.createdAt),
          meta: lastMsg.meta ?? { kind: 'art_block_interpretation' },
          insightArtworksLiked: Boolean(lastMsg.meta?.insightArtworksLiked),
        },
      ]);
    }
  } catch (e: any) {
    enqueueSnackbar(
      e?.message ?? 'Не удалось сгенерировать интерпретацию',
      { variant: 'error' },
    );
  } finally {
    setGeneratingInterpretation(false);
    setSendingReply(false);
  }
};

  const handleSend = async (forcedText?: string) => {
  if ((!input.trim() && !forcedText) || !artDialogId || !blockId || !artwork) return;
  const textToSend = (forcedText ?? input).trim();
  if (!textToSend) return;

  setSendingReply(true);
  setError(null);

  try {
    // 1. Сохраняем сообщение пользователя на бэке
    const savedUser = await appendArtChat({
  dreamId,
  blockId,
  artworkId,
  role: 'user',
  content: textToSend,
});

    const userMsg: Message = {
      id: savedUser.id,
      text: savedUser.content,
      sender: 'user',
      role: 'user',
      timestamp: toTimestamp(savedUser.createdAt),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!forcedText) setInput('');

    // 3. Контекст для LLM
    const lastTurns = updatedMessages
      .slice(-MAX_TURNS)
      .map((m) => ({
        role: m.role ?? (m.sender === 'user' ? 'user' : 'assistant'),
        content: m.text,
      }));

    const blockText = JSON.stringify(artwork, null, 2);

    const ai = await analyzeDream(
  blockText,
  lastTurns,
      'Ты — ассистент, помогающий осмыслить произведение искусства в контексте сна. Будь внимателен к деталям.',
  dreamId,
  blockId,
  dream?.dreamSummary ?? null,
  dream?.autoSummary ?? null,
);

    const assistantText =
      ai?.choices?.[0]?.message?.content || 'Спасибо — продолжим.';

    // 4. Сохраняем ответ ассистента
    const savedAssistant = await appendArtChat({
  dreamId,
  blockId,
  artworkId,
  role: 'assistant',
  content: assistantText,
});

    setMessages((prev) => [
      ...prev,
      {
        id: savedAssistant.id,
        text: savedAssistant.content,
        sender: 'assistant',
        role: 'assistant',
        timestamp: toTimestamp(savedAssistant.createdAt),
        meta: savedAssistant.meta ?? null,
        insightArtworksLiked: Boolean(
          savedAssistant.meta?.insightArtworksLiked,
        ),
      },
    ]);
  } catch (e: any) {
    setError(e?.message || 'Ошибка отправки сообщения');
  } finally {
    setSendingReply(false);
  }
};

  const handleClear = async () => {
  if (!artDialogId || !blockId) return;
  setSendingReply(true);
  setError(null);
  try {
    await clearArtChat(dreamId, blockId, artworkId);

    // Просто сбрасываем состояние — и все.
    setMessages([]);
    kickoffDoneRef.current = null;
    kickoffInProgressRef.current = false;
    // НЕ вызываем getArtChat руками — useEffect сам всё сделает
  } catch (e: any) {
    enqueueSnackbar(e?.message ?? 'Не удалось очистить чат', {
      variant: 'error',
    });
  } finally {
    setSendingReply(false);
  }
};

  const handleToggleArtworkInsight = useCallback(
  async (message: Message) => {
    if (!dream?.id || message.role !== 'assistant') return;
    const nextLiked = !message.insightArtworksLiked;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
              ...m,
              insightArtworksLiked: nextLiked,
              meta: m.meta
                ? { ...m.meta, insightArtworksLiked: nextLiked }
                : { insightArtworksLiked: nextLiked },
            }
          : m,
      ),
    );

    try {
      const updated = await toggleArtworkInsight(
        dreamId,
        message.id,
        nextLiked,
        blockId,
        artworkId,
      );
      if (updated && updated.id) {
  setMessages((prev) =>
    prev.map((m) =>
      m.id === updated.id
        ? {
            ...m,
            // если с бэка пришло определённое значение — используем его,
            // иначе оставляем то, что уже было (nextLiked)
            insightArtworksLiked:
              typeof updated.meta?.insightArtworksLiked === 'boolean'
                ? updated.meta.insightArtworksLiked
                : m.insightArtworksLiked,
            meta: {
              ...(m.meta ?? null),
              ...(updated.meta ?? null),
              insightArtworksLiked:
                typeof updated.meta?.insightArtworksLiked === 'boolean'
                  ? updated.meta.insightArtworksLiked
                  : m.meta?.insightArtworksLiked ?? m.insightArtworksLiked,
            },
          }
        : m,
    ),
  );
}
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                insightArtworksLiked: !nextLiked,
                meta: m.meta
                  ? { ...m.meta, insightArtworksLiked: !nextLiked }
                  : { insightArtworksLiked: !nextLiked },
              }
            : m,
        ),
      );
      enqueueSnackbar(err?.message ?? 'Не удалось сохранить инсайт', {
        variant: 'error',
      });
    }
  },
  [dream?.id, dreamId, artworkId, blockId, enqueueSnackbar], // ✅ dreamId вместо artDialogId
);

  const artworksList = useMemo(
    () =>
      Array.isArray(dream?.similarArtworks) ? dream.similarArtworks : [],
    [dream],
  );
  const prevArtwork = artworksList[currentIdx - 1] ?? null;
  const nextArtwork = artworksList[currentIdx + 1] ?? null;

  const handleFinalInterpret = async (forceRegenerate = false) => {
    if (!dream) return;
    if (!forceRegenerate && dream.globalFinalInterpretation) {
      setFinalInterpretationText(dream.globalFinalInterpretation);
      setFinalDialogOpen(true);
      return;
    }
    setFinalDialogOpen(true);
    setLoadingFinalInterpretation(true);
    try {
      const res = await interpretFinal(
        dream.dreamText,
        dream.blocks ?? [],
        dream.id,
      );
      const text =
        res?.interpretation ||
        'Не удалось сформировать итоговое толкование.';
      setFinalInterpretationText(text);
      setDream((p: any) => (p ? { ...p, globalFinalInterpretation: text } : p));
    } catch (e: any) {
      setFinalInterpretationText('Ошибка генерации итогового толкования.');
    } finally {
      setLoadingFinalInterpretation(false);
    }
  };

  const handleRefreshFinal = async () => {
    setRefreshingFinal(true);
    setLoadingFinalInterpretation(true);
    try {
      await handleFinalInterpret(true);
    } finally {
      setRefreshingFinal(false);
      setLoadingFinalInterpretation(false);
    }
  };

  const goToArtwork = (idx: number) => {
  if (!id) return;
  const nextArtwork = artworksList[idx];

  navigate(`/dreams/${id}/artwork-chat/${idx}`, {
    state: {
      artwork: nextArtwork,
      artworkIndex: idx,
      artworkId: nextArtwork?.artworkId || nextArtwork?.artwork_id || nextArtwork?.id || nextArtwork?.uniqueId,  // ✅ добавили uniqueId
      origin: 'prev_next_nav',
    },
  });
};

const handleBack = () => {
  if (!id) {
    navigate(-1);
    return;
  }
  navigate(`/dreams/${id}/artworks`, { replace: true });
};

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background:
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <CircularProgress sx={{ color: '#fff' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background:
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
        }}
      >
        <Alert
          severity="error"
          sx={{ maxWidth: 700, mx: 'auto', mt: 4 }}
        >
          {error}
        </Alert>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <IconButton onClick={handleBack} sx={{ color: '#fff' }}>
            <ArrowBackIosNewIcon />
          </IconButton>
        </Box>
      </Box>
    );
  }

  if (!dream || !artwork) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background:
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Typography sx={{ color: '#fff' }}>
          Произведение не найдено.
        </Typography>
      </Box>
    );
  }

  const isKickoffActive =
    sendingReply || messagesLoading || kickoffInProgressRef.current;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ФИКСИРОВАННЫЙ ХЕДЕР */}
      <Box
        sx={{
          position: 'fixed',
          top: 'env(safe-area-inset-top)',
          left: 0,
          right: 0,
          height: `${HEADER_BASE}px`,
          zIndex: 1400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: glassBackground,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${glassBorder}`,
        }}
      >
        <Box
          sx={{
            maxWidth: 900,
            width: '100%',
            mx: 'auto',
            px: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
              }}
            >
              <IconButton
                onClick={handleBack}
                sx={{ color: '#fff', mr: 1 }}
                aria-label="Назад"
              >
                <ArrowBackIosNewIcon />
              </IconButton>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h6"
                  sx={{
                    color: '#fff',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {artwork.title || 'Диалог о произведении'}
                </Typography>
                {artwork.author && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255,255,255,0.75)',
                      display: 'block',
                      fontSize: '0.75rem',
                    }}
                  >
                    {artwork.author}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                ml: 2,
              }}
            >
              {/* Кнопка итогового толкования временно скрыта
  <Tooltip title="Показать итоговое толкование">
    <IconButton
      onClick={() => handleFinalInterpret(false)}
      sx={{ color: '#fff' }}
      aria-label="Показать итоговое толкование"
    >
      <FeedIcon />
    </IconButton>
  </Tooltip>
  */}
              <Tooltip title="Очистить чат">
                <span>
                  <IconButton
                    onClick={() => setClearDialogOpen(true)}
                    sx={{ color: '#fff' }}
                    aria-label="Очистить чат"
                    disabled={sendingReply || messagesLoading}
                  >
                    <DeleteSweepIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton
                onClick={() => setHeaderExpanded(!headerExpanded)}
                sx={{ color: '#fff' }}
                aria-label={headerExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {headerExpanded ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ОСНОВНОЙ КОНТЕНТ ПОД ХЕДЕРОМ */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          pb: 14,
          maxWidth: 900,
          mx: 'auto',
          width: '100%',
          mt: `calc(${HEADER_BASE}px + env(safe-area-inset-top))`,
        }}
      >
        {/* Блок с описанием произведения и prev/next */}
<Collapse in={headerExpanded}>
  <Paper
    elevation={0}
    sx={{
      mt: 1,
      p: 1.25,
      background: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${glassBorder}`,
      borderRadius: 2,
      mb: 2,
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
    >
      Описание произведения:
    </Typography>
    <Typography
      variant="body2"
      sx={{
        color: '#fff',
        mt: 0.5,
        whiteSpace: 'pre-wrap',
        lineHeight: 1.35,
      }}
    >
      {artwork.desc ?? 'Описание отсутствует.'}
    </Typography>

    {/* rollingSummary скрыт из UI
{rollingSummary && (
  <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
    <Typography variant="body2" sx={{ color: '#fff', fontStyle: 'italic' }}>
      {rollingSummary}
    </Typography>
  </Box>
)}
*/}

    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: prevArtwork && nextArtwork ? '1fr 1fr' : '1fr',
        },
        gap: 1,
        mt: 1.25,
      }}
    >
      {prevArtwork && (
        <Card
          key={`prev-${currentIdx - 1}`}   // 👈 добавлен key
          elevation={0}
          sx={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: `1px solid ${glassBorder}`,
            borderRadius: 2,
            color: '#fff',
          }}
        >
          <CardActionArea
            onClick={() => goToArtwork(currentIdx - 1)}
          >
            <CardContent
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 0.75,
                py: 0.6,
                px: 1,
              }}
            >
              <Tooltip title="Предыдущее произведение">
                <ArrowBackIcon
                  sx={{
                    opacity: 0.9,
                    fontSize: 18,
                    mt: '2px',
                  }}
                />
              </Tooltip>
              <Typography
                variant="body2"
                sx={{
                  color: '#fff',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.35,
                  fontSize: 13,
                }}
              >
                {prevArtwork.title}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      )}

      {nextArtwork && (
        <Card
          key={`next-${currentIdx + 1}`}   // 👈 добавлен key
          elevation={0}
          sx={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: `1px solid ${glassBorder}`,
            borderRadius: 2,
            color: '#fff',
          }}
        >
          <CardActionArea
            onClick={() => goToArtwork(currentIdx + 1)}
          >
            <CardContent
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 0.75,
                py: 0.6,
                px: 1,
              }}
            >
              <Tooltip title="Следующее произведение">
                <ArrowForwardIcon
                  sx={{
                    opacity: 0.9,
                    fontSize: 18,
                    mt: '2px',
                  }}
                />
              </Tooltip>
              <Typography
                variant="body2"
                sx={{
                  color: '#fff',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.35,
                  fontSize: 13,
                }}
              >
                {nextArtwork.title}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      )}
    </Box>
  </Paper>
</Collapse>

{/* СООБЩЕНИЯ */}
{messages.length === 0 ? (
  <Box
    sx={{
      textAlign: 'center',
      mt: 6,
      color: 'rgba(255,255,255,0.9)',
    }}
  >
    {isKickoffActive ? (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }}
        role="status"
        aria-live="polite"
      >
        <Avatar
          src={assistantAvatarUrl}
          alt="Assistant"
          sx={{
            width: 56,
            height: 56,
            border: `1px solid ${glassBorder}`,
          }}
        >
          {!assistantAvatarUrl && <SmartToyIcon />}
        </Avatar>

        <Paper
          elevation={0}
          sx={{
            mt: 1.25,
            p: 1,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${glassBorder}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CircularProgress
            size={18}
            sx={{ color: '#fff' }}
          />
          <Typography
            variant="body2"
            sx={{ color: '#fff', fontSize: 14 }}
          >
            Ассистент формулирует первый вопрос…
          </Typography>
        </Paper>

        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          Подождите, пожалуйста
        </Typography>
      </Box>
    ) : (
      <>
        <SmartToyIcon
          sx={{ fontSize: 64, mb: 2, opacity: 0.5 }}
        />
        <Typography variant="h6" sx={{ color: '#fff' }}>
          Начинаем диалог…
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mt: 1,
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          Ассистент задаст первый вопрос по произведению
        </Typography>
        {messagesLoading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 2,
            }}
          >
            <CircularProgress
              size={20}
              sx={{ color: '#fff' }}
            />
          </Box>
        )}
      </>
    )}
  </Box>
) : (
  messages.map((msg) => {
    const isInterpretation =
      msg.sender === 'assistant' &&
      msg.meta?.kind === 'art_interpretation';
    const isAssistant = msg.role === 'assistant';
    const isHighlighted = highlightedMessageId === msg.id;

            return (
  <Box
    key={msg.id}
    ref={(el: HTMLDivElement | null) => {
      messageRefs.current[msg.id] = el;
    }}
    sx={{
      display: 'flex',
      justifyContent:
        msg.sender === 'user' ? 'flex-end' : 'flex-start',
      mb: 2,
      animation: 'fadeIn 0.25s ease-in',
      '@keyframes fadeIn': {
        from: {
          opacity: 0,
          transform: 'translateY(8px)',
        },
        to: {
          opacity: 1,
          transform: 'translateY(0)',
        },
      },
    }}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        maxWidth: '75%',
        flexDirection:
          msg.sender === 'user' ? 'row-reverse' : 'row',
      }}
    >
      {msg.sender === 'user' ? (
        <Avatar
          src={userAvatarSrc}
          sx={{
            width: 36,
            height: 36,
            bgcolor: userAvatarSrc
              ? undefined
              : userAvatarBgColor,
            color: '#fff',
            boxShadow: '0 4px 16px rgba(24,32,80,0.35)',
            border: `1px solid ${glassBorder}`,
          }}
        >
          {!userAvatarSrc && UserAvatarIcon && (
            <UserAvatarIcon sx={{ fontSize: 20 }} />
          )}
        </Avatar>
      ) : (
        renderAssistantAvatar(
          isInterpretation ? 'interpretation' : 'default',
        )
      )}

      <Box
        sx={{
          position: 'relative',
        }}
        onDoubleClick={() => {
          if (isAssistant) handleToggleArtworkInsight(msg);
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 1.25,
            borderRadius: 2,
            background:
              msg.sender === 'user'
                ? accentColor
                : isInterpretation
                ? 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))'
                : 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
            border: isInterpretation
              ? '1px solid rgba(139,92,246,0.35)'
              : `1px solid ${glassBorder}`,
            color: '#fff',
            boxShadow: isHighlighted
              ? '0 0 14px rgba(255,255,255,0.35)'
              : 'none',
            outline: isHighlighted
              ? '2px solid rgba(255,255,255,0.85)'
              : 'none',
            transition: 'box-shadow 0.2s, outline 0.2s',
            cursor: isAssistant ? 'pointer' : 'default',
          }}
        >
          {isInterpretation && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 0.75,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                background: 'rgba(139,92,246,0.22)',
                border: '1px solid rgba(139,92,246,0.35)',
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'rgba(139,92,246,0.9)',
                  boxShadow: '0 0 8px rgba(139,92,246,0.6)',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.95)',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                }}
              >
                Толкование произведения
              </Typography>
            </Box>
          )}

          <Typography
            variant="body1"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.45,
            }}
          >
            {msg.text}
          </Typography>
        </Paper>

        {isAssistant && (
          <Tooltip
            title={
              msg.insightArtworksLiked
                ? 'Убрать из инсайтов'
                : 'Сохранить инсайт'
            }
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleArtworkInsight(msg);
              }}
              sx={{
                position: 'absolute',
                top: 8,
                right: -12,
                color: msg.insightArtworksLiked
                  ? 'rgba(255,100,150,0.95)'
                  : 'rgba(255,255,255,0.7)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.06)',
                },
              }}
            >
              {msg.insightArtworksLiked ? (
                <FavoriteIcon fontSize="small" />
              ) : (
                <FavoriteBorderIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  </Box>
);
          })
        )}

        {/* Лоадер истории */}
        {messagesLoading &&
          messages.length > 0 &&
          !generatingInterpretation &&
          !sendingReply && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                mb: 2,
              }}
              role="status"
              aria-live="polite"
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {renderAssistantAvatar()}
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${glassBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <CircularProgress
                    size={18}
                    sx={{ color: '#fff' }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: '#fff' }}
                  >
                    Обновляю историю сообщений…
                  </Typography>
                </Paper>
              </Box>
            </Box>
          )}

        {generatingInterpretation && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-start',
              mb: 2,
            }}
            role="status"
            aria-live="polite"
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              {renderAssistantAvatar('interpretation')}
              <Paper
                elevation={0}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  background:
                    'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))',
                  backdropFilter: 'blur(8px)',
                  border:
                    '1px solid rgba(139,92,246,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CircularProgress
                  size={18}
                  sx={{ color: 'rgba(139,92,246,0.9)' }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: '#fff' }}
                >
                  Генерирую интерпретацию...
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}

        {sendingReply &&
          !generatingInterpretation &&
          messages.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                mb: 2,
              }}
              role="status"
              aria-live="polite"
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {renderAssistantAvatar()}
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${glassBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <CircularProgress
                    size={18}
                    sx={{ color: '#fff' }}
                  />
                </Paper>
              </Box>
            </Box>
          )}

        <div ref={messagesEndRef} />
      </Box>

      {/* ИНПУТ ВНИЗУ */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          background:
            'linear-gradient(to top, rgba(102,126,234,0.28), transparent)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            maxWidth: 900,
            mx: 'auto',
            gap: 1,
          }}
        >
          <MoonButton
            illumination={illumination}
            onInterpret={runInterpretation}
            onFinalInterpret={() => handleFinalInterpret(false)}
            disabled={sendingReply || messagesLoading || !canBlockInterpret}
            direction="waxing"
            size={36}
          />
          <Box sx={{ flex: 1 }}>
            <GlassInputBox
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              disabled={sendingReply || messagesLoading}
              onClose={() => {}}
              containerStyle={{ position: 'static' }}
            />
          </Box>
        </Box>
      </Box>

      {/* ДИАЛОГ ОЧИСТКИ */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => {
          if (!sendingReply) setClearDialogOpen(false);
        }}
        PaperProps={{
          sx: {
            background:
              'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${glassBorder}`,
            color: '#fff',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle>Очистить историю беседы?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
            Вы уверены, что хотите удалить все сообщения для этого
            произведения? Сон и список похожих произведений останутся,
            будет очищена только переписка с ассистентом.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setClearDialogOpen(false)}
            sx={{
              color: '#fff',
              borderRadius: 12,
              height: 44,
              textTransform: 'none',
            }}
            disabled={sendingReply}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              await handleClear();
              setClearDialogOpen(false);
            }}
            sx={{
              bgcolor: 'rgba(255, 100, 100, 0.95)',
              '&:hover': {
                bgcolor: 'rgba(255, 100, 100, 0.85)',
              },
              borderRadius: 12,
              height: 44,
              textTransform: 'none',
            }}
            disabled={sendingReply}
          >
            {sendingReply ? 'Очистка…' : 'Очистить чат'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ДИАЛОГ ИТОГОВОГО ТОЛКОВАНИЯ */}
      <Dialog
        open={finalDialogOpen}
        onClose={() => setFinalDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            background: glassBackground,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${glassBorder}`,
            color: '#fff',
            maxHeight: '80vh',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            color: '#fff',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1.25,
          }}
        >
          <span>Итоговое толкование сна</span>
          <Tooltip title="Обновить толкование">
            <span>
              <IconButton
                onClick={handleRefreshFinal}
                disabled={
                  refreshingFinal || loadingFinalInterpretation
                }
                sx={{
                  color: '#fff',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
                size="small"
              >
                <RefreshIcon
                  sx={{
                    animation: refreshingFinal
                      ? 'spin 1s linear infinite'
                      : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </IconButton>
            </span>
          </Tooltip>
        </DialogTitle>

        <DialogContent
          dividers
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.18)',
            pt: 2,
            pb: 2.5,
          }}
        >
          {loadingFinalInterpretation ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 4,
              }}
            >
              <CircularProgress sx={{ color: '#fff' }} />
            </Box>
          ) : finalInterpretationText ? (
            <Typography
              variant="body1"
              sx={{
                whiteSpace: 'pre-wrap',
                color: '#fff',
                lineHeight: 1.6,
              }}
            >
              {finalInterpretationText}
            </Typography>
          ) : (
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255, 255, 255, 0.75)' }}
            >
              Итоговое толкование ещё не сформировано.
            </Typography>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.18)',
            px: 3,
            pb: 2.2,
            pt: 1.3,
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={() => setFinalDialogOpen(false)}
            sx={{
              color: '#fff',
              borderRadius: 12,
              height: 44,
              textTransform: 'none',
              px: 3,
              fontSize: '0.95rem',
              border: '1px solid rgba(255,255,255,0.35)',
              bgcolor: 'transparent',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.06)',
              },
            }}
          >
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* СТЕКЛЯННЫЙ СНЕKBAR ДЛЯ ЛУНЫ */}
      <Snackbar
        open={interpretSnackbarOpen}
        autoHideDuration={3000}
        onClose={() => setInterpretSnackbarOpen(false)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        sx={{
          bottom: '16vh',
        }}
        ContentProps={{
          sx: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            padding: 0,
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: 2.4,
            py: 1.4,
            borderRadius: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: `1px solid ${glassBorder}`,
            boxShadow: 'none',
            color: '#fff',
            maxWidth: 520,
          }}
        >
          <Box
            component="span"
            sx={{ fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}
          >
            {interpretSnackbarMessage}
          </Box>
        </Paper>
      </Snackbar>
    </Box>
  );
};