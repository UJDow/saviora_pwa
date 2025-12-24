// DreamChat.tsx (обновлённый)
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FeedIcon from '@mui/icons-material/Feed';
import RefreshIcon from '@mui/icons-material/Refresh';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useSnackbar } from 'notistack';

import {
  getDream,
  analyzeDream,
  getChat,
  appendChat,
  clearChat,
  interpretBlock,
  interpretFinal,
  toggleMessageLike,
} from '../../utils/api';
import type { Dream } from '../../utils/api';
import type { WordBlock } from './DreamTextSelector';
import { GlassInputBox } from '../profile/GlassInputBox';
import { MoonButton } from './MoonButton';

import { useProfile } from 'src/features/profile/ProfileContext';
import { AVATAR_OPTIONS } from 'src/features/profile/ProfileEditForm';

type Role = 'user' | 'assistant';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  role: Role;
  timestamp: number;
  meta?: { kind?: string; insightLiked?: boolean } | null;
  insightLiked?: boolean;
}

const MAX_TURNS = 8;

const toTimestamp = (raw: unknown) => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
};

export const DreamChat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blockId = searchParams.get('blockId');
  const messageId = searchParams.get('messageId');

  const [dream, setDream] = useState<Dream | null>(null);
  const [currentBlock, setCurrentBlock] = useState<WordBlock | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [generatingInterpretation, setGeneratingInterpretation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const kickoffDoneRef = useRef<string | null>(null);
  const kickoffInProgressRef = useRef<boolean>(false);
  const hasScrolledToTargetRef = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);
  const skipNextFetchRef = useRef(false);
  const resolvingMessageRef = useRef(false);
  const failedMessageSearchRef = useRef<string | null>(null);

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [finalInterpretationText, setFinalInterpretationText] = useState<string>('');
  const [loadingFinalInterpretation, setLoadingFinalInterpretation] = useState(false);
  const [refreshingFinal, setRefreshingFinal] = useState(false);
  const [interpretedCount, setInterpretedCount] = useState<number>(0);

  const { enqueueSnackbar } = useSnackbar();

  const { profile, getIconComponent } = useProfile();

  const userAvatarIcon = profile?.avatarIcon ?? null;
  const userAvatarSrc = profile?.avatarImage ?? undefined;
  const UserAvatarIcon = getIconComponent(userAvatarIcon);

  type AvatarOption = (typeof AVATAR_OPTIONS)[number];

  const userAvatarBgColor =
    AVATAR_OPTIONS.find((o: AvatarOption) => o.icon === userAvatarIcon)?.color ?? '#f0f0f0';

  const accentColor = 'rgba(88, 120, 255, 0.85)';
  const glassBackground = 'rgba(255, 255, 255, 0.1)';
  const glassBorder = 'rgba(255, 255, 255, 0.2)';

  const assistantAvatarUrl = '/logo.png';

  const renderAssistantAvatar = useCallback(
    (variant: 'default' | 'interpretation' = 'default') => (
      <Avatar
        src={assistantAvatarUrl}
        alt="Dreamly Assistant"
        sx={{
          width: 36,
          height: 36,
          bgcolor: assistantAvatarUrl
            ? 'rgba(255, 255, 255, 0.08)'
            : variant === 'interpretation'
              ? 'rgba(139, 92, 246, 0.85)'
              : 'rgba(255, 255, 255, 0.3)',
          border: `1px solid ${glassBorder}`,
          boxShadow: assistantAvatarUrl ? '0 6px 18px rgba(24,32,80,0.35)' : 'none',
          '& img': { objectFit: 'cover' },
        }}
      >
        {!assistantAvatarUrl && <SmartToyIcon />}
      </Avatar>
    ),
    [assistantAvatarUrl],
  );

  const mapDbToUi = (role: Role): 'user' | 'bot' => (role === 'user' ? 'user' : 'bot');

  const getPairsCount = (msgs: Message[]) => {
    let count = 0;
    for (let i = 0; i < msgs.length - 1; i++) {
      if (msgs[i].sender === 'user' && msgs[i + 1].sender === 'bot') {
        count++;
      }
    }
    return count;
  };

  const pairs = getPairsCount(messages);
  const illumination = Math.max(0, Math.min(pairs / 7, 1));

  const handleInterpret = async () => {
    if (!dream || !currentBlock) return;

    const totalBlocks = Array.isArray(dream.blocks) ? (dream.blocks as any[]).length : 0;
    if (totalBlocks === 1) {
      window.alert('Для сновидения из 1 блока толкование блока недоступно. Используйте итоговое толкование.');
      return;
    }

    if (sendingReply || generatingInterpretation) return;

    setGeneratingInterpretation(true);
    setSendingReply(true);
    try {
      await interpretBlock(
        currentBlock.text,
        dream.id,
        currentBlock.id,
        dream.dreamSummary ?? null,
        dream.autoSummary ?? null,
      );

      const resp = await getChat(dream.id, currentBlock.id);
      const msgs = (resp.messages || []).map((m: any) => ({
        id: m.id,
        text: m.content,
        sender: mapDbToUi(m.role as Role),
        role: m.role as Role,
        timestamp: toTimestamp(m.createdAt ?? m.created_at),
        meta: m.meta ?? null,
        insightLiked: Boolean(m.meta?.insightLiked),
      })) as Message[];
      setMessages(msgs);

      await recomputeInterpretedCount();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Не удалось получить толкование блока');
    } finally {
      setSendingReply(false);
      setGeneratingInterpretation(false);
    }
  };

  const handleToggleInsight = useCallback(
    async (message: Message) => {
      const dreamId = dream?.id;
      if (!dreamId || message.role !== 'assistant') return;

      const nextLiked = !message.insightLiked;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                insightLiked: nextLiked,
                meta: m.meta ? { ...m.meta, insightLiked: nextLiked } : { insightLiked: nextLiked },
              }
            : m,
        ),
      );

      try {
        const updated = await toggleMessageLike(dreamId, message.id, nextLiked);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === updated.id
              ? {
                  ...m,
                  insightLiked: Boolean(updated.meta?.insightLiked),
                  meta: updated.meta ?? m.meta ?? null,
                }
              : m,
          ),
        );
      } catch (err: any) {
        console.error(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  insightLiked: !nextLiked,
                  meta: m.meta ? { ...m.meta, insightLiked: !nextLiked } : { insightLiked: !nextLiked },
                }
              : m,
          ),
        );
        enqueueSnackbar(err?.message ?? 'Не удалось сохранить инсайт', { variant: 'error' });
      }
    },
    [dream?.id, enqueueSnackbar],
  );

  const handleFinalInterpret = async (forceRegenerate = false) => {
    if (!dream) return;

    const totalBlocks = Array.isArray(dream.blocks) ? (dream.blocks as any[]).length : 0;

    const canFinalInterpret = totalBlocks <= 1 || (totalBlocks >= 2 && interpretedCount >= 2);
    if (!canFinalInterpret) {
      window.alert('Итоговое толкование станет доступно после интерпретации минимум двух блоков.');
      return;
    }

    if (!forceRegenerate && dream.globalFinalInterpretation) {
      setFinalInterpretationText(dream.globalFinalInterpretation);
      setFinalDialogOpen(true);
      return;
    }

    setFinalDialogOpen(true);
    setLoadingFinalInterpretation(true);

    try {
      const res = await interpretFinal(dream.dreamText, dream.blocks, dream.id);
      const text = res?.interpretation || '';
      setFinalInterpretationText(text);
      setDream((prev) => (prev ? { ...prev, globalFinalInterpretation: text } : prev));
    } catch (e: any) {
      console.error(e);
      setFinalInterpretationText('Не удалось сгенерировать итоговое толкование.');
    } finally {
      setLoadingFinalInterpretation(false);
    }
  };

  const handleRefreshFinal = async () => {
    setRefreshingFinal(true);
    setLoadingFinalInterpretation(true);
    await handleFinalInterpret(true);
    setRefreshingFinal(false);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        if (!id) {
          setError('ID сна не указан');
          return;
        }

        const found = await getDream(id);
        if (!found) {
          setError('Сон не найден');
          return;
        }
        setDream(found);

        if (found.globalFinalInterpretation) {
          setFinalInterpretationText(found.globalFinalInterpretation);
        }

        // === ИЗМЕНЕНИЕ ЛОГИКИ ===
        // Если blockId указан и найден — используем его
        if (blockId && Array.isArray(found.blocks)) {
          const block = (found.blocks as any[]).find((b: WordBlock) => b.id === blockId);
          if (block) {
            setCurrentBlock(block);
            return;
          }
        }

        // Если blockId не указан или не найден, и есть messageId — ищем блок по сообщению
        if (messageId && Array.isArray(found.blocks)) {
          let foundTargetBlock: WordBlock | null = null;
          let foundTargetMessageId: string | null = null;

          for (const rawBlock of found.blocks as any[]) {
            const candidateBlock = rawBlock as WordBlock;
            if (!candidateBlock?.id) continue;

            try {
              const resp = await getChat(found.id, candidateBlock.id);
              const candidateMessages = (resp.messages || []).map((m: any) => ({
                id: m.id,
              }));

              if (candidateMessages.some((m: any) => m.id === messageId)) {
                foundTargetBlock = candidateBlock;
                foundTargetMessageId = messageId;
                break;
              }
            } catch (innerErr) {
              console.error(`[DreamChat] Failed to load chat for block '${candidateBlock.id}':`, innerErr);
            }
          }

          if (foundTargetBlock && foundTargetMessageId) {
            // Перенаправляем на правильный blockId
            navigate(
              `/dreams/${found.id}/chat?blockId=${encodeURIComponent(foundTargetBlock.id)}&messageId=${encodeURIComponent(foundTargetMessageId)}`,
              { replace: true }
            );
            setCurrentBlock(foundTargetBlock);
            return;
          } else {
            setError(`Сообщение не найдено ни в одном блоке.`);
            enqueueSnackbar('Сообщение не найдено в блоках этого сна.', { variant: 'warning' });
            return;
          }
        }

        // Если blockId не указан и messageId тоже — ошибка
        setError('Не указан блок для анализа');
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, blockId, messageId, navigate, enqueueSnackbar]);

  useEffect(() => {
    if (messageId && !hasScrolledToTargetRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messageId]);

  useEffect(() => {
    hasScrolledToTargetRef.current = false;
    setHighlightedMessageId(null);
  }, [messageId, currentBlock?.id]);

  useEffect(() => {
    if (!messageId || messages.length === 0 || hasScrolledToTargetRef.current) return;

    const target = document.getElementById(`message-${messageId}`);
    if (!target) return;

    hasScrolledToTargetRef.current = true;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
    }, 2500);
  }, [messages, messageId]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const { prevBlock, nextBlock } = useMemo(() => {
    if (!dream || !currentBlock || !Array.isArray(dream.blocks)) {
      return { prevBlock: null as WordBlock | null, nextBlock: null as WordBlock | null };
    }
    const idx = (dream.blocks as any[]).findIndex((b: WordBlock) => b.id === currentBlock.id);
    const prev = idx > 0 ? (dream.blocks as any[])[idx - 1] : null;
    const next = idx >= 0 && idx < (dream.blocks as any[]).length - 1 ? (dream.blocks as any[])[idx + 1] : null;
    return { prevBlock: prev, nextBlock: next };
  }, [dream, currentBlock]);

  useEffect(() => {
    (async () => {
      if (!dream || !currentBlock) return;

      if (skipNextFetchRef.current) {
        skipNextFetchRef.current = false;
        return;
      }

      try {
        setError(null);
        setMessagesLoading(true);

        const resp = await getChat(dream.id, currentBlock.id);
        const msgs = (resp.messages || []).map((m: any) => ({
          id: m.id,
          text: m.content,
          sender: mapDbToUi(m.role as Role),
          role: m.role as Role,
          timestamp: toTimestamp(m.createdAt ?? m.created_at),
          meta: m.meta ?? null,
          insightLiked: Boolean(m.meta?.insightLiked),
        })) as Message[];
        setMessages(msgs);

        if (msgs.length === 0 && kickoffDoneRef.current !== currentBlock.id && !kickoffInProgressRef.current && !sendingReply) {
          setSendingReply(true);
          await runKickoff();
        }
      } catch (e: any) {
        setError(e.message || 'Не удалось загрузить историю');
      } finally {
        setMessagesLoading(false);
      }
    })();
  }, [dream?.id, currentBlock?.id, sendingReply]);

  useEffect(() => {
    (async () => {
      await recomputeInterpretedCount();
    })();
  }, [dream?.id, dream?.blocks]);

  async function recomputeInterpretedCount() {
    if (!dream?.id || !Array.isArray(dream.blocks)) {
      setInterpretedCount(0);
      return;
    }

    try {
      const blocksArr = dream.blocks as any[];
      const results = await Promise.all(
        blocksArr.map(async (b: any) => {
          try {
            const resp = await getChat(dream.id, b.id);
            const interpreted = (resp.messages || []).some(
              (m: any) => m.role !== 'user' && m.meta?.kind === 'block_interpretation',
            );
            return interpreted ? 1 : 0;
          } catch {
            return 0;
          }
        }),
      );
      const total = results.reduce((sum: number, part: number) => sum + part, 0);
      setInterpretedCount(total);
    } catch {
      setInterpretedCount(0);
    }
  }

  const runKickoff = async () => {
    if (!dream || !currentBlock) return;
    if (kickoffDoneRef.current === currentBlock.id) return;
    if (kickoffInProgressRef.current) return;
    if (sendingReply) return;

    kickoffInProgressRef.current = true;
    setSendingReply(true);

    try {
      const kickoffInstruction =
        'Сформулируй один первый вопрос для начала анализа этого фрагмента сна. ' +
        'Тон: тёплый, поддерживающий, без преамбулы, без списков. Коротко (1–2 предложения).';

      const response = await analyzeDream(
        currentBlock.text,
        [],
        kickoffInstruction,
        dream.id,
        currentBlock.id,
        dream.dreamSummary ?? null,
        dream.autoSummary ?? null,
      );

      const assistantText =
        response?.choices?.[0]?.message?.content ||
        'Готов начать. Что в этом фрагменте кажется вам самым важным?';

      const saved = await appendChat({
        dreamId: dream.id,
        blockId: currentBlock.id,
        role: 'assistant',
        content: assistantText,
      });

      setMessages([
        {
          id: saved.id,
          text: saved.content,
          sender: 'bot',
          role: 'assistant',
          timestamp: toTimestamp(saved.createdAt ?? saved.createdAt),
          meta: saved.meta ?? null,
          insightLiked: Boolean(saved.meta?.insightLiked),
        },
      ]);

      kickoffDoneRef.current = currentBlock.id;
    } catch (e: any) {
      setError(e.message || 'Не удалось начать диалог');
    } finally {
      kickoffInProgressRef.current = false;
      setSendingReply(false);
    }
  };

  const handleSend = async (forcedUserText?: string) => {
    if ((!input.trim() && !forcedUserText) || !currentBlock || !dream) return;

    const textToSend = (forcedUserText ?? input).trim();
    if (!textToSend) return;

    setSendingReply(true);
    try {
      const savedUser = await appendChat({
        dreamId: dream.id,
        blockId: currentBlock.id,
        role: 'user',
        content: textToSend,
      });

      const nextMessages = [
        ...messages,
        {
          id: savedUser.id,
          text: savedUser.content,
          sender: 'user' as const,
          role: 'user' as const,
          timestamp: toTimestamp(savedUser.createdAt ?? savedUser.createdAt),
          meta: savedUser.meta ?? null,
          insightLiked: Boolean(savedUser.meta?.insightLiked),
        },
      ];

      setMessages(nextMessages);
      if (!forcedUserText) setInput('');

      const lastTurns = nextMessages.slice(-MAX_TURNS).map((m) => ({
        role: m.role ?? (m.sender === 'user' ? 'user' : 'assistant'),
        content: m.text,
      }));

      const ai = await analyzeDream(
        currentBlock.text,
        lastTurns,
        undefined,
        dream.id,
        currentBlock.id,
        dream.dreamSummary ?? null,
        dream.autoSummary ?? null,
      );

      const assistantText = ai?.choices?.[0]?.message?.content || 'Понял(а). Продолжим.';

      const savedAssistant = await appendChat({
        dreamId: dream.id,
        blockId: currentBlock.id,
        role: 'assistant',
        content: assistantText,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: savedAssistant.id,
          text: savedAssistant.content,
          sender: 'bot',
          role: 'assistant',
          timestamp: toTimestamp(savedAssistant.createdAt ?? savedAssistant.createdAt),
          meta: savedAssistant.meta ?? null,
          insightLiked: Boolean(savedAssistant.meta?.insightLiked),
        },
      ]);
    } catch (e: any) {
      setError(e.message || 'Ошибка отправки сообщения');
    } finally {
      setSendingReply(false);
    }
  };

  const handleClear = async () => {
    if (!dream || !currentBlock) return;
    try {
      setSendingReply(true);
      await clearChat(dream.id, currentBlock.id);
      setMessages([]);
      kickoffDoneRef.current = null;
      await runKickoff();
      await recomputeInterpretedCount();
    } catch (e: any) {
      setError(e.message || 'Не удалось очистить чат');
    } finally {
      setSendingReply(false);
    }
  };

  const navigateToBlock = (targetBlock?: WordBlock | null) => {
    if (!targetBlock) return;
    navigate(`/dreams/${id}/chat?blockId=${encodeURIComponent(targetBlock.id)}`);
  };

  const totalBlocks = useMemo(
    () => (Array.isArray(dream?.blocks) ? (dream!.blocks as any[]).length : 0),
    [dream?.blocks],
  );

  const canInterpretThisBlock = totalBlocks !== 1;
  const canFinalInterpret = totalBlocks <= 1 || (totalBlocks >= 2 && interpretedCount >= 2);
  const showFinalInterpretationIcon =
    dream?.globalFinalInterpretation !== null && dream?.globalFinalInterpretation !== undefined;

  const isKickoffActive = sendingReply || messagesLoading || kickoffInProgressRef.current;

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <CircularProgress sx={{ color: '#fff' }} />
      </Box>
    );
  }

  if (error || !dream || !currentBlock) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
          {error || 'Данные не загружены'}
        </Alert>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: '#fff' }}>
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          background: glassBackground,
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${glassBorder}`,
          p: 2,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <IconButton
  onClick={() => navigate(-1)}
  sx={{ color: '#fff', mr: 1 }}
  aria-label="Назад"
>
  <ArrowBackIosNewIcon />
</IconButton>
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
                {dream.title || 'Анализ сновидения'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
              {showFinalInterpretationIcon && (
                <Tooltip title="Показать итоговое толкование">
                  <IconButton
                    onClick={() => handleFinalInterpret(false)}
                    sx={{ color: '#fff' }}
                    aria-label="Показать итоговое толкование"
                  >
                    <FeedIcon />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Очистить чат">
                <span>
                  <IconButton
                    onClick={handleClear}
                    sx={{ color: '#fff' }}
                    aria-label="Очистить чат"
                    disabled={sendingReply}
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
                {headerExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          <Collapse in={headerExpanded}>
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 1.25,
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${glassBorder}`,
                borderRadius: 2,
              }}
            >
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Анализируемый блок:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#fff',
                  mt: 0.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {currentBlock.text}
              </Typography>

              {(prevBlock || nextBlock) && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: prevBlock && nextBlock ? '1fr 1fr' : '1fr' },
                    gap: 1,
                    mt: 1.25,
                  }}
                >
                  {prevBlock && (
                    <Card
                      elevation={0}
                      sx={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: `1px solid ${glassBorder}`,
                        borderRadius: 2,
                        color: '#fff',
                      }}
                    >
                      <CardActionArea onClick={() => navigateToBlock(prevBlock)}>
                        <CardContent
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 0.75,
                            py: 0.6,
                            px: 1,
                          }}
                        >
                          <Tooltip title="Предыдущий блок">
                            <ArrowBackIcon sx={{ opacity: 0.9, fontSize: 18, mt: '2px' }} />
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
                            {prevBlock.text}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  )}

                  {nextBlock && (
                    <Card
                      elevation={0}
                      sx={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: `1px solid ${glassBorder}`,
                        borderRadius: 2,
                        color: '#fff',
                      }}
                    >
                      <CardActionArea onClick={() => navigateToBlock(nextBlock)}>
                        <CardContent
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 0.75,
                            py: 0.6,
                            px: 1,
                          }}
                        >
                          <Tooltip title="Следующий блок">
                            <ArrowForwardIcon sx={{ opacity: 0.9, fontSize: 18, mt: '2px' }} />
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
                            {nextBlock.text}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  )}
                </Box>
              )}
            </Paper>
          </Collapse>
        </Box>
      </Paper>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          pb: 12,
          maxWidth: 800,
          mx: 'auto',
          width: '100%',
        }}
      >
        {messages.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              mt: 8,
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            {isKickoffActive ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Avatar src={assistantAvatarUrl} alt="Assistant" sx={{ width: 56, height: 56, border: `1px solid ${glassBorder}` }}>
                  {!assistantAvatarUrl && <SmartToyIcon />}
                </Avatar>

                <Paper elevation={0} sx={{ mt: 1.25, p: 1, borderRadius: 2, background: 'rgba(255,255,255,0.06)', border: `1px solid ${glassBorder}`, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} sx={{ color: '#fff' }} />
                  <Typography variant="body2" sx={{ color: '#fff' }}>Ассистент формулирует первый вопрос…</Typography>
                </Paper>

                <Typography variant="caption" sx={{ mt: 0.5, color: 'rgba(255,255,255,0.75)' }}>Подождите, пожалуйста</Typography>
              </Box>
            ) : (
              <>
                <SmartToyIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                <Typography variant="h6">Начинаем диалог…</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Ассистент формулирует первый вопрос
                </Typography>
              </>
            )}
          </Box>
        ) : (
          messages.map((msg) => {
            const isInterpretation = msg.sender === 'bot' && msg.meta?.kind === 'block_interpretation';
            const isAssistant = msg.role === 'assistant';
            const isHighlighted = highlightedMessageId === msg.id;

            return (
              <Box
                key={msg.id}
                id={`message-${msg.id}`}
                sx={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2,
                  animation: 'fadeIn 0.3s ease-in',
                  '@keyframes fadeIn': {
                    from: { opacity: 0, transform: 'translateY(10px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    maxWidth: '75%',
                    flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  {msg.sender === 'user' ? (
  <Avatar
    src={userAvatarSrc}
    sx={{
      width: 36,
      height: 36,
      bgcolor: userAvatarSrc ? undefined : userAvatarBgColor,
      color: '#fff',
      boxShadow: '0 4px 16px rgba(24,32,80,0.35)',
      border: `1px solid ${glassBorder}`,
    }}
  >
    {!userAvatarSrc && UserAvatarIcon && <UserAvatarIcon sx={{ fontSize: 20 }} />}
  </Avatar>
) : (
  renderAssistantAvatar(isInterpretation ? 'interpretation' : 'default')
)}

                  <Box
                    sx={{ position: 'relative', cursor: isAssistant ? 'pointer' : 'default' }}
                    onDoubleClick={() => {
                      if (isAssistant) handleToggleInsight(msg);
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
                              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)'
                              : 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        border: isInterpretation
                          ? '1px solid rgba(139, 92, 246, 0.4)'
                          : `1px solid ${glassBorder}`,
                        color: '#fff',
                        boxShadow: isHighlighted
                          ? '0 0 12px rgba(255, 255, 255, 0.45)'
                          : isInterpretation
                            ? '0 4px 12px rgba(139, 92, 246, 0.2)'
                            : 'none',
                        outline: isHighlighted ? '2px solid rgba(255,255,255,0.8)' : 'none',
                        transition: 'box-shadow 0.3s ease, outline 0.3s ease',
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
                            background: 'rgba(139, 92, 246, 0.25)',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                          }}
                        >
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'rgba(139, 92, 246, 0.9)',
                              boxShadow: '0 0 8px rgba(139, 92, 246, 0.6)',
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 600,
                              letterSpacing: 0.3,
                              color: 'rgba(255, 255, 255, 0.95)',
                              textTransform: 'uppercase',
                              fontSize: '0.7rem',
                            }}
                          >
                            Толкование блока
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
                      <Tooltip title={msg.insightLiked ? 'Убрать из инсайтов' : 'Сохранить инсайт'}>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleInsight(msg);
                          }}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: -12,
                            color: msg.insightLiked ? 'rgba(255,100,150,0.95)' : 'rgba(255,255,255,0.6)',
                            '&:hover': {
                              color: 'rgba(255,100,150,1)',
                              backgroundColor: 'rgba(255,255,255,0.08)',
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
        {generatingInterpretation && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {renderAssistantAvatar('interpretation')}
              <Paper
                elevation={0}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CircularProgress size={20} sx={{ color: 'rgba(139, 92, 246, 0.9)' }} />
                <Typography variant="body2" sx={{ color: '#fff' }}>
                  Формирую толкование блока...
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}
        {sendingReply && !generatingInterpretation && messages.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {renderAssistantAvatar()}
              <Paper
                elevation={0}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${glassBorder}`,
                }}
              >
                <CircularProgress size={20} sx={{ color: '#fff' }} />
              </Paper>
            </Box>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          background: 'linear-gradient(to top, rgba(102, 126, 234, 0.3), transparent)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: 800, mx: 'auto' }}>
          <MoonButton
            illumination={illumination}
            onInterpret={handleInterpret}
            onFinalInterpret={() => handleFinalInterpret(false)}
            disabled={sendingReply || !canInterpretThisBlock}
            direction="waxing"
            size={32}
          />
          <Box sx={{ flex: 1 }}>
            <GlassInputBox
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              disabled={sendingReply}
              onClose={() => {}}
              containerStyle={{
                position: 'static',
                margin: '0 auto',
              }}
            />
          </Box>
        </Box>
      </Box>

      <Dialog
        open={finalDialogOpen}
        onClose={() => setFinalDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            maxHeight: '80vh',
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
          }}
        >
          <span>Итоговое толкование сна</span>
          <Tooltip title="Обновить толкование">
            <span>
              <IconButton
                onClick={handleRefreshFinal}
                disabled={refreshingFinal || loadingFinalInterpretation || !canFinalInterpret}
                sx={{
                  color: '#fff',
                  '&:hover': { background: 'rgba(255, 255, 255, 0.1)' },
                }}
                size="small"
              >
                <RefreshIcon
                  sx={{
                    animation: refreshingFinal ? 'spin 1s linear infinite' : 'none',
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
        <DialogContent dividers sx={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
          {loadingFinalInterpretation ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#fff' }} />
            </Box>
          ) : finalInterpretationText ? (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: '#fff', lineHeight: 1.6 }}>
              {finalInterpretationText}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Итоговое толкование ещё не сформировано.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
          <Button onClick={() => setFinalDialogOpen(false)} sx={{ color: '#fff' }}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};