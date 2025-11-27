import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  Autocomplete,
  Paper,
  Chip,
  Avatar,
  Tooltip,
  Badge,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete'; // Эта иконка используется для удаления сна
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
// import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'; // Удалён импорт DeleteSweepRoundedIcon
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'; // Добавлен импорт DeleteOutlineIcon
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FavoriteIcon from '@mui/icons-material/Favorite';
import InsightsIcon from '@mui/icons-material/Insights';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  updateDream,
  deleteDream as apiDeleteDream,
  getDreams,
  generateAutoSummary,
  getDreamInsights,
} from '../../utils/api';
import type { Dream, DreamInsight } from '../../utils/api';
import { DreamBlocks } from './DreamBlocks';
import type { WordBlock } from './DreamTextSelector';

type EnrichedDreamInsight = DreamInsight & {
  insightLiked?: boolean;
  meta?: Record<string, unknown>;
};

const categories = [
  'Яркий',
  'Тревожный',
  'Спокойный',
  'Повторяющийся',
  'Ночной кошмар',
  'Осознанный',
  'Другой',
];

const stringifyId = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const ensureIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
};

const toBooleanFlag = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number(value) === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'да'].includes(normalized);
  }
  return false;
};

const extractPlainText = (value: unknown, seen = new WeakSet<object>()) => {
  const fragments: string[] = [];

  const push = (str: string) => {
    const trimmed = str.trim();
    if (!trimmed) return;
    if (!fragments.includes(trimmed)) {
      fragments.push(trimmed);
    }
  };

  const visit = (node: unknown) => {
    if (node == null) return;

    const type = typeof node;

    if (type === 'string') {
      push(node as string);
      return;
    }

    if (type === 'number' || type === 'boolean' || type === 'bigint') {
      push(String(node));
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (type === 'object') {
      const obj = node as Record<string, unknown>;
      if (seen.has(obj)) return;
      seen.add(obj);

      const priorityKeys = [
        'text',
        'content',
        'message',
        'summary',
        'output',
        'outputText',
        'outputTextChunks',
        'chunks',
        'parts',
        'messages',
        'data',
        'value',
        'response',
        'body',
        'payload',
        'suggestion',
        'details',
      ];

      for (const key of priorityKeys) {
        if (key in obj) visit(obj[key]);
      }

      for (const val of Object.values(obj)) {
        if (typeof val === 'string') {
          push(val);
        } else if (typeof val === 'object') {
          visit(val);
        }
      }
    }
  };

  visit(value);
  return fragments.join('\n');
};

const parseMetaObject = (raw: unknown): Record<string, any> => {
  if (!raw || typeof raw !== 'object') {
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
};

const normalizeInsightMeta = (entry: any): Record<string, any> => {
  const primaryMeta = parseMetaObject(entry.meta);
  const fallbackMeta = parseMetaObject(entry.metadata);

  const meta: Record<string, any> = {
    ...fallbackMeta,
    ...primaryMeta,
  };

  const textCandidate = extractPlainText(
    meta.text ??
      meta.content ??
      meta.response ??
      meta.output ??
      meta.body ??
      meta.data ??
      entry.text ??
      entry.content ??
      entry.message ??
      entry.summary,
  );

  if (textCandidate) {
    meta.text = textCandidate;
  }

  const likedCandidate =
    meta.insightLiked ??
    entry.insightLiked ??
    entry.liked ??
    entry.favorite ??
    entry.isInsight ??
    entry.isFavorite;

  meta.insightLiked = toBooleanFlag(likedCandidate);

  return meta;
};

const extractArrayFromPayload = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const preferredKeys = ['insights', 'items', 'data', 'results', 'records', 'messages', 'rows'];
  const visited = new Set<object>();
  const queue: unknown[] = [payload];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    if (Array.isArray(current)) return current;
    if (typeof current !== 'object') continue;

    const obj = current as Record<string, unknown>;
    if (visited.has(obj)) continue;
    visited.add(obj);

    for (const key of preferredKeys) {
      if (key in obj) {
        queue.unshift(obj[key]);
      }
    }

    for (const value of Object.values(obj)) {
      queue.push(value);
    }
  }

  return [];
};

