import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RefreshIcon from '@mui/icons-material/Refresh';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FeedIcon from '@mui/icons-material/Feed';
import { useSnackbar } from 'notistack';

import {
  getDream,
  getChat,
  appendChat,
  clearChat,
  analyzeDream,
  toggleArtworkInsight,
  interpretFinal,
} from '../../utils/api';

import { GlassInputBox } from '../profile/GlassInputBox';
import { MoonButton } from './MoonButton';

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

const toTimestamp = (raw: any) => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
};

export const ArtworkChat: React.FC = () => {
  const { id, artworkIdx } = useParams<{ id: string; artworkIdx?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();

  const [dream, setDream] = useState<any | null>(null);
  const [artwork, setArtwork] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [generatingInterpretation, setGeneratingInterpretation] = useState(false);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [finalInterpretationText, setFinalInterpretationText] = useState('');
  const [loadingFinalInterpretation, setLoadingFinalInterpretation] = useState(false);
  const [refreshingFinal, setRefreshingFinal] = useState(false);

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // kickoff guards
  const kickoffDoneRef = useRef<string | null>(null);
  const kickoffInProgressRef = useRef<boolean>(false);

  const accentColor = 'rgba(88, 120, 255, 0.85)';
  const glassBackground = 'rgba(255, 255, 255, 0.1)';
  const glassBorder = 'rgba(255, 255, 255, 0.18)';
  const assistantAvatarUrl = '/logo.png';

  const currentIdx = useMemo(() => {
    const idx = Number(artworkIdx ?? 0);
    return Number.isNaN(idx) ? 0 : idx;
  }, [artworkIdx]);

  const blockId = `artwork__${currentIdx}`;

  const renderAssistantAvatar = useCallback(
    (variant: 'default' | 'interpretation' = 'default') => (
      <Avatar
        src={assistantAvatarUrl}
        alt="Assistant"
        sx={{
          width: 36,
          height: 36,
          bgcolor: assistantAvatarUrl ? 'rgba(255,255,255,0.08)' : variant === 'interpretation' ? 'rgba(139,92,246,0.85)' : 'rgba(255,255,255,0.3)',
          border: `1px solid ${glassBorder}`,
          boxShadow: assistantAvatarUrl ? '0 6px 18px rgba(24,32,80,0.35)' : 'none',
          '& img': { objectFit: 'cover' },
        }}
      >
        {!assistantAvatarUrl && <SmartToyIcon />}
      </Avatar>
    ),
    [assistantAvatarUrl]
  );

  const pickArtworkImage = (a: any) => {
    if (!a) return null;
    const keys = ['image', 'image_url', 'thumbnail', 'src', 'value', 'imageUrl', 'srcUrl', 'thumb', 'picture', 'img'];
    for (const k of keys) {
      const v = a[k];
      if (v && typeof v === 'string') return v;
    }
    if (a.urls?.small) return a.urls.small;
    if (a.urls?.thumb) return a.urls.thumb;
    if (a.media?.[0]?.url) return a.media[0].url;
    return null;
  };

  // load dream + artwork
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!id) {
          setError('ID не указан');
          return;
        }
        const d = await getDream(id);
        if (!d) {
          setError('Сон не найден');
          return;
        }
        setDream(d);

        const stateAny = (location.state as any) ?? {};
        const stateArtwork = stateAny.artwork;
        const stateIdx = typeof stateAny.artworkIndex === 'number' ? stateAny.artworkIndex : undefined;

        if (stateArtwork && (stateIdx === undefined || stateIdx === currentIdx || Number(stateIdx) === currentIdx)) {
          setArtwork(stateArtwork);
        } else if (d?.similarArtworks && Array.isArray(d.similarArtworks)) {
          const candidate = d.similarArtworks[currentIdx];
          setArtwork(candidate ?? null);
        } else {
          setArtwork(null);
        }

        if (d?.globalFinalInterpretation) {
          setFinalInterpretationText(d.globalFinalInterpretation);
        }
      } catch (e: any) {
        setError(e?.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentIdx, location.state]);

  const runKickoff = useCallback(async () => {
    if (!id || !blockId || !artwork) return;
    if (kickoffDoneRef.current === blockId) return;
    if (kickoffInProgressRef.current) return;
    if (sendingReply) return;

    kickoffInProgressRef.current = true;
    setSendingReply(true);

    try {
      const kickoffPrompt =
        'Сформулируй первый вопрос для обсуждения этого произведения искусства в контексте сна пользователя. ' +
        'Тон: тёплый, поддерживающий, без преамбулы, без списков. Коротко (1–2 предложения). ' +
        'Используй детали описания произведения и сна.';
      const blockText = JSON.stringify(artwork, null, 2);

      const ai = await analyzeDream(
        blockText,
        [],
        kickoffPrompt,
        id,
        blockId,
        dream?.dreamSummary ?? null,
        dream?.autoSummary ?? null
      );

      const assistantText =
        ai?.choices?.[0]?.message?.content ||
        'Что в этом произведении кажется вам наиболее созвучным вашему сну?';

      const saved = await appendChat({
        dreamId: id,
        blockId,
        role: 'assistant',
        content: assistantText,
      });

      setMessages([
        {
          id: saved.id,
          text: saved.content,
          sender: 'assistant',
          role: 'assistant',
          timestamp: toTimestamp(saved.createdAt),
          meta: saved.meta ?? null,
          insightArtworksLiked: Boolean(saved.meta?.insightArtworksLiked),
        },
      ]);

      kickoffDoneRef.current = blockId;
    } catch (e: any) {
      console.error('Kickoff error', e);
      setError(e?.message || 'Не удалось начать диалог');
    } finally {
      kickoffInProgressRef.current = false;
      setSendingReply(false);
    }
  }, [id, blockId, artwork, dream?.dreamSummary, dream?.autoSummary, sendingReply]);

  // load chat
  useEffect(() => {
    (async () => {
      if (!id || !blockId || !artwork) return;
      setMessagesLoading(true);
      setError(null);
      try {
        const resp = await getChat(id, blockId);
        const msgs = (resp.messages || []).map((m: any) => ({
          id: m.id,
          text: m.content,
          sender: m.role === 'user' ? 'user' : 'assistant',
          role: (m.role as Role) || (m.role === 'user' ? 'user' : 'assistant'),
          timestamp: toTimestamp(m.createdAt ?? Date.now()),
          meta: m.meta ?? null,
          insightArtworksLiked: Boolean(m.meta?.insightArtworksLiked),
        })) as Message[];

        if (msgs.length === 0 && kickoffDoneRef.current !== blockId && !kickoffInProgressRef.current) {
          setSendingReply(true); // show kickoff UI immediately
          await runKickoff();
        } else {
          setMessages(msgs);
        }
      } catch (e: any) {
        setError(e?.message || 'Ошибка загрузки чата');
      } finally {
        setMessagesLoading(false);
        if (messages.length > 0 && !sendingReply) {
          setSendingReply(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, blockId, artwork, runKickoff]);

  // messageId handling (from query or state)
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
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
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(targetMessageId);
        if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = window.setTimeout(() => {
          setHighlightedMessageId(null);
          highlightTimeoutRef.current = null;
        }, 4000);
        return;
      }

      // search in other artworks
      if (!dream?.similarArtworks || !Array.isArray(dream.similarArtworks) || !id) {
        enqueueSnackbar('Сообщение не найдено в этом блоке', { variant: 'warning' });
        return;
      }

      enqueueSnackbar('Ищу сообщение в других похожих произведениях...', { variant: 'info' });

      const total = dream.similarArtworks.length;
      for (let i = 0; i < total; i++) {
        const otherBlockId = `artwork__${i}`;
        if (otherBlockId === blockId) continue;
        try {
          const resp = await getChat(id, otherBlockId);
          const msgs = resp.messages || [];
          const found = msgs.find((m: any) => String(m.id) === String(targetMessageId));
          if (found) {
            const nextArtwork = dream.similarArtworks?.[i];
            navigate(`/dreams/${id}/artwork-chat/${i}?messageId=${encodeURIComponent(targetMessageId)}`, {
              state: { highlightMessageId: targetMessageId, artwork: nextArtwork, artworkIndex: i, origin: 'insights' },
            });
            enqueueSnackbar('Сообщение найдено — перенаправляю', { variant: 'success' });
            return;
          }
        } catch (err: any) {
          console.warn('Ошибка при поиске в блоке', otherBlockId, err);
        }
      }

      enqueueSnackbar('Сообщение не найдено в похожих произведениях', { variant: 'warning' });
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

  const runInterpretation = async () => {
    if (!id || !blockId || !artwork) return;
    if (sendingReply || generatingInterpretation) return;

    setGeneratingInterpretation(true);
    setSendingReply(true);

    try {
      const systemPrompt =
        'Сформулируй развернутую интерпретацию этого произведения в контексте сна пользователя. ' +
        'Тон — тёплый и аналитичный, поясняй ассоциации, предлагай вопросы для саморефлексии.';
      const blockText = JSON.stringify(artwork, null, 2);
      const ai = await analyzeDream(
        blockText,
        [],
        systemPrompt,
        id,
        blockId,
        dream?.dreamSummary ?? null,
        dream?.autoSummary ?? null
      );
      const assistantText = ai?.choices?.[0]?.message?.content || 'Вот интерпретация произведения...';
      const saved = await appendChat({
        dreamId: id,
        blockId,
        role: 'assistant',
        content: assistantText,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: saved.id,
          text: saved.content,
          sender: 'assistant',
          role: 'assistant',
          timestamp: toTimestamp(saved.createdAt),
          meta: saved.meta ?? { kind: 'art_interpretation' },
          insightArtworksLiked: Boolean(saved.meta?.insightArtworksLiked),
        },
      ]);
    } catch (e: any) {
      enqueueSnackbar(e?.message ?? 'Не удалось сгенерировать интерпретацию', { variant: 'error' });
    } finally {
      setGeneratingInterpretation(false);
      setSendingReply(false);
    }
  };

  const handleSend = async (forcedText?: string) => {
    if ((!input.trim() && !forcedText) || !id || !blockId || !artwork) return;
    const textToSend = (forcedText ?? input).trim();
    if (!textToSend) return;

    setSendingReply(true);
    setError(null);
    try {
      const savedUser = await appendChat({
        dreamId: id,
        blockId,
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
      setMessages((prev) => [...prev, userMsg]);
      if (!forcedText) setInput('');

      const lastTurns = [...messages, userMsg]
        .slice(-MAX_TURNS)
        .map((m) => ({ role: m.role ?? (m.sender === 'user' ? 'user' : 'assistant'), content: m.text }));
      const blockText = JSON.stringify(artwork, null, 2);
      const ai = await analyzeDream(
        blockText,
        lastTurns,
        'Ты — ассистент, помогающий осмыслить произведение искусства в контексте сна. Будь внимателен к деталям.',
        id,
        blockId,
        dream?.dreamSummary ?? null,
        dream?.autoSummary ?? null
      );
      const assistantText = ai?.choices?.[0]?.message?.content || 'Спасибо — продолжим.';
      const savedAssistant = await appendChat({
        dreamId: id,
        blockId,
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
          insightArtworksLiked: Boolean(savedAssistant.meta?.insightArtworksLiked),
        },
      ]);
    } catch (e: any) {
      setError(e?.message || 'Ошибка отправки сообщения');
    } finally {
      setSendingReply(false);
    }
  };

  const handleClear = async () => {
    if (!id || !blockId) return;
    setSendingReply(true);
    setError(null);
    try {
      await clearChat(id, blockId);
      setMessages([]);
      kickoffDoneRef.current = null;
      await runKickoff();
    } catch (e: any) {
      enqueueSnackbar(e?.message ?? 'Не удалось очистить чат', { variant: 'error' });
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
                meta: m.meta ? { ...m.meta, insightArtworksLiked: nextLiked } : { insightArtworksLiked: nextLiked },
              }
            : m
        )
      );

      try {
        const updated = await toggleArtworkInsight(dream.id, message.id, nextLiked, blockId);
        if (updated && updated.id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    insightArtworksLiked: Boolean(updated.meta?.insightArtworksLiked),
                    meta: updated.meta ?? m.meta ?? null,
                  }
                : m
            )
          );
        }
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  insightArtworksLiked: !nextLiked,
                  meta: m.meta ? { ...m.meta, insightArtworksLiked: !nextLiked } : { insightArtworksLiked: !nextLiked },
                }
              : m
          )
        );
        enqueueSnackbar(err?.message ?? 'Не удалось сохранить инсайт', { variant: 'error' });
      }
    },
    [dream?.id, blockId, enqueueSnackbar]
  );

  const artworksList = useMemo(() => (Array.isArray(dream?.similarArtworks) ? dream.similarArtworks : []), [dream]);
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
      const res = await interpretFinal(dream.dreamText, dream.blocks ?? [], dream.id);
      const text = res?.interpretation || 'Не удалось сформировать итоговое толкование.';
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
    navigate(`/dreams/${id}/artwork-chat/${idx}`);
  };

  const handleBack = () => {
    if (!id) return;
    navigate(`/dreams/${id}/similar`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <CircularProgress sx={{ color: '#fff' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', p: 3 }}>
        <Alert severity="error" sx={{ maxWidth: 700, mx: 'auto', mt: 4 }}>{error}</Alert>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <IconButton onClick={handleBack} sx={{ color: '#fff' }}><ArrowBackIosNewIcon /></IconButton>
        </Box>
      </Box>
    );
  }

  if (!dream || !artwork) {
    return (
      <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Typography sx={{ color: '#fff' }}>Произведение не найдено.</Typography>
      </Box>
    );
  }

const imageCandidate = null;

  const isKickoffActive = sendingReply || messagesLoading || kickoffInProgressRef.current;

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <Paper elevation={0} sx={{ background: glassBackground, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${glassBorder}`, p: 2, position: 'sticky', top: 0, zIndex: 10 }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <IconButton onClick={handleBack} sx={{ color: '#fff', mr: 1 }} aria-label="Назад">
                <ArrowBackIosNewIcon />
              </IconButton>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {artwork.title || 'Диалог о произведении'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block', fontSize: '0.75rem' }}>
                  {artwork.author ?? ''}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
              <Tooltip title="Показать итоговое толкование"><IconButton onClick={() => handleFinalInterpret(false)} sx={{ color: '#fff' }}><FeedIcon /></IconButton></Tooltip>
              <Tooltip title="Очистить чат"><span><IconButton onClick={handleClear} sx={{ color: '#fff' }} disabled={sendingReply}><DeleteSweepIcon /></IconButton></span></Tooltip>
              <IconButton onClick={() => setHeaderExpanded(!headerExpanded)} sx={{ color: '#fff' }}>{headerExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
            </Box>
          </Box>

          <Collapse in={headerExpanded}>
            <Paper elevation={0} sx={{ mt: 2, p: 1.25, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', border: `1px solid ${glassBorder}`, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                {/* moderate thumbnail (160x120) */}
                <Box sx={{ width: 160, height: 120, borderRadius: 1, overflow: 'hidden', bgcolor: '#ddd', flexShrink: 0, boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
  <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <SmartToyIcon fontSize="large" sx={{ color: 'rgba(255,255,255,0.6)' }} />
  </Box>
</Box>

                {/* only description here (title/author already in sticky header) */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.25, fontSize: 14, maxHeight: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {artwork.desc ?? 'Описание отсутствует.'}
                  </Typography>

                  {/* prev/next compact cards styled like DreamChat */}
<Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
  {prevArtwork && (
    <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${glassBorder}`, borderRadius: 2 }}>
      <CardActionArea onClick={() => goToArtwork(currentIdx - 1)}>
        <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, py: 0.6, px: 1 }}>
          <Tooltip title="Предыдущее произведение">
            {/* Added color: '#fff' to make the arrow white */}
            <ArrowBackIcon sx={{ opacity: 0.9, fontSize: 18, mt: '2px', color: '#fff' }} />
          </Tooltip>
          <Typography variant="body2" sx={{ color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35, fontSize: 13 }}>
            {prevArtwork.title}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  )}

  {nextArtwork && (
    <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${glassBorder}`, borderRadius: 2 }}>
      <CardActionArea onClick={() => goToArtwork(currentIdx + 1)}>
        <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, py: 0.6, px: 1 }}>
          <Tooltip title="Следующее произведение">
            {/* Added color: '#fff' to make the arrow white */}
            <ArrowForwardIcon sx={{ opacity: 0.9, fontSize: 18, mt: '2px', color: '#fff' }} />
          </Tooltip>
          <Typography variant="body2" sx={{ color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35, fontSize: 13 }}>
            {nextArtwork.title}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  )}
  <Box sx={{ flex: 1 }} />
</Box>
                </Box>
              </Box>
            </Paper>
          </Collapse>
        </Box>
      </Paper>

      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, pb: 14, maxWidth: 900, mx: 'auto', width: '100%' }}>
        {messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 6, color: 'rgba(255,255,255,0.9)' }}>
            {/* image card */}
            {imageCandidate && (
              <Box sx={{ width: '100%', maxWidth: 480, mx: 'auto', borderRadius: 2, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.35)', mb: 2 }}>
                <img src={imageCandidate} alt={artwork.title} style={{ width: '100%', height: 280, objectFit: 'cover', display: 'block' }} />
              </Box>
            )}

            {/* kickoff indicator (logo + bubble) — matches DreamChat feel */}
            {isKickoffActive ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Avatar src={assistantAvatarUrl} alt="Assistant" sx={{ width: 56, height: 56, border: `1px solid ${glassBorder}` }}>
                  {!assistantAvatarUrl && <SmartToyIcon />}
                </Avatar>

                <Paper elevation={0} sx={{ mt: 1.25, p: 1, borderRadius: 2, background: 'rgba(255,255,255,0.06)', border: `1px solid ${glassBorder}`, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} sx={{ color: '#fff' }} />
                  <Typography variant="body2" sx={{ color: '#fff', fontSize: 14 }}>Ассистент формулирует первый вопрос…</Typography>
                </Paper>

                <Typography variant="caption" sx={{ mt: 0.5, color: 'rgba(255,255,255,0.75)' }}>Подождите, пожалуйста</Typography>
              </Box>
            ) : (
              <>
                {!imageCandidate && <SmartToyIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />}
                <Typography variant="h6" sx={{ color: '#fff' }}>Начинаем диалог…</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.8)' }}>Ассистент задаст первый вопрос по произведению</Typography>
                {messagesLoading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <CircularProgress size={20} sx={{ color: '#fff' }} />
                  </Box>
                )}
              </>
            )}
          </Box>
        ) : (
          messages.map((msg) => {
            const isInterpretation = msg.sender === 'assistant' && msg.meta?.kind === 'art_interpretation';
            const isAssistant = msg.role === 'assistant';
            const isHighlighted = highlightedMessageId === msg.id;

            return (
              <Box
                key={msg.id}
                ref={(el: HTMLDivElement | null) => { messageRefs.current[msg.id] = el; }}
                sx={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2,
                  animation: 'fadeIn 0.25s ease-in',
                  '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, maxWidth: '75%', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
                  {msg.sender === 'user' ? (
                    <Avatar sx={{ bgcolor: accentColor, width: 36, height: 36 }}><PersonIcon /></Avatar>
                  ) : (
                    renderAssistantAvatar(isInterpretation ? 'interpretation' : 'default')
                  )}

                  <Box sx={{ position: 'relative', cursor: isAssistant ? 'pointer' : 'default' }}>
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
                        border: isInterpretation ? '1px solid rgba(139,92,246,0.35)' : `1px solid ${glassBorder}`,
                        color: '#fff',
                        boxShadow: isHighlighted ? '0 0 14px rgba(255,255,255,0.35)' : 'none',
                        outline: isHighlighted ? '2px solid rgba(255,255,255,0.85)' : 'none',
                        transition: 'box-shadow 0.2s, outline 0.2s',
                      }}
                    >
                      {isInterpretation && (
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 0.75, px: 1, py: 0.25, borderRadius: 1, background: 'rgba(139,92,246,0.22)', border: '1px solid rgba(139,92,246,0.35)' }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(139,92,246,0.9)', boxShadow: '0 0 8px rgba(139,92,246,0.6)' }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                            Интерпретация
                          </Typography>
                        </Box>
                      )}

                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
                        {msg.text}
                      </Typography>
                    </Paper>

                    {isAssistant && (
                      <Tooltip title={msg.insightArtworksLiked ? 'Убрать из инсайтов' : 'Сохранить инсайт'}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleToggleArtworkInsight(msg); }}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: -12,
                            color: msg.insightArtworksLiked ? 'rgba(255,100,150,0.95)' : 'rgba(255,255,255,0.7)',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                          }}
                        >
                          {msg.insightArtworksLiked ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })
        )}

        {generatingInterpretation && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {renderAssistantAvatar('interpretation')}
              <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))', backdropFilter: 'blur(8px)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} sx={{ color: 'rgba(139,92,246,0.9)' }} />
                <Typography variant="body2" sx={{ color: '#fff' }}>Генерирую интерпретацию...</Typography>
              </Paper>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Composer */}
      <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, background: 'linear-gradient(to top, rgba(102,126,234,0.28), transparent)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: 900, mx: 'auto', gap: 1 }}>
          <MoonButton
            illumination={Math.min(messages.filter((m) => m.sender === 'user').length / 6, 1)}
            onInterpret={runInterpretation}
            onFinalInterpret={() => handleFinalInterpret(false)}
            disabled={sendingReply}
            direction="waxing"
            size={36}
          />
          <Box sx={{ flex: 1 }}>
            <GlassInputBox value={input} onChange={setInput} onSend={() => handleSend()} disabled={sendingReply} onClose={() => {}} containerStyle={{ position: 'static' }} />
          </Box>
        </Box>
      </Box>

      {/* Final Interpretation Dialog */}
      <Dialog open={finalDialogOpen} onClose={() => setFinalDialogOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { background: 'linear-gradient(135deg, rgba(102,126,234,0.95) 0%, rgba(118,75,162,0.95) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', maxHeight: '80vh' } }}>
        <DialogTitle sx={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Итоговое толкование сна</span>
          <Tooltip title="Обновить толкование">
            <span>
              <IconButton onClick={handleRefreshFinal} disabled={refreshingFinal || loadingFinalInterpretation} sx={{ color: '#fff' }} size="small">
                <RefreshIcon sx={{ animation: refreshingFinal ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
              </IconButton>
            </span>
          </Tooltip>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          {loadingFinalInterpretation ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}><CircularProgress sx={{ color: '#fff' }} /></Box>
          ) : finalInterpretationText ? (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: '#fff', lineHeight: 1.6 }}>{finalInterpretationText}</Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Итоговое толкование ещё не сформировано.</Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <Button onClick={() => setFinalDialogOpen(false)} sx={{ color: '#fff' }}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};