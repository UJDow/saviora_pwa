// src/features/daily/DailyConvoChat.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  Avatar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Collapse,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FeedIcon from '@mui/icons-material/Feed';
import RefreshIcon from '@mui/icons-material/Refresh';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useSnackbar } from 'notistack';

import * as api from '../../utils/api';
import { useAuth } from '../../features/auth/useAuth';
import { GlassInputBox } from '../profile/GlassInputBox';
import { MoonButton } from 'src/features/dreams/MoonButton';

import { useProfile } from 'src/features/profile/ProfileContext';
import { AVATAR_OPTIONS } from 'src/features/profile/ProfileEditForm';

import type {
  DailyConvoMessage as DailyConvoMessageType,
  UUID,
} from './types';
import type {
  DailyConvo as ApiDailyConvo,
  ChatMessage as ApiChatMessage,
} from '../../utils/api';

type Props = {
  dailyConvoId?: string;
  initialConvo?: ApiDailyConvo | null;
};

type UIMessage = DailyConvoMessageType;

const normalizeMessageContent = (value: unknown): string => {
  const seen = new WeakSet<object>();

  const visit = (input: unknown): string => {
    if (input == null) return '';

    if (typeof input === 'string') return input;

    if (typeof input === 'number' || typeof input === 'boolean') {
      return String(input);
    }

    if (Array.isArray(input)) {
      return input
        .map((item) => visit(item))
        .filter(
          (fragment) =>
            typeof fragment === 'string' && fragment.trim().length > 0,
        )
        .join('\n')
        .trim();
    }

    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      if (seen.has(obj)) return '';
      seen.add(obj);

      const candidateKeys: (keyof typeof obj)[] = [
        'text',
        'content',
        'value',
        'message',
        'data',
        'body',
      ];
      for (const key of candidateKeys) {
        if (key in obj) {
          const result = visit(obj[key]);
          if (result) return result;
        }
      }

      if ('parts' in obj) {
        const result = visit((obj as any).parts);
        if (result) return result;
      }

      if ('segments' in obj) {
        const result = visit((obj as any).segments);
        if (result) return result;
      }

      if ('choices' in obj) {
        const result = visit((obj as any).choices);
        if (result) return result;
      }

      try {
        const json = JSON.stringify(obj);
        return json === '{}' ? '' : json;
      } catch {
        return '';
      }
    }

    return '';
  };

  return visit(value).trim();
};