const mapToInsight = (entry: any): EnrichedDreamInsight | null => {
  if (!entry || typeof entry !== 'object') return null;

  const meta = normalizeInsightMeta(entry);

  const messageIdRaw =
    entry.messageId ??
    entry.message_id ??
    entry.id ??
    entry.message?.id ??
    meta.messageId ??
    meta.message_id ??
    null;

  const text = extractPlainText(
    entry.text ??
      entry.content ??
      entry.message ??
      entry.summary ??
      meta.text ??
      meta.content ??
      meta.response ??
      meta.output ??
      meta.data ??
      meta.body ??
      '',
  );

  if (!messageIdRaw || !text) return null;

  const blockIdRaw =
    entry.blockId ??
    entry.block_id ??
    entry.block?.id ??
    meta.blockId ??
    meta.block_id ??
    null;

  const createdRaw =
    entry.createdAt ??
    entry.created_at ??
    entry.timestamp ??
    meta.createdAt ??
    meta.created_at ??
    meta.timestamp ??
    null;

  const insightLiked = meta.insightLiked ?? false;

  return {
    messageId: stringifyId(messageIdRaw),
    text,
    blockId: blockIdRaw !== undefined && blockIdRaw !== null ? stringifyId(blockIdRaw) : null,
    createdAt: ensureIsoString(createdRaw),
    insightLiked,
    meta,
  };
};

const normalizeDreamsResponse = (payload: unknown): Dream[] => {
  if (Array.isArray(payload)) return payload as Dream[];
  if (payload && typeof payload === 'object') {
    for (const key of ['items', 'data', 'results', 'records', 'dreams']) {
      const maybe = (payload as any)[key];
      if (Array.isArray(maybe)) {
        return maybe as Dream[];
      }
    }
  }
  return [];
};

