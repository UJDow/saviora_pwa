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
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FeedIcon from '@mui/icons-material/Feed';
import RefreshIcon from '@mui/icons-material/Refresh';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useSnackbar } from 'notistack'; // Предполагается, что используется notistack

import * as api from '../../utils/api';
import { useAuth } from '../../features/auth/useAuth';
import { GlassInputBox } from '../profile/GlassInputBox';
import { MoonButton } from 'src/features/dreams/MoonButton'; // Предполагается, что компонент доступен

import { useProfile } from 'src/features/profile/ProfileContext';
import { AVATAR_OPTIONS } from 'src/features/profile/ProfileEditForm';

// type-only imports (verbatimModuleSyntax friendly)
import type {
  DailyConvoMessage as DailyConvoMessageType,
  UUID,
} from './types';

// import API types for compatibility
import type { DailyConvo as ApiDailyConvo, ChatMessage as ApiChatMessage } from '../../utils/api';

type Props = {
  dailyConvoId?: string;
  initialConvo?: ApiDailyConvo | null;
};

type UIMessage = DailyConvoMessageType;

const normalizeMessageContent = (value: unknown): string => {
  const seen = new WeakSet<object>();

  const visit = (input: unknown): string => {
    if (input == null) {
      return '';
    }

    if (typeof input === 'string') {
      return input;
    }

    if (typeof input === 'number' || typeof input === 'boolean') {
      return String(input);
    }

    if (Array.isArray(input)) {
      return input
        .map((item) => visit(item))
        .filter((fragment) => typeof fragment === 'string' && fragment.trim().length > 0)
        .join('\n')
        .trim();
    }

    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>;

      if (seen.has(obj)) {
        return '';
      }
      seen.add(obj);

      const candidateKeys: (keyof typeof obj)[] = ['text', 'content', 'value', 'message', 'data', 'body'];
      for (const key of candidateKeys) {
        if (key in obj) {
          const result = visit(obj[key]);
          if (result) {
            return result;
          }
        }
      }

      if ('parts' in obj) {
        const result = visit(obj.parts);
        if (result) {
          return result;
        }
      }

      if ('segments' in obj) {
        const result = visit(obj.segments);
        if (result) {
          return result;
        }
      }

      if ('choices' in obj) {
        const result = visit(obj.choices);
        if (result) {
          return result;
        }
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

export default function DailyConvoChat({ dailyConvoId: propId, initialConvo = null }: Props) {
  const params = useParams<{ id?: string }>();
  const location = useLocation(); // Для получения state с highlightMessageId
  const navigate = useNavigate();
  useAuth();
  const { enqueueSnackbar } = useSnackbar(); // Используем notistack для уведомлений

  const idFromUrl = params?.id;
  const convoId = propId ?? idFromUrl;

  const [convo, setConvo] = useState<ApiDailyConvo | null>(initialConvo);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const messagesRef = useRef<UIMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const [input, setInput] = useState('');
  const [loadingConvo, setLoadingConvo] = useState<boolean>(false);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [finalInterpretationOpen, setFinalInterpretationOpen] = useState(false);
  const [finalInterpretationText, setFinalInterpretationText] = useState('');
  const [loadingFinalInterpretation, setLoadingFinalInterpretation] = useState(false);
  const [refreshingFinal, setRefreshingFinal] = useState(false); // Для спиннера обновления

  const [generatingBlockInterpretation, setGeneratingBlockInterpretation] = useState(false); // Новое состояние

  const kickoffDoneRef = useRef(false);
  const kickoffInProgressRef = useRef(false);

  const { profile, getIconComponent } = useProfile();

  const userAvatarIcon = profile?.avatarIcon ?? null;
  const userAvatarSrc = profile?.avatarImage ?? undefined;
  const UserAvatarIcon = getIconComponent(userAvatarIcon);

  type AvatarOption = (typeof AVATAR_OPTIONS)[number];

  const userAvatarBgColor =
    AVATAR_OPTIONS.find((o: AvatarOption) => o.icon === userAvatarIcon)?.color ?? '#f0f0f0';

  // Для подсветки сообщения
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const hasScrolledToTargetRef = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);

  // Получаем messageId из location.state или searchParams для подсветки
  const highlightMessageIdFromState = (location.state as any)?.highlightMessageId || null;

  const toTimestamp = useCallback((isoOrNumber: string | number) => {
    const n = typeof isoOrNumber === 'number' ? isoOrNumber : Date.parse(String(isoOrNumber));
    return Number.isNaN(n) ? Date.now() : n;
  }, []);

  // Устойчивое маппирование API-сообщения в UI
  const mapApiMessageToUI = useCallback((m: any): UIMessage => {
    const createdRaw = m.createdAt ?? m.created_at ?? m.created_at_ms ?? m.createdAtMs ?? null;
    const meta = m.meta ?? m.metadata ?? null;
    const insightLiked = Boolean(m.insightLiked ?? meta?.insightLiked ?? m.insight_liked ?? false);

    const rawContent =
      m.content ??
      m.text ??
      m.message ??
      m.delta ??
      m.value ??
      m.body ??
      (typeof m.data === 'object' && m.data ? (m.data as Record<string, unknown>).content : undefined) ??
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
  }, [toTimestamp]);

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
          'daily_chat', // blockId для DailyConvoChat
          convo.autoSummary ?? null,
          convo.context ?? null
        );
        const assistantText = extractAiText(ai) ?? 'Привет — расскажи, как прошёл твой день?';

        if (!convo.id) throw new Error('Отсутствует id записи для сохранения ответа');

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
        setError(`Не удалось автоматически начать разговор: ${e.message || String(e)}`);

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
        // добавим пользователя локально (синхронно)
        setMessages((prev) => [...prev, savedUserUI]);
        if (!forcedText) setInput('');

        // берем актуальную историю из рефа
        const currentMessages = messagesRef.current;
        const latestMessages = [...currentMessages, savedUserUI];
        const lastTurns = latestMessages.slice(-10).map((m) => ({ role: m.role, content: m.text }));

        const notesText = convo.notes ?? convo.body ?? '';
        const ai = await api.analyzeDailyConvo(
          notesText,
          lastTurns,
          undefined,
          convo.id,
          'daily_chat', // blockId для DailyConvoChat
          convo.autoSummary ?? null,
          convo.context ?? null
        );
        const assistantText = extractAiText(ai) ?? 'Понял(а). Продолжим.';

        const savedAssistant = await api.appendDailyConvoChat({
          dailyConvoId: convo.id,
          role: 'assistant',
          content: assistantText,
        });

        const savedAssistantUI = mapApiMessageToUI(savedAssistant as ApiChatMessage);
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
      setRefreshingFinal(forceRegenerate); // Активируем спиннер обновления

      try {
        const notesText = convo.notes ?? convo.body ?? '';
        const res = await api.interpretFinalDailyConvo(notesText, convo.id, convo.autoSummary ?? null, convo.context ?? null);
        const text = res?.interpretation ?? '';
        setFinalInterpretationText(text);
        setConvo((prev) => (prev ? { ...prev, globalFinalInterpretation: text } : prev));
      } catch (e: any) {
        console.error('handleFinalInterpret error', e);
        setFinalInterpretationText('Не удалось сгенерировать итоговое толкование.');
        setError(`Ошибка генерации итога: ${e.message || String(e)}`);
        enqueueSnackbar(e.message || 'Ошибка генерации итога', { variant: 'error' }); // Уведомление
      } finally {
        setLoadingFinalInterpretation(false);
        setRefreshingFinal(false);
      }
    },
    [convo, enqueueSnackbar], // Добавляем enqueueSnackbar в зависимость
  );

  const handleInterpretBlock = useCallback(async () => {
    if (!convo || sending || generatingBlockInterpretation) return;

    setGeneratingBlockInterpretation(true);
    setSending(true);
    setError(null);

    try {
      // Берем весь диалог для интерпретации блока
      const fullDialogText = messagesRef.current.map(m => `${m.sender}: ${m.text}`).join('\n');

      if (!fullDialogText) {
        enqueueSnackbar('Нет сообщений для интерпретации', { variant: 'warning' });
        return;
      }

      const res = await api.interpretBlockDailyConvo(
        fullDialogText,
        convo.id,
        'dialog', // blockType для DailyConvoChat
        convo.autoSummary ?? null,
        convo.context ?? null
      );

      const interpretationText = res?.interpretation ?? 'Толкование не получено.';

      const saved = await api.appendDailyConvoChat({
        dailyConvoId: convo.id,
        role: 'assistant',
        content: interpretationText,
        meta: { kind: 'block_interpretation' },
      });

      const savedUI = mapApiMessageToUI(saved as ApiChatMessage);
      setMessages(prev => [...prev, savedUI]);
    } catch (e: any) {
      console.error('handleInterpretBlock error', e);
      setError(`Ошибка интерпретации: ${e.message || String(e)}`);
      enqueueSnackbar(e.message || 'Ошибка интерпретации блока', { variant: 'error' });
    } finally {
      setSending(false);
      setGeneratingBlockInterpretation(false);
    }
  }, [convo, sending, generatingBlockInterpretation, messagesRef, mapApiMessageToUI, enqueueSnackbar]);


  const toggleLike = useCallback(
    async (messageId: UUID, liked: boolean, blockId?: string) => {
      if (!convo) return;
      try {
        // Оптимистичное обновление UI
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  insightLiked: liked,
                  meta: m.meta ? { ...m.meta, insightLiked: liked } : { insightLiked: liked },
                }
              : m
          )
        );

        await api.toggleDailyConvoMessageLike(convo.id, messageId, liked, blockId);
        
        // Уведомление об успешном сохранении
        enqueueSnackbar(liked ? 'Инсайт сохранён' : 'Инсайт удалён', { variant: 'success' });
      } catch (e: any) {
        console.error('toggleLike error', e);
        // Откат оптимистичного обновления в случае ошибки
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  insightLiked: !liked, // Возвращаем предыдущее состояние
                  meta: m.meta ? { ...m.meta, insightLiked: !liked } : { insightLiked: !liked },
                }
              : m
          )
        );
        setError(`Не удалось изменить лайк инсайта: ${e.message || String(e)}`);
        enqueueSnackbar(e.message || 'Ошибка при сохранении инсайта', { variant: 'error' });
      }
    },
    [convo, enqueueSnackbar], // Добавляем enqueueSnackbar в зависимость
  );


  // Эффект для прокрутки к подсвеченному сообщению
  useEffect(() => {
    // Сброс при изменении ID сообщения
    hasScrolledToTargetRef.current = false;
    setHighlightedMessageId(null);
  }, [highlightMessageIdFromState]);

  useEffect(() => {
    if (!highlightMessageIdFromState || messages.length === 0 || hasScrolledToTargetRef.current) return;

    const targetElement = document.getElementById(`message-${highlightMessageIdFromState}`);
    if (!targetElement) return;

    hasScrolledToTargetRef.current = true;
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setHighlightedMessageId(highlightMessageIdFromState);

    // Автоматическое снятие подсветки через 2.5 секунды
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === highlightMessageIdFromState ? null : prev));
    }, 2500);

  }, [messages, highlightMessageIdFromState]);

  // Очистка таймаута при размонтировании
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
    const d = rawDate ? new Date(toTimestamp(rawDate as string | number)) : null;
    return d ? d.toLocaleString('ru-RU') : ''; // Локализация даты
  }, [convo, toTimestamp]);

  // Ссылка для прокрутки вниз
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Градиентный фон и стили
  const accentColor = 'rgba(88, 120, 255, 0.85)';
  const glassBackground = 'rgba(255, 255, 255, 0.1)';
  const glassBorder = 'rgba(255, 255, 255, 0.2)';
  const assistantAvatarUrl = '/logo.png'; // Замените на актуальный логотип, если есть

  const renderAssistantAvatar = useCallback(
    (variant: 'default' | 'interpretation' = 'default') => (
      <Avatar
        src={assistantAvatarUrl}
        alt="Daily Assistant"
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

  // Иллюминация для MoonButton (простая реализация)
  const pairs = messages.filter(m => m.sender === 'user').length; // Пример: считаем пары по сообщениям пользователя
  const illumination = Math.max(0, Math.min(pairs / 7, 1)); 

  if (loadingConvo) {
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

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 600, mx: 'auto', mt: 4, color: '#fff', bgcolor: 'rgba(255, 0, 0, 0.2)' }}>
          {error}
          <Button onClick={() => { setError(null); void fetchMessages(); }} sx={{ ml: 2, color: '#fff' }}>
            Повторить
          </Button>
        </Alert>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: '#fff' }}>
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
        }}
      >
        <Alert severity="info" sx={{ maxWidth: 600, mx: 'auto', mt: 4, color: '#fff', bgcolor: 'rgba(255, 255, 255, 0.1)' }}>
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
       {/* Шапка */}
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
        <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
           <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <IconButton
              onClick={() => navigate('/daily')}
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
                {convo?.title ?? 'Разговор о дне'}
              </Typography>
               <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {formattedDate}
              </Typography>
              {convo?.context && (
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}>
                  Контекст: {convo.context}
                </Typography>
              )}
            </Box>
          </Box>
          
          <Tooltip title="Итоговое толкование">
             <span>
              <IconButton
                onClick={() => handleFinalInterpret(false)}
                sx={{ color: '#fff' }}
                aria-label="Итоговое толкование"
                disabled={!convo}
              >
                <FeedIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Paper>

       {/* Область сообщений */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          pb: 12, // Отступ снизу для поля ввода
          maxWidth: 800,
          mx: 'auto',
          width: '100%',
        }}
      >
         {loadingMessages ? (
          <Box
            sx={{
              textAlign: 'center',
              mt: 8,
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            <CircularProgress sx={{ color: '#fff', mb: 2 }} />
            <Typography variant="body2">Загрузка сообщений...</Typography>
          </Box>
        ) : messages.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              mt: 8,
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            <SmartToyIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
            <Typography variant="h6">Начинаем диалог…</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Ассистент формулирует первый вопрос
            </Typography>
          </Box>
        ) : (
          messages.map((msg) => {
            const isHighlighted = highlightedMessageId === msg.id;
            const isAssistant = msg.role === 'assistant';
            const isInterpretation = msg.meta?.kind === 'block_interpretation'; // Проверяем тип сообщения

            return (
              <Box
                key={msg.id}
                id={`message-${msg.id}`} // ID для прокрутки
                sx={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2,
                  animation: 'fadeIn 0.3s ease-in', // Анимация появления
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
    {!userAvatarSrc && <UserAvatarIcon sx={{ fontSize: 20 }} />}
  </Avatar>
) : (
  renderAssistantAvatar(isInterpretation ? 'interpretation' : 'default')
)}

                  <Box
                    sx={{ position: 'relative', cursor: isAssistant ? 'pointer' : 'default' }}
                    onDoubleClick={() => {
                      if (isAssistant) toggleLike(msg.id as UUID, !Boolean(msg.insightLiked ?? msg.meta?.insightLiked));
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
                            : isInterpretation // Изменяем фон для интерпретации
                              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)'
                              : 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        border: isInterpretation // Изменяем границу для интерпретации
                          ? '1px solid rgba(139, 92, 246, 0.4)'
                          : `1px solid ${glassBorder}`,
                        color: '#fff',
                        boxShadow: isHighlighted
                          ? '0 0 12px rgba(255, 255, 255, 0.45)' // Эффект подсветки
                          : isInterpretation // Добавляем тень для интерпретации
                            ? '0 4px 12px rgba(139, 92, 246, 0.2)'
                            : 'none',
                        outline: isHighlighted ? '2px solid rgba(255,255,255,0.8)' : 'none',
                        transition: 'box-shadow 0.3s ease, outline 0.3s ease',
                      }}
                    >
                       {isInterpretation && ( // Метка "Толкование"
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
                      <Tooltip title={msg.insightLiked ? 'Убрать из инсайтов' : 'Сохранить инсайт'}>
                         <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleLike(msg.id as UUID, !Boolean(msg.insightLiked ?? msg.meta?.insightLiked));
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
        {/* Индикатор генерации толкования */}
        {generatingBlockInterpretation && (
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
                  Формирую толкование...
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}
        {/* Индикатор отправки */}
        {sending && !generatingBlockInterpretation && messages.length > 0 && (
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
        <div ref={messagesEndRef} /> {/* Элемент для прокрутки вниз */}
      </Box>

       {/* Футер с полем ввода */}
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
            onInterpret={handleInterpretBlock} // Вызываем новую функцию
            onFinalInterpret={() => handleFinalInterpret(false)}
            disabled={sending || generatingBlockInterpretation} // Отключаем кнопку во время генерации
            direction="waxing"
            size={32}
          />
          <Box sx={{ flex: 1 }}>
            <GlassInputBox
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              disabled={sending || generatingBlockInterpretation} // Отключаем поле ввода
              onClose={() => {}} 
              containerStyle={{
                position: 'static',
                margin: '0 auto',
              }}
            />
          </Box>
        </Box>
      </Box>

       {/* Модальное окно итогового толкования */}
      <Dialog
        open={finalInterpretationOpen}
        onClose={() => setFinalInterpretationOpen(false)}
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
          <span>Итоговое толкование дня</span>
          <Tooltip title="Обновить толкование">
             <span>
              <IconButton
                onClick={() => handleFinalInterpret(true)}
                disabled={refreshingFinal || loadingFinalInterpretation}
                sx={{
                  color: '#fff',
                  '&:hover': { background: 'rgba(255, 255, 255, 0.1)' },
                }}
                size="small"
              >
                 <RefreshIcon
                  sx={{
                    animation: refreshingFinal ? 'spin 1s linear infinite' : 'none', // Анимация спиннера
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
          <Button onClick={() => setFinalInterpretationOpen(false)} sx={{ color: '#fff' }}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

       {/* Snackbar для уведомлений (если не используется глобально) */}
       {/* <Snackbar ... /> */}
    </Box>
  );
}