export default function DailyConvoChat({
  dailyConvoId: propId,
  initialConvo = null,
}: Props) {
  const params = useParams<{ id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const idFromUrl = params?.id;
  const convoId = propId ?? idFromUrl;

  const [convo, setConvo] = useState<ApiDailyConvo | null>(initialConvo);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const messagesRef = useRef<UIMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [input, setInput] = useState('');
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [finalInterpretationOpen, setFinalInterpretationOpen] =
    useState(false);
  const [finalInterpretationText, setFinalInterpretationText] =
    useState('');
  const [
    loadingFinalInterpretation,
    setLoadingFinalInterpretation,
  ] = useState(false);
  const [refreshingFinal, setRefreshingFinal] = useState(false);

  // как в DreamChat — управляем только верхним контекстным блоком
  const [headerExpanded, setHeaderExpanded] = useState(true);

  // очистка диалога
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const [
    generatingBlockInterpretation,
    setGeneratingBlockInterpretation,
  ] = useState(false);

  const kickoffDoneRef = useRef(false);
  const kickoffInProgressRef = useRef(false);

  const { profile, getIconComponent } = useProfile();

  const userAvatarIcon = profile?.avatarIcon ?? null;
  const userAvatarSrc = profile?.avatarImage ?? undefined;
  const UserAvatarIcon = getIconComponent(userAvatarIcon);

  type AvatarOption = (typeof AVATAR_OPTIONS)[number];

  const userAvatarBgColor =
    AVATAR_OPTIONS.find((o: AvatarOption) => o.icon === userAvatarIcon)
      ?.color ?? '#f0f0f0';

  // подсветка сообщений
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const hasScrolledToTargetRef = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);
  const highlightMessageIdFromState =
    (location.state as any)?.highlightMessageId || null;

  const toTimestamp = useCallback((isoOrNumber: string | number) => {
    const n =
      typeof isoOrNumber === 'number'
        ? isoOrNumber
        : Date.parse(String(isoOrNumber));
    return Number.isNaN(n) ? Date.now() : n;
  }, []);

  const mapApiMessageToUI = useCallback(
    (m: any): UIMessage => {
      const createdRaw =
        m.createdAt ??
        m.created_at ??
        m.created_at_ms ??
        m.createdAtMs ??
        null;
      const meta = m.meta ?? m.metadata ?? null;
      const insightLiked = Boolean(
        m.insightLiked ?? meta?.insightLiked ?? m.insight_liked ?? false,
      );

      const rawContent =
        m.content ??
        m.text ??
        m.message ??
        m.delta ??
        m.value ??
        m.body ??
        (typeof m.data === 'object' && m.data
          ? (m.data as Record<string, unknown>).content
          : undefined) ??
        '';

      const normalizedText = normalizeMessageContent(rawContent);

      return {
        id: String(m.id),
        text: normalizedText,
        sender: m.role === 'user' ? 'user' : 'bot',
        role: m.role ?? (m.sender === 'user' ? 'user' : 'assistant'),
        timestamp: toTimestamp(createdRaw ?? Date.now()),
        meta: meta ?? null,
        insightLiked,
      };
    },
    [toTimestamp],
  );

  const extractAiText = useCallback((aiRes: any): string | null => {
    if (!aiRes) return null;

    const raw =
      aiRes?.choices?.[0]?.message?.content ??
      aiRes?.choices?.[0]?.delta?.content ??
      aiRes?.message ??
      aiRes?.response ??
      aiRes?.text ??
      aiRes?.output?.text ??
      aiRes?.result ??
      null;

    const normalized = normalizeMessageContent(raw);
    return normalized || null;
  }, []);

  const fetchConvo = useCallback(async () => {
    if (!convoId) return;
    if (initialConvo) return;

    setLoadingConvo(true);
    setError(null);
    try {
      const c = await api.getDailyConvo(convoId);
      setConvo(c);
    } catch (e: any) {
      console.error('fetchConvo error', e);
      setError(`Ошибка загрузки записи: ${e.message || String(e)}`);
    } finally {
      setLoadingConvo(false);
    }
  }, [convoId, initialConvo]);

  const fetchMessages = useCallback(async () => {
    if (!convoId) return;
    setLoadingMessages(true);
    setError(null);
    try {
      const res = await api.getDailyConvoChat(convoId);
      const ui = (res?.messages ?? []).map(mapApiMessageToUI);
      setMessages(ui);
      return ui;
    } catch (e: any) {
      console.error('fetchMessages error', e);
      setError(`Ошибка загрузки сообщений: ${e.message || String(e)}`);
      return [];
    } finally {
      setLoadingMessages(false);
    }
  }, [convoId, mapApiMessageToUI]);

  const runKickoff = useCallback(
    async (force = false) => {
      if (!convo) return;
      if (kickoffDoneRef.current && !force) return;
      if (kickoffInProgressRef.current) return;
      if (sending) return;

      kickoffInProgressRef.current = true;
      setSending(true);
      setError(null);

      try {
        const instruction =
          'Сформулируй один первый вопрос для начала разговора о дне пользователя. ' +
          'Тон: тёплый, поддерживающий, без преамбулы, без списков. Коротко (1–2 предложения).';

        const notesText = convo.notes ?? convo.body ?? '';

        const ai = await api.analyzeDailyConvo(
          notesText,
          [],
          instruction,
          convo.id,
          'daily_chat',
          convo.autoSummary ?? null,
          convo.context ?? null,
        );
        const assistantText =
          extractAiText(ai) ??
          'Привет — расскажи, как прошёл твой день?';

        if (!convo.id)
          throw new Error('Отсутствует id записи для сохранения ответа');

        const saved = await api.appendDailyConvoChat({
          dailyConvoId: convo.id,
          role: 'assistant',
          content: assistantText,
        });

        const savedUI = mapApiMessageToUI(saved as ApiChatMessage);
        setMessages((prev) => [...prev, savedUI]);
        kickoffDoneRef.current = true;
      } catch (e: any) {
        console.error('runKickoff error', e);
        setError(
          `Не удалось автоматически начать разговор: ${
            e.message || String(e)
          }`,
        );

        const fallbackAssistant: UIMessage = {
          id: `fallback-assistant-${Date.now()}`,
          text: 'Не удалось получить ответ от сервера — попробуйте ещё раз чуть позже.',
          sender: 'bot',
          role: 'assistant',
          timestamp: Date.now(),
          meta: null,
          insightLiked: false,
        };
        setMessages((prev) => [...prev, fallbackAssistant]);
      } finally {
        kickoffInProgressRef.current = false;
        setSending(false);
      }
    },
    [convo, sending, mapApiMessageToUI, extractAiText],
  );

  const handleSend = useCallback(
    async (forcedText?: string) => {
      if (!convo) return;
      const rawText = (forcedText ?? input).trim();
      if (!rawText) return;

      setSending(true);
      setError(null);

      try {
        if (!convo.id) throw new Error('Отсутствует id записи');

        const savedUser = await api.appendDailyConvoChat({
          dailyConvoId: convo.id,
          role: 'user',
          content: rawText,
        });

        const savedUserUI = mapApiMessageToUI(savedUser as ApiChatMessage);
        setMessages((prev) => [...prev, savedUserUI]);
        if (!forcedText) setInput('');

        const currentMessages = messagesRef.current;
        const latestMessages = [...currentMessages, savedUserUI];
        const lastTurns = latestMessages
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.text }));

        const notesText = convo.notes ?? convo.body ?? '';
        const ai = await api.analyzeDailyConvo(
          notesText,
          lastTurns,
          undefined,
          convo.id,
          'daily_chat',
          convo.autoSummary ?? null,
          convo.context ?? null,
        );
        const assistantText =
          extractAiText(ai) ?? 'Понял(а). Продолжим.';

        const savedAssistant = await api.appendDailyConvoChat({
          dailyConvoId: convo.id,
          role: 'assistant',
          content: assistantText,
        });

        const savedAssistantUI = mapApiMessageToUI(
          savedAssistant as ApiChatMessage,
        );
        setMessages((prev) => [...prev, savedAssistantUI]);
      } catch (e: any) {
        console.error('handleSend error', e);
        setError(`Ошибка отправки сообщения: ${e.message || String(e)}`);

        const fallbackAssistant: UIMessage = {
          id: `fallback-assistant-${Date.now()}`,
          text: 'Не удалось получить ответ от сервера. Попробуйте ещё раз.',
          sender: 'bot',
          role: 'assistant',
          timestamp: Date.now(),
          meta: null,
          insightLiked: false,
        };
        setMessages((prev) => [...prev, fallbackAssistant]);
      } finally {
        setSending(false);
      }
    },
    [convo, input, mapApiMessageToUI, extractAiText],
  );

  const handleFinalInterpret = useCallback(
    async (forceRegenerate = false) => {
      if (!convo) return;

      if (!forceRegenerate && convo.globalFinalInterpretation) {
        setFinalInterpretationText(convo.globalFinalInterpretation);
        setFinalInterpretationOpen(true);
        return;
      }

      setFinalInterpretationOpen(true);
      setLoadingFinalInterpretation(true);
      setError(null);
      setRefreshingFinal(forceRegenerate);

      try {
        const notesText = convo.notes ?? convo.body ?? '';
        const res = await api.interpretFinalDailyConvo(
          notesText,
          convo.id,
          convo.autoSummary ?? null,
          convo.context ?? null,
        );
        const text = res?.interpretation ?? '';
        setFinalInterpretationText(text);
        setConvo((prev) =>
          prev ? { ...prev, globalFinalInterpretation: text } : prev,
        );
      } catch (e: any) {
        console.error('handleFinalInterpret error', e);
        setFinalInterpretationText(
          'Не удалось сгенерировать итоговое толкование.',
        );
        setError(`Ошибка генерации итога: ${e.message || String(e)}`);
        enqueueSnackbar(e.message || 'Ошибка генерации итога', {
          variant: 'error',
        });
      } finally {
        setLoadingFinalInterpretation(false);
        setRefreshingFinal(false);
      }
    },
    [convo, enqueueSnackbar],
  );

  const handleInterpretBlock = useCallback(async () => {
    if (!convo || sending || generatingBlockInterpretation) return;

    setGeneratingBlockInterpretation(true);
    setSending(true);
    setError(null);

    try {
      const fullDialogText = messagesRef.current
        .map((m) => `${m.sender}: ${m.text}`)
        .join('\n');

      if (!fullDialogText) {
        enqueueSnackbar('Нет сообщений для интерпретации', {
          variant: 'warning',
        });
        return;
      }

      const res = await api.interpretBlockDailyConvo(
        fullDialogText,
        convo.id,
        'dialog',
        convo.autoSummary ?? null,
        convo.context ?? null,
      );

      const interpretationText =
        res?.interpretation ?? 'Толкование не получено.';

      const saved = await api.appendDailyConvoChat({
        dailyConvoId: convo.id,
        role: 'assistant',
        content: interpretationText,
        meta: { kind: 'block_interpretation' },
      });

      const savedUI = mapApiMessageToUI(saved as ApiChatMessage);
      setMessages((prev) => [...prev, savedUI]);
    } catch (e: any) {
      console.error('handleInterpretBlock error', e);
      setError(`Ошибка интерпретации: ${e.message || String(e)}`);
      enqueueSnackbar(e.message || 'Ошибка интерпретации блока', {
        variant: 'error',
      });
    } finally {
      setSending(false);
      setGeneratingBlockInterpretation(false);
    }
  }, [
    convo,
    sending,
    generatingBlockInterpretation,
    mapApiMessageToUI,
    enqueueSnackbar,
  ]);

  const toggleLike = useCallback(
    async (messageId: UUID, liked: boolean, blockId?: string) => {
      if (!convo) return;
      try {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  insightLiked: liked,
                  meta: m.meta
                    ? { ...m.meta, insightLiked: liked }
                    : { insightLiked: liked },
                }
              : m,
          ),
        );

        await api.toggleDailyConvoMessageLike(
          convo.id,
          messageId,
          liked,
          blockId,
        );

        enqueueSnackbar(
          liked ? 'Инсайт сохранён' : 'Инсайт удалён',
          { variant: 'success' },
        );
      } catch (e: any) {
        console.error('toggleLike error', e);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  insightLiked: !liked,
                  meta: m.meta
                    ? { ...m.meta, insightLiked: !liked }
                    : { insightLiked: !liked },
                }
              : m,
          ),
        );
        setError(
          `Не удалось изменить лайк инсайта: ${e.message || String(e)}`,
        );
        enqueueSnackbar(
          e.message || 'Ошибка при сохранении инсайта',
          { variant: 'error' },
        );
      }
    },
    [convo, enqueueSnackbar],
  );

  // подсветка и скролл к сообщению из state
  useEffect(() => {
    hasScrolledToTargetRef.current = false;
    setHighlightedMessageId(null);
  }, [highlightMessageIdFromState]);

  useEffect(() => {
    if (
      !highlightMessageIdFromState ||
      messages.length === 0 ||
      hasScrolledToTargetRef.current
    )
      return;

    const targetElement = document.getElementById(
      `message-${highlightMessageIdFromState}`,
    );
    if (!targetElement) return;

    hasScrolledToTargetRef.current = true;
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setHighlightedMessageId(highlightMessageIdFromState);

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((prev) =>
        prev === highlightMessageIdFromState ? null : prev,
      );
    }, 2500);
  }, [messages, highlightMessageIdFromState]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void fetchConvo();
  }, [fetchConvo]);

  useEffect(() => {
    if (!convoId) return;
    void fetchMessages();
  }, [convoId, fetchMessages]);

  useEffect(() => {
    if (!loadingMessages && messages.length === 0 && convo) {
      void runKickoff();
    }
  }, [loadingMessages, messages.length, convo, runKickoff]);

  const formattedDate = useMemo(() => {
    if (!convo) return '';
    const rawDate = convo.date ?? convo.createdAt ?? null;
    const d = rawDate
      ? new Date(toTimestamp(rawDate as string | number))
      : null;
    return d ? d.toLocaleString('ru-RU') : '';
  }, [convo, toTimestamp]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const accentColor = 'rgba(88, 120, 255, 0.85)';
  const glassBackground = 'rgba(255, 255, 255, 0.1)';
  const glassBorder = 'rgba(255, 255, 255, 0.18)';
  const assistantAvatarUrl = '/logo.png';
  const HEADER_BASE = 56;

  const renderAssistantAvatar = useCallback(
    (variant: 'default' | 'interpretation' = 'default') => (
      <Avatar
        src={assistantAvatarUrl}
        alt="Daily Assistant"
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

  const pairs = messages.filter((m) => m.sender === 'user').length;
  const illumination = Math.max(0, Math.min(pairs / 7, 1));
  const canBlockInterpret = messages.length > 0;

  const handleBack = () => {
    if (convo?.id) {
      navigate(`/daily/${convo.id}`);
    } else {
      navigate('/daily');
    }
  };

  const handleClear = useCallback(async () => {
    if (!convo || clearing || sending) return;

    setClearing(true);
    setError(null);

    try {
      await api.clearDailyConvoChat(convo.id);

      setMessages([]);
      messagesRef.current = [];

      kickoffDoneRef.current = false;

      enqueueSnackbar('Диалог очищен', { variant: 'success' });

      setClearDialogOpen(false);

      await runKickoff(true);
    } catch (e: any) {
      console.error('handleClear error', e);
      setError(`Не удалось очистить диалог: ${e.message || String(e)}`);
      enqueueSnackbar(
        e.message || 'Ошибка при очистке диалога',
        { variant: 'error' },
      );
    } finally {
      setClearing(false);
    }
  }, [convo, clearing, sending, enqueueSnackbar, runKickoff]);

  const isKickoffActive = sending || loadingMessages || kickoffInProgressRef.current;

  if (loadingConvo) {
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

  if (error && !convo) {
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
          sx={{
            maxWidth: 600,
            mx: 'auto',
            mt: 4,
            color: '#fff',
            bgcolor: 'rgba(255, 0, 0, 0.2)',
          }}
        >
          {error}
          <Button
            onClick={() => {
              setError(null);
              void fetchMessages();
            }}
            sx={{ ml: 2, color: '#fff' }}
          >
            Повторить
          </Button>
        </Alert>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <IconButton onClick={handleBack} sx={{ color: '#fff' }}>
            <ArrowBackIosNewIcon />
          </IconButton>
        </Box>
      </Box>
    );
  }

  if (!convo) {
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
          severity="info"
          sx={{
            maxWidth: 600,
            mx: 'auto',
            mt: 4,
            color: '#fff',
            bgcolor: 'rgba(255,255,255,0.1)',
          }}
        >
          Запись не найдена
        </Alert>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <IconButton onClick={() => navigate('/daily')} sx={{ color: '#fff' }}>
            <ArrowBackIosNewIcon />
          </IconButton>
        </Box>
      </Box>
    );
  }

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

// Хедер
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

        <Box sx={{ overflow: 'hidden' }}>
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
            {convo.title?.trim() || 'Беседа'}
          </Typography>
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
        <Tooltip title="Показать итоговое толкование дня">
          <span>
            <IconButton
              onClick={() => handleFinalInterpret(false)}
              sx={{ color: '#fff' }}
              aria-label="Показать итоговое толкование дня"
              disabled={!convo}
            >
              <FeedIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Очистить диалог">
          <span>
            <IconButton
              onClick={() => setClearDialogOpen(true)}
              sx={{ color: '#fff' }}
              aria-label="Очистить диалог"
              disabled={clearing || sending}
            >
              <DeleteSweepIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip
          title={headerExpanded ? 'Свернуть тему дня' : 'Развернуть тему дня'}
        >
          <IconButton
            onClick={() => setHeaderExpanded((v) => !v)}
            sx={{ color: '#fff' }}
            aria-label={headerExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {headerExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  </Box>
</Box>

      {/* Контент под хедером */}
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
        {/* Тема беседы о дне — аналог анализируемого блока */}
        <Collapse in={headerExpanded}>
          <Paper
            elevation={0}
            sx={{
              mt: 1,
              p: 1.25,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${glassBorder}`,
              borderRadius: 2,
              mb: 2,
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.7)' }}
            >
              Тема беседы:
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
              {convo.context ||
                convo.autoSummary ||
                convo.notes ||
                'Краткое описание дня пока отсутствует.'}
            </Typography>
          </Paper>
        </Collapse>

        {/* Блок "формулируем первый вопрос" — 1:1 по духу с DreamChat */}
        {isKickoffActive && messages.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              mb: 3,
              mt: 1,
            }}
          >
            {renderAssistantAvatar()}
            <Paper
              elevation={0}
              sx={{
                flex: 1,
                p: 1.5,
                borderRadius: 2,
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${glassBorder}`,
                color: '#fff',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  mb: 0.5,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                Формирую первый вопрос
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.9)',
                  mb: 1,
                }}
              >
                Я читаю вашу запись и готовлю короткий тёплый вопрос, с
                которого начнётся разговор о дне.
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mt: 0.5,
                }}
              >
                <CircularProgress
                  size={18}
                  sx={{ color: '#fff', opacity: 0.9 }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Это займёт пару секунд...
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Сообщения */}
        {loadingMessages && messages.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              mt: 8,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <CircularProgress sx={{ color: '#fff', mb: 2 }} />
            <Typography variant="body2">
              Загрузка сообщений...
            </Typography>
          </Box>
        ) : messages.length === 0 && !isKickoffActive ? (
          // fallback, если вообще ничего не загрузилось/не сгенерировалось
          <Box
            sx={{
              textAlign: 'center',
              mt: 8,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <SmartToyIcon
              sx={{ fontSize: 64, mb: 2, opacity: 0.5 }}
            />
            <Typography variant="h6">Начинаем диалог…</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Попробуйте написать, как прошёл ваш день.
            </Typography>
          </Box>
        ) : (
          messages.map((msg) => {
            const isHighlighted = highlightedMessageId === msg.id;
            const isAssistant = msg.role === 'assistant';
            const isInterpretation =
              msg.meta?.kind === 'block_interpretation';

            return (
              <Box
                key={msg.id}
                id={`message-${msg.id}`}
                sx={{
                  display: 'flex',
                  justifyContent:
                    msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2,
                  animation: 'fadeIn 0.3s ease-in',
                  '@keyframes fadeIn': {
                    from: {
                      opacity: 0,
                      transform: 'translateY(10px)',
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
                        boxShadow:
                          '0 4px 16px rgba(24,32,80,0.35)',
                        border: `1px solid ${glassBorder}`,
                      }}
                    >
                      {!userAvatarSrc && UserAvatarIcon && (
                        <UserAvatarIcon sx={{ fontSize: 20 }} />
                      )}
                    </Avatar>
                  ) : (
                    renderAssistantAvatar(
                      isInterpretation
                        ? 'interpretation'
                        : 'default',
                    )
                  )}

                  <Box
                    sx={{
                      position: 'relative',
                      cursor: isAssistant ? 'pointer' : 'default',
                    }}
                    onDoubleClick={() => {
                      if (isAssistant)
                        toggleLike(
                          msg.id as UUID,
                          !Boolean(
                            msg.insightLiked ??
                              msg.meta?.insightLiked,
                          ),
                        );
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
                            : 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        border: isInterpretation
                          ? '1px solid rgba(139,92,246,0.4)'
                          : `1px solid ${glassBorder}`,
                        color: '#fff',
                        boxShadow: isHighlighted
                          ? '0 0 12px rgba(255,255,255,0.45)'
                          : isInterpretation
                          ? '0 4px 12px rgba(139,92,246,0.2)'
                          : 'none',
                        outline: isHighlighted
                          ? '2px solid rgba(255,255,255,0.8)'
                          : 'none',
                        transition:
                          'box-shadow 0.3s ease, outline 0.3s ease',
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
                            background:
                              'rgba(139,92,246,0.25)',
                            border:
                              '1px solid rgba(139,92,246,0.4)',
                          }}
                        >
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background:
                                'rgba(139,92,246,0.9)',
                              boxShadow:
                                '0 0 8px rgba(139,92,246,0.6)',
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 600,
                              letterSpacing: 0.3,
                              color:
                                'rgba(255,255,255,0.95)',
                              textTransform: 'uppercase',
                              fontSize: '0.7rem',
                            }}
                          >
                            Толкование
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
                          msg.insightLiked
                            ? 'Убрать из инсайтов'
                            : 'Сохранить инсайт'
                        }
                      >
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleLike(
                              msg.id as UUID,
                              !Boolean(
                                msg.insightLiked ??
                                  msg.meta?.insightLiked,
                              ),
                            );
                          }}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: -12,
                            color: msg.insightLiked
                              ? 'rgba(255,100,150,0.95)'
                              : 'rgba(255,255,255,0.6)',
                            '&:hover': {
                              color: 'rgba(255,100,150,1)',
                              backgroundColor:
                                'rgba(255,255,255,0.08)',
                            },
                          }}
                        >
                          {msg.insightLiked ? (
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

        {/* индикатор генерации блока */}
        {generatingBlockInterpretation && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-start',
              mb: 2,
            }}
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
                  backdropFilter: 'blur(10px)',
                  border:
                    '1px solid rgba(139,92,246,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CircularProgress
                  size={20}
                  sx={{ color: 'rgba(139,92,246,0.9)' }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: '#fff' }}
                >
                  Формирую толкование...
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}

        {/* индикатор “набираю ответ” */}
        {sending &&
          !generatingBlockInterpretation &&
          messages.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                mb: 2,
              }}
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
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${glassBorder}`,
                  }}
                >
                  <CircularProgress
                    size={20}
                    sx={{ color: '#fff' }}
                  />
                </Paper>
              </Box>
            </Box>
          )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Футер — луна + инпут, как в DreamChat */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          background:
            'linear-gradient(to top, rgba(102,126,234,0.3), transparent)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            maxWidth: 900,
            mx: 'auto',
          }}
        >
          <Box sx={{ mr: 1.5, flexShrink: 0 }}>
            <MoonButton
              illumination={illumination}
              onInterpret={handleInterpretBlock}
              onFinalInterpret={() => handleFinalInterpret(false)}
              disabled={
                sending ||
                generatingBlockInterpretation ||
                !canBlockInterpret
              }
              direction="waxing"
              size={32}
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <GlassInputBox
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              disabled={
                sending || generatingBlockInterpretation || clearing
              }
              onClose={() => {}}
              containerStyle={{
                position: 'static',
                margin: '0 auto',
                maxWidth: '100%',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Итоговое толкование дня */}
      <Dialog
        open={finalInterpretationOpen}
        onClose={() => setFinalInterpretationOpen(false)}
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
          <span>Итоговое толкование дня</span>
          <Tooltip title="Обновить толкование">
            <span>
              <IconButton
                onClick={() => handleFinalInterpret(true)}
                disabled={
                  refreshingFinal || loadingFinalInterpretation
                }
                sx={{
                  color: '#fff',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.1)',
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
              sx={{ color: 'rgba(255,255,255,0.7)' }}
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
            onClick={() => setFinalInterpretationOpen(false)}
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

      {/* Диалог подтверждения очистки */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => {
          if (!sending && !clearing) setClearDialogOpen(false);
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
        <DialogTitle>Очистить диалог про этот день?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
            Вы уверены, что хотите удалить все сообщения в этом разговоре?
            Запись дня сохранится, будет очищена только переписка с ассистентом.
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
            disabled={sending || clearing}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleClear}
            sx={{
              bgcolor: 'rgba(255, 100, 100, 0.95)',
              '&:hover': {
                bgcolor: 'rgba(255, 100, 100, 0.85)',
              },
              borderRadius: 12,
              height: 44,
              textTransform: 'none',
            }}
            disabled={sending || clearing}
          >
            {clearing ? 'Очистка…' : 'Очистить диалог'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}