const normalizeInsightsResponse = (payload: unknown): EnrichedDreamInsight[] => {
  const rawEntries = extractArrayFromPayload(payload);
  const mapped = rawEntries
    .map(mapToInsight)
    .filter((entry): entry is EnrichedDreamInsight => Boolean(entry));

  const deduped = new Map<string, EnrichedDreamInsight>();
  mapped.forEach((insight) => {
    const key = insight.messageId || `${insight.blockId ?? 'unknown'}-${insight.createdAt}`;
    const prev = deduped.get(key);
    if (!prev) {
      deduped.set(key, insight);
      return;
    }

    const preferCurrent =
      (insight.insightLiked ?? false) && !(prev.insightLiked ?? false)
        ? true
        : new Date(insight.createdAt).getTime() > new Date(prev.createdAt).getTime();

    if (preferCurrent) {
      deduped.set(key, {
        ...insight,
        meta: {
          ...(prev.meta ?? {}),
          ...(insight.meta ?? {}),
        },
      });
    }
  });

  return Array.from(deduped.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

const formatDateTimeRu = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU');
};

export function DreamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isBlockView = searchParams.get('view') === 'blocks';

  const [dream, setDream] = useState<Dream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedText, setEditedText] = useState('');
  const [editedDreamSummary, setEditedDreamSummary] = useState('');
  const [editedCategory, setEditedCategory] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [blocks, setBlocks] = useState<WordBlock[]>([]);
  const [autoSummaryRequested, setAutoSummaryRequested] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const [insights, setInsights] = useState<EnrichedDreamInsight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const accentColor = 'rgba(88,120,255,0.95)';
  const screenGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const glassBorder = 'rgba(255,255,255,0.06)';

  const pageSx = {
    minHeight: '100vh',
    background: screenGradient,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative' as const,
    overflow: 'hidden',
    p: { xs: 2, sm: 4 },
  };

  const mainCardSx = {
    width: '100%',
    maxWidth: 840,
    borderRadius: 3,
    background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${glassBorder}`,
    boxShadow: '0 12px 60px rgba(24,32,80,0.28)',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '78vh',
    overflow: 'hidden',
    color: '#fff',
    p: { xs: 2, sm: 3 },
  };

  // Light glass-style кнопки (совместимы со SimilarArtworksScreen)
  const iconBtnSxLight = {
    bgcolor: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.95)',
    borderRadius: 2,
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    backdropFilter: 'blur(6px)',
    border: `1px solid rgba(255,255,255,0.08)`,
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.18)',
      boxShadow: '0 8px 22px rgba(0,0,0,0.16)',
    },
    p: 1,
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  // компактные иконки для карточек (если нужно)
  const cardIconSx = {
    bgcolor: 'rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.95)',
    borderRadius: 1.5,
    boxShadow: '0 6px 14px rgba(0,0,0,0.10)',
    border: `1px solid rgba(255,255,255,0.06)`,
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.18)',
    },
    p: 0.5,
    minWidth: 36,
    minHeight: 36,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  useEffect(() => {
    async function fetchDream() {
      try {
        setLoading(true);
        setError(null);

        if (!id) {
          setError('ID сна не указан');
          setDream(null);
          setBlocks([]);
          return;
        }

        const dreamsResponse = await getDreams();
        const dreamList = normalizeDreamsResponse(dreamsResponse);

        if (!dreamList.length) {
          setError('Сон не найден');
          setDream(null);
          setBlocks([]);
          return;
        }

        const found = dreamList.find((d) => stringifyId(d.id) === id);
        if (!found) {
          setError('Сон не найден');
          setDream(null);
          setBlocks([]);
          return;
        }

        setDream(found);
        setEditedTitle(found.title || '');
        setEditedText(found.dreamText);
        setEditedDreamSummary(found.dreamSummary || '');
        setEditedCategory(found.category || null);

        const blocksFromDream = Array.isArray(found.blocks) ? (found.blocks as WordBlock[]) : [];
        setBlocks(blocksFromDream);
        setActiveBlockId(blocksFromDream.length ? blocksFromDream[0].id : null);
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
        setDream(null);
        setBlocks([]);
      } finally {
        setLoading(false);
      }
    }

    fetchDream();
  }, [id]);

  useEffect(() => {
    if (!dream?.id) return;

    let mounted = true;
    setInsightsLoading(true);
    setInsightsError(null);
    setInsights(null);

    (async () => {
      try {
        const raw = await getDreamInsights(dream.id);
        if (!mounted) return;
        const normalized = normalizeInsightsResponse(raw);
        setInsights(normalized);
      } catch (err: any) {
        if (!mounted) return;
        setInsights([]);
        setInsightsError(err?.message ?? 'Ошибка загрузки инсайтов');
      } finally {
        if (!mounted) return;
        setInsightsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [dream?.id]);

  useEffect(() => {
    const run = async () => {
      if (!isBlockView || autoSummaryRequested) return;
      if (!dream?.id || !dream?.dreamText) return;
      if (dream.autoSummary) return;

      setAutoSummaryRequested(true);
      try {
        await generateAutoSummary(dream.id, dream.dreamText);
        const dreamsResponse = await getDreams();
        const dreamList = normalizeDreamsResponse(dreamsResponse);
        const refreshed = dreamList.find((d) => stringifyId(d.id) === stringifyId(dream.id));
        if (refreshed) setDream(refreshed);
      } catch (err) {
        console.error('Auto summary error:', err);
      } finally {
        setAutoSummaryRequested(false);
      }
    };

    run();
  }, [isBlockView, dream, autoSummaryRequested]);

  const handleSave = async () => {
    if (!dream) return;
    try {
      const textChanged = editedText.trim() !== dream.dreamText.trim();

      const updated = await updateDream(
        dream.id,
        editedText,
        editedTitle,
        blocks,
        dream.globalFinalInterpretation,
        editedDreamSummary || null,
        dream.similarArtworks,
        editedCategory || null,
        dream.date,
      );

      setDream({
        ...updated,
        title: editedTitle,
        dreamSummary: editedDreamSummary || null,
        category: editedCategory || null,
      });
      setEditing(false);
      setSnackbar({ open: true, message: 'Сон обновлён', severity: 'success' });

      if (textChanged && updated?.id && updated?.dreamText) {
        try {
          await generateAutoSummary(updated.id, updated.dreamText);
          const dreamsResponse = await getDreams();
          const dreamList = normalizeDreamsResponse(dreamsResponse);
          const refreshed = dreamList.find((d) => stringifyId(d.id) === stringifyId(updated.id));
          if (refreshed) setDream(refreshed);
        } catch (e) {
          console.error('Auto summary regen error:', e);
        }
      }
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Ошибка обновления', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!dream) return;
    try {
      await apiDeleteDream(dream.id);
      setDeleting(false);
      setSnackbar({ open: true, message: 'Сон удалён', severity: 'success' });
      navigate(-1);
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Ошибка удаления', severity: 'error' });
    }
  };

  const handleOpenBlockView = (initialBlockId?: string) => {
    if (initialBlockId) {
      setActiveBlockId(initialBlockId);
    } else if (blocks.length) {
      setActiveBlockId(blocks[0].id);
    }
    const next = new URLSearchParams(searchParams.toString());
    next.set('view', 'blocks');
    setSearchParams(next, { replace: false });
  };

  const handleCloseBlockView = () => {
    const next = new URLSearchParams(searchParams.toString());
    if (next.has('view')) {
      next.delete('view');
      setSearchParams(next, { replace: true });
    }
  };

  const handleUndoLastBlock = () => {
    setBlocks((prev) => {
      if (!prev.length) return prev;
      const trimmed = prev.slice(0, -1);
      const removed = prev[prev.length - 1];
      if (removed?.id === activeBlockId) {
        setActiveBlockId(trimmed.length ? trimmed[trimmed.length - 1].id : null);
      }
      return trimmed;
    });
  };

  const handleGoToDialogue = () => {
    if (!dream) return;
    const targetBlock = activeBlockId ?? blocks[0]?.id ?? null;
    const basePath = `/dreams/${dream.id}/chat`;
    const url = targetBlock ? `${basePath}?blockId=${encodeURIComponent(targetBlock)}` : basePath;
    navigate(url);
  };

  const handleInsightClick = (insight: EnrichedDreamInsight) => {
    if (!dream) return;

    const normalizedBlockId = insight.blockId ? stringifyId(insight.blockId) : null;
    const matchedBlock = normalizedBlockId
      ? blocks.find((block) => stringifyId(block.id) === normalizedBlockId)
      : null;

    const fallbackBlock = blocks.length ? stringifyId(blocks[0].id) : null;
    const targetBlockId = matchedBlock ? stringifyId(matchedBlock.id) : fallbackBlock;

    const params = new URLSearchParams();
    if (targetBlockId) {
      params.set('blockId', targetBlockId);
    }
    params.set('messageId', insight.messageId);
    params.set('highlight', Date.now().toString());

    navigate(`/dreams/${dream.id}/chat?${params.toString()}`, {
      state: {
        highlightMessageId: insight.messageId,
        highlightNonce: Date.now(),
        origin: 'insights',
      },
    });
  };

  useEffect(() => {
    if (isBlockView) {
      if (blocks.length && !activeBlockId) {
        setActiveBlockId(blocks[0].id);
      }
    } else {
      setActiveBlockId(null);
    }
  }, [isBlockView, blocks, activeBlockId]);

  const dreamDate = dream?.date ?? null;
  const dateStr = useMemo(() => {
    if (!dreamDate) return '';
    return new Date(dreamDate).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [dreamDate]);

  const filteredInsights = useMemo(() => {
    if (!insights) return [];
    return insights.filter((insight) => {
      return insight.insightLiked === true || (insight.meta && (insight.meta as Record<string, unknown>).insightLiked === true);
    });
  }, [insights]);

  const insightsCount = filteredInsights.length;

  if (loading) {
    return (
      <Box sx={pageSx}>
        <Box sx={mainCardSx}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress sx={{ color: accentColor }} />
          </Box>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={pageSx}>
        <Box sx={mainCardSx}>
          <Typography color="error" sx={{ textAlign: 'center', py: 4 }}>
            {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!dream) return null;

  return (
    <Box sx={pageSx}>
      <Box sx={mainCardSx}>
        {/* Back: icon only, same style as modal */}
        <IconButton
          aria-label="Назад"
          onClick={() => navigate(-1)}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            color: '#fff',
            bgcolor: 'transparent',
            borderRadius: '50%',
            p: 1,
            transition: 'background-color 0.18s, box-shadow 0.18s, transform 0.12s',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.08)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
              transform: 'translateY(-1px)',
            },
            '&:focus-visible': {
              outline: '2px solid rgba(255,255,255,0.12)',
              outlineOffset: 3,
            },
            zIndex: 10,
          }}
        >
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>

        {/* Header: avatar + title + actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, pt: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src="/logo.png"
              alt="Dreamly"
              sx={{
                width: 48,
                height: 48,
                border: `1px solid ${glassBorder}`,
                backgroundColor: 'rgba(255,255,255,0.08)',
                boxShadow: '0 8px 24px rgba(24,32,80,0.3)',
              }}
            />
            <Box>
              <Typography variant="h5" sx={{ mb: 1, color: '#fff' }}>
                {dateStr}
              </Typography>
              {dream.title && (
                <Typography variant="h6" sx={{ mb: 1, color: '#fff' }}>
                  {dream.title}
                </Typography>
              )}
              {dream.category && (
                <Chip
                  label={dream.category}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    mb: 1,
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Header actions: edit + delete (same style) */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton aria-label="Редактировать" onClick={() => setEditing(true)} sx={iconBtnSxLight}>
              <EditIcon fontSize="small" />
            </IconButton>

            <IconButton aria-label="Удалить" onClick={() => setDeleting(true)} sx={iconBtnSxLight}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {!editing ? (
          <>
            {/* Insights panel */}
            <Paper
              sx={{
                p: 2,
                mb: 2,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${glassBorder}`,
                borderRadius: 2.5,
                position: 'relative',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <FavoriteIcon sx={{ color: 'rgba(255,120,160,0.95)' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                  Сохранённые инсайты
                </Typography>
                {insightsCount > 0 && (
                  <Chip
                    label={insightsCount}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.14)',
                      color: '#fff',
                      ml: 1,
                    }}
                  />
                )}
              </Box>

              {insightsLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} sx={{ color: 'rgba(255,255,255,0.8)' }} />
                </Box>
              )}

              {!insightsLoading && insightsError && (
                <Alert severity="error" sx={{ bgcolor: 'rgba(255,80,80,0.12)', color: '#fff' }}>
                  {insightsError}
                </Alert>
              )}

              {!insightsLoading && !insightsError && insightsCount === 0 && (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                  Пока нет сохранённых инсайтов. Дважды коснитесь сообщения ассистента в диалоге, чтобы
                  сохранить инсайт.
                </Typography>
              )}

              {!insightsLoading && !insightsError && insightsCount > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {filteredInsights.map((insight, index) => {
                    const displayDate = formatDateTimeRu(insight.createdAt);
                    const liked = insight.insightLiked ?? Boolean(insight.meta?.insightLiked);
                    return (
                      <Paper
                        key={insight.messageId || `insight-${index}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleInsightClick(insight)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleInsightClick(insight);
                          }
                        }}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          textAlign: 'left',
                          cursor: 'pointer',
                          bgcolor: liked ? 'rgba(255,120,160,0.12)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid rgba(255,255,255,0.08)`,
                          borderRadius: 2,
                          transition: 'transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 12px 26px rgba(88,120,255,0.28)',
                            bgcolor: liked
                              ? 'rgba(255,120,160,0.16)'
                              : 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(88,120,255,0.08))',
                          },
                          '&:focus-visible': {
                            outline: '2px solid rgba(255,255,255,0.6)',
                            outlineOffset: '2px',
                          },
                        }}
                      >
                        <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                          {insight.text}
                        </Typography>
                        {(insight.blockId || displayDate) && (
                          <Box
                            sx={{
                              mt: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              color: 'rgba(255,255,255,0.55)',
                              fontSize: '0.75rem',
                            }}
                          >
                            <span>{insight.blockId ? `Блок: ${insight.blockId}` : ''}</span>
                            <span>{displayDate}</span>
                          </Box>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Paper>

            {/* Контекст и резюме */}
            {dream.dreamSummary && (
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${glassBorder}`,
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgba(255,255,255,0.8)' }}>
                  Контекст:
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                  {dream.dreamSummary}
                </Typography>
              </Paper>
            )}

            {dream.autoSummary && (
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${glassBorder}`,
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgba(255,255,255,0.8)' }}>
                  Краткое резюме:
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                  {dream.autoSummary}
                </Typography>
              </Paper>
            )}

            {dream.globalFinalInterpretation && (
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(88,120,255,0.03))',
                  border: `1px solid ${glassBorder}`,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#fff' }}>
                  Итоговое толкование сна
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                  {dream.globalFinalInterpretation}
                </Typography>
              </Paper>
            )}

            {/* Основная карточка с текстом сна */}
            <Paper
              sx={{
                p: 2,
                mb: 3,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${glassBorder}`,
                borderRadius: 2,
                position: 'relative',
                minHeight: 200,
                overflow: 'visible',
              }}
            >
              <Typography variant="body1" sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                {dream.dreamText}
              </Typography>

              {/* Плавающая группа кнопок — горизонтально, один стиль (light glass) */}
              <Box
                sx={{
                  position: 'absolute',
                  right: 24,
                  bottom: 24,
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  zIndex: 6,
                }}
              >
                {/* Похожие / поиск */}
                <IconButton
                  aria-label="Найти схожие сновидения"
                  onClick={() => navigate(`/dreams/${dream.id}/similar`)}
                  sx={iconBtnSxLight}
                >
                  <ManageSearchRoundedIcon />
                </IconButton>

                {/* Анализ блоков */}
                <IconButton
                  aria-label="Перейти к анализу"
                  onClick={() => handleOpenBlockView()}
                  sx={iconBtnSxLight}
                >
                  <InsightsIcon />
                </IconButton>
              </Box>
            </Paper>

            {/* Dialog для анализа блоков */}
            <Dialog
              open={isBlockView}
              onClose={handleCloseBlockView}
              maxWidth="md"
              fullWidth
              PaperProps={{
                sx: {
                  position: 'relative',
                  background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
                  backdropFilter: 'blur(18px)',
                  border: `1px solid ${glassBorder}`,
                  color: '#fff',
                  borderRadius: 4,
                  boxShadow: '0 12px 60px rgba(24,32,80,0.38)',
                  p: 0,
                },
              }}
            >
              <DialogTitle sx={{ px: 3, pt: 2, pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton
                    aria-label="Назад к тексту"
                    onClick={handleCloseBlockView}
                    sx={{
                      color: '#fff',
                      bgcolor: 'rgba(255,255,255,0.08)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.16)' },
                    }}
                  >
                    <ArrowBackIosNewIcon fontSize="small" />
                  </IconButton>

                  <Typography variant="h6" sx={{ flexGrow: 1, textAlign: 'center' }}>
                    Выделите блоки в тексте сна
                  </Typography>

                  <Tooltip title="Удалить последний блок">
  <Badge
    overlap="circular"
    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    badgeContent={
      <Box component="span" sx={{ fontSize: '0.65rem', fontWeight: 700, lineHeight: 1 }}>
        -1
      </Box>
    }
    sx={{
      '& .MuiBadge-badge': {
        // Не мешаем кликам и немного смещаем бейдж выше/правее
        pointerEvents: 'none',
        background: blocks.length
          ? 'linear-gradient(135deg, #a77bff 0%, #80ffea 100%)'
          : 'rgba(255,255,255,0.12)',
        color: '#fff',
        minWidth: 18,
        height: 18,
        borderRadius: '9px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
        transform: 'translate(50%,-70%)', // поднять выше и правее
        fontSize: '0.65rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    }}
  >
    <IconButton
      aria-label="Удалить последний блок"
      onClick={handleUndoLastBlock}
      disabled={!blocks.length}
      sx={{
        color: blocks.length ? '#fff' : 'rgba(255,255,255,0.3)',
        bgcolor: 'rgba(255,255,255,0.08)',
        '&:hover': {
          bgcolor: blocks.length ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
        },
      }}
    >
      <DeleteOutlineIcon />
    </IconButton>
  </Badge>
</Tooltip>
                </Box>
              </DialogTitle>

              <DialogContent sx={{ px: 3, pt: 1, pb: 6 }}>
                <DreamBlocks
                  text={dream.dreamText}
                  blocks={blocks}
                  dreamId={dream.id}
                  onBlocksChange={(next) => {
                    setBlocks(next);
                    if (!next.length) {
                      setActiveBlockId(null);
                    } else if (!next.some((block) => block.id === activeBlockId)) {
                      setActiveBlockId(next[next.length - 1].id);
                    }
                  }}
                  activeBlockId={activeBlockId}
                  onActiveBlockChange={setActiveBlockId}
                  hideInternalBackButton
                  hideHeader
                  onBack={handleCloseBlockView}
                />
              </DialogContent>

              <IconButton
                aria-label="Перейти к диалогу"
                onClick={handleGoToDialogue}
                sx={{
                  position: 'absolute',
                  right: 24,
                  bottom: 20,
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.95)',
                  borderRadius: 2,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
                }}
              >
                <ChatBubbleOutlineRoundedIcon />
              </IconButton>
            </Dialog>
          </>
        ) : (
          // Форма редактирования (тот же внешний вид, сохранена логика)
          <Box component="form" sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Название сна"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: accentColor,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: accentColor,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255,255,255,0.7)',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: accentColor,
                },
                '& .MuiInputBase-input': {
                  color: '#fff',
                },
              }}
              InputLabelProps={{
                style: { color: '#fff' },
              }}
              InputProps={{
                style: { color: '#fff' },
              }}
            />

            <Autocomplete
              freeSolo
              options={categories}
              value={editedCategory}
              onChange={(_, newValue) => setEditedCategory(newValue)}
              onInputChange={(_, newInputValue) => setEditedCategory(newInputValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Категория сна"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: accentColor,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: accentColor,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255,255,255,0.7)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: accentColor,
                    },
                    '& .MuiInputBase-input': {
                      color: '#fff',
                    },
                  }}
                  InputLabelProps={{
                    style: { color: '#fff' },
                  }}
                />
              )}
            />

            <TextField
              label="Контекст сновидения"
              value={editedDreamSummary}
              onChange={(e) => setEditedDreamSummary(e.target.value)}
              multiline
              minRows={3}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: accentColor,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: accentColor,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255,255,255,0.7)',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: accentColor,
                },
                '& .MuiInputBase-input': {
                  color: '#fff',
                },
              }}
              InputLabelProps={{
                style: { color: '#fff' },
              }}
              InputProps={{
                style: { color: '#fff' },
              }}
            />

            <TextField
              label="Текст сна"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: accentColor,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: accentColor,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255,255,255,0.7)',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: accentColor,
                },
                '& .MuiInputBase-input': {
                  color: '#fff',
                },
              }}
              InputLabelProps={{
                style: { color: '#fff' },
              }}
              InputProps={{
                style: { color: '#fff' },
              }}
            />

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!editedText.trim()}
                sx={{
                  bgcolor: accentColor,
                  color: '#fff',
                  '&:hover': {
                    bgcolor: 'rgba(88,120,255,0.85)',
                  },
                }}
              >
                Сохранить
              </Button>
              <Button
                variant="outlined"
                onClick={() => setEditing(false)}
                sx={{
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  '&:hover': {
                    borderColor: accentColor,
                    bgcolor: 'rgba(88,120,255,0.1)',
                  },
                }}
              >
                Отмена
              </Button>
            </Box>
          </Box>
        )}

        {/* Удаление — диалог подтверждения */}
        <Dialog
          open={deleting}
          onClose={() => setDeleting(false)}
          PaperProps={{
            sx: {
              background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${glassBorder}`,
              color: '#fff',
              borderRadius: 3,
            },
          }}
        >
          <DialogTitle>Удалить сон?</DialogTitle>
          <DialogContent>
            <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
              Вы уверены, что хотите удалить этот сон? Это действие нельзя отменить.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleting(false)} sx={{ color: '#fff' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
              sx={{
                bgcolor: 'rgba(255, 100, 100, 0.95)',
                '&:hover': {
                  bgcolor: 'rgba(255, 100, 100, 0.85)',
                },
              }}
            >
              Удалить
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            severity={snackbar.severity}
            sx={{
              width: '100%',
              '& .MuiAlert-message': { fontSize: '0.95rem' },
              bgcolor: 'rgba(0,0,0,0.35)',
              color: '#fff',
              border: `1px solid ${glassBorder}`,
              backdropFilter: 'blur(6px)',
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}