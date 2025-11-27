// SimilarArtworksScreen.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getDream,
  findSimilarArtworks,
  updateDream,
  getDreamArtworksInsights,
} from '../../utils/api';
import type { Dream, SimilarArtwork } from '../../utils/api';
import {
  Box,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Alert,
  Paper,
  Snackbar,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DeleteIcon from '@mui/icons-material/Delete';
// удалил импорт FavoriteIcon, теперь не используем его напрямую
// import FavoriteIcon from '@mui/icons-material/Favorite';

import MenuBookIcon from '@mui/icons-material/MenuBook';
import PaletteIcon from '@mui/icons-material/Palette';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MovieIcon from '@mui/icons-material/Movie';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import BrushIcon from '@mui/icons-material/Brush';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ArtTrackIcon from '@mui/icons-material/ArtTrack';

type ArtworkType =
  | 'painting'
  | 'sculpture'
  | 'installation'
  | 'book'
  | 'music'
  | 'movie'
  | 'theater'
  | 'photo'
  | 'drawing'
  | 'story'
  | 'default';

// Цветовая палитра
const BLOCK_COLORS = [
  'rgba(83, 134, 136, 0.78)',
  'rgba(118, 174, 186, 0.78)',
  'rgba(160, 198, 206, 0.78)',
  'rgba(228, 228, 228, 0.78)',
  'rgba(229, 213, 223, 0.78)',
  'rgba(105, 127, 163, 0.78)',
  'rgba(154, 188, 221, 0.78)',
  'rgba(151, 194, 193, 0.78)',
  'rgba(202, 216, 210, 0.78)',
  'rgba(234, 231, 227, 0.78)',
];

const ART_TYPE_COLORS: Record<ArtworkType, string> = {
  painting: BLOCK_COLORS[1],
  sculpture: BLOCK_COLORS[5],
  installation: BLOCK_COLORS[2],
  book: BLOCK_COLORS[4],
  music: BLOCK_COLORS[6],
  movie: BLOCK_COLORS[8],
  theater: BLOCK_COLORS[9],
  photo: BLOCK_COLORS[3],
  drawing: BLOCK_COLORS[0],
  story: BLOCK_COLORS[7],
  default: BLOCK_COLORS[1],
};

const ART_TYPE_ICONS: Record<
  ArtworkType,
  { icon: React.ReactNode; color: string }
> = {
  painting: { icon: <PaletteIcon fontSize="small" />, color: ART_TYPE_COLORS.painting },
  sculpture: { icon: <AccountBalanceIcon fontSize="small" />, color: ART_TYPE_COLORS.sculpture },
  installation: { icon: <ArtTrackIcon fontSize="small" />, color: ART_TYPE_COLORS.installation },
  book: { icon: <MenuBookIcon fontSize="small" />, color: ART_TYPE_COLORS.book },
  music: { icon: <MusicNoteIcon fontSize="small" />, color: ART_TYPE_COLORS.music },
  movie: { icon: <MovieIcon fontSize="small" />, color: ART_TYPE_COLORS.movie },
  theater: { icon: <TheaterComedyIcon fontSize="small" />, color: ART_TYPE_COLORS.theater },
  photo: { icon: <PhotoCameraIcon fontSize="small" />, color: ART_TYPE_COLORS.photo },
  drawing: { icon: <BrushIcon fontSize="small" />, color: ART_TYPE_COLORS.drawing },
  story: { icon: <AutoStoriesIcon fontSize="small" />, color: ART_TYPE_COLORS.story },
  default: { icon: <PaletteIcon fontSize="small" />, color: ART_TYPE_COLORS.default },
};

function detectType(art: SimilarArtwork): ArtworkType {
  if (art.type && typeof art.type === 'string') {
    const validTypes: ArtworkType[] = [
      'painting',
      'sculpture',
      'installation',
      'book',
      'music',
      'movie',
      'theater',
      'photo',
      'drawing',
      'story',
    ];
    const t = art.type.toLowerCase() as ArtworkType;
    if (validTypes.includes(t)) return t;
  }
  const t = (art.title + ' ' + art.author + ' ' + (art.desc || '')).toLowerCase();
  if (t.match(/картина|живопись|полотно|шагал|моне|дали|дали/)) return 'painting';
  if (t.match(/фильм|movie|кино|вендерс|вачовски|матрица/)) return 'movie';
  if (t.match(/музыка|поэма|симфония|штраус|music|произведение/)) return 'music';
  if (t.match(/роман|книга|book|кафка|маркес|толстой/)) return 'book';
  if (t.match(/скульптура|sculpture/)) return 'sculpture';
  if (t.match(/инсталляция|installation|смитсон/)) return 'installation';
  if (t.match(/фото|photograph|photo/)) return 'photo';
  if (t.match(/рисунок|drawing|brush/)) return 'drawing';
  if (t.match(/рассказ|story/)) return 'story';
  if (t.match(/театр|theater/)) return 'theater';
  return 'default';
}

/* =========================
   Helpers (insights normalization + utils)
   ========================= */

type EnrichedDreamInsight = {
  messageId: string;
  text: string;
  blockId: string | null;
  createdAt: string;
  insightLiked?: boolean;
  meta?: Record<string, any>;
};

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

const extractPlainText = (value: unknown, seen = new WeakSet<object>()): string => {
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
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {};
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

/* =========================
   Main component
   ========================= */

export function SimilarArtworksScreen(): React.ReactElement {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dream, setDream] = useState<Dream | null>(null);
  const [artworks, setArtworks] = useState<SimilarArtwork[]>([]);
  const [insightsByMessage, setInsightsByMessage] = useState<Record<string, boolean>>({});
  const [insightsByBlock, setInsightsByBlock] = useState<Record<string, boolean>>({});
  const [insightsList, setInsightsList] = useState<EnrichedDreamInsight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState<boolean>(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [regeneratingArtwork, setRegeneratingArtwork] = useState<number | null>(null);

  const [deletingArtworkIndex, setDeletingArtworkIndex] = useState<number | null>(null);
  const [deletingListOpen, setDeletingListOpen] = useState(false);
  const [deletingProcessing, setDeletingProcessing] = useState(false);

  const accentColor = 'rgba(88,120,255,0.95)';
  const screenGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const glassBorder = 'rgba(255,255,255,0.06)';

  const MAX_ARTWORKS = 5;
  const ADDING_INDEX = -1;

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

  const iconBtnSxLight = {
    bgcolor: 'rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.95)',
    borderRadius: 2,
    boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
    backdropFilter: 'blur(6px)',
    border: `1px solid rgba(255,255,255,0.08)`,
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.24)',
      boxShadow: '0 8px 22px rgba(0,0,0,0.18)',
    },
    p: 1,
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  const cardIconSx = {
    bgcolor: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.95)',
    borderRadius: 1.5,
    boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
    backdropFilter: 'blur(6px)',
    border: `1px solid rgba(255,255,255,0.06)`,
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.20)',
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

  // --------------- 3D heart spin & gradient mask setup ---------------
  // SVG path for Material Favorite icon — используем как маску
  const heartSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 3.99 4 6.5 4c1.74 0 3.41 0.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18.01 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' /></svg>`;
  const heartMaskUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(heartSvg)}")`;

  // global keyframes for 3D spin (rotateY)
  const spin3dKeyframes = {
    '@keyframes spin3D': {
      '0%': { transform: 'rotateY(0deg)' },
      '100%': { transform: 'rotateY(360deg)' },
    },
  } as const;

  // base sx для сердечка (градиент внутри формы через маску), размеры можно менять
  const heartSxBase = {
    width: 16,
    height: 16,
    minWidth: 16,
    minHeight: 16,
    borderRadius: 0,
    background: 'linear-gradient(135deg, #a77bff 0%, #80ffea 100%)', // фиолетово-бирюзовый пастельный градиент
    WebkitMaskImage: heartMaskUrl,
    maskImage: heartMaskUrl,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'cover',
    maskSize: 'cover',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    // 3D spin
    animation: 'spin3D 900ms linear infinite',
    transformStyle: 'preserve-3d' as const,
    backfaceVisibility: 'hidden' as const,
    display: 'inline-block',
  } as const;

  // ------------------ /end heart setup ------------------

  const fetchArtworks = async (force = false) => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      if (!id) {
        setError('ID сна не указан');
        setLoading(false);
        return;
      }

      const d = await getDream(id);
      setDream(d);

      if (!force && d.similarArtworks && d.similarArtworks.length > 0) {
        setArtworks(d.similarArtworks as SimilarArtwork[]);
        setSaved(true);
      } else {
        let blockInterpretations = '';
        if (Array.isArray(d.blocks)) {
          blockInterpretations = d.blocks
            .filter((b: any) => b?.meta?.kind === 'block_interpretation')
            .map((b: any) => b.interpretation || b.text || '')
            .join('\n\n');
        }

        const res = await findSimilarArtworks(
          d.dreamText,
          d.globalFinalInterpretation ?? undefined,
          blockInterpretations
        );

        if ('error' in res) {
          setError(
            res.error === 'unauthorized'
              ? 'Требуется авторизация для поиска схожих произведений.'
              : res.error === 'Trial expired'
              ? 'Пробный период завершён. Продлите подписку для доступа к поиску.'
              : res.message || 'Ошибка поиска'
          );
          setArtworks([]);
        } else {
          setArtworks(res.similarArtworks || []);
          await updateDream(
            d.id,
            d.dreamText,
            d.title,
            d.blocks,
            d.globalFinalInterpretation,
            d.dreamSummary,
            res.similarArtworks || [],
            d.category,
            d.date
          );
          setSaved(true);
        }
      }

      await loadInsightsForDream(id);
    } catch (e: any) {
      setError(e?.message || 'Ошибка поиска');
      setArtworks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadInsightsForDream = async (dreamId: string) => {
    setInsightsLoading(true);
    setInsightsError(null);
    setInsightsList(null);
    try {
      const raw = await getDreamArtworksInsights(dreamId);
      const normalized = normalizeInsightsResponse(raw);
      setInsightsList(normalized);

      const byMessage: Record<string, boolean> = {};
      const byBlock: Record<string, boolean> = {};
      normalized.forEach((i) => {
        if (i.messageId) byMessage[i.messageId] = true;
        if (i.blockId) byBlock[i.blockId ?? ''] = true;
      });
      setInsightsByMessage(byMessage);
      setInsightsByBlock(byBlock);
    } catch (err: any) {
      setInsightsList([]);
      setInsightsError(err?.message ?? 'Ошибка загрузки инсайтов');
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    fetchArtworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    if (!dream) return;
    try {
      await updateDream(
        dream.id,
        dream.dreamText,
        dream.title,
        dream.blocks,
        dream.globalFinalInterpretation,
        dream.dreamSummary,
        artworks,
        dream.category,
        dream.date
      );
      setSaved(true);
      setSnackbar({ open: true, message: 'Список сохранён!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message || 'Ошибка сохранения', severity: 'error' });
    }
  };

  const handleArtworkChat = (art: SimilarArtwork, idx: number) => {
    if (!id) return;
    navigate(`/dreams/${id}/artwork-chat/${idx}`);
  };

  const handleInsightClick = (insight: EnrichedDreamInsight) => {
    if (!dream || !id) return;

    let idx = 0;

    if (insight.blockId && insight.blockId.startsWith('artwork__')) {
      const match = insight.blockId.match(/artwork__(\d+)/);
      if (match) {
        idx = parseInt(match[1], 10);
      }
    }

    navigate(`/dreams/${id}/artwork-chat/${idx}?messageId=${encodeURIComponent(insight.messageId)}`, {
      state: {
        highlightMessageId: insight.messageId,
      },
    });
  };

  const normalizeText = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const isSameArtwork = (a?: SimilarArtwork | null, b?: SimilarArtwork | null) => {
    if (!a || !b) return false;
    const ta = `${normalizeText(a.title)}|${normalizeText(a.author)}|${normalizeText(a.desc)}`;
    const tb = `${normalizeText(b.title)}|${normalizeText(b.author)}|${normalizeText(b.desc)}`;
    return ta === tb;
  };

  const handleRegenerateArtwork = async (idx: number) => {
    if (!id || !dream) return;

    setRegeneratingArtwork(idx);
    try {
      let blockInterpretations = '';
      if (Array.isArray(dream.blocks)) {
        blockInterpretations = dream.blocks
          .filter((b: any) => b?.meta?.kind === 'block_interpretation')
          .map((b: any) => b.interpretation || b.text || '')
          .join('\n\n');
      }

      const existingSignatures = artworks
        .map((a) => `${normalizeText(a.title)}|${normalizeText(a.author)}|${normalizeText(a.desc)}`)
        .filter(Boolean);

      const subPromptLines = [
        'Инструкция для генерации: пожалуйста, сгенерируй одно уникальное произведение,',
        'не повторяющее названия, авторов или описания из текущего списка.',
        'Избегай близких дубликатов по названию/автору/описанию.',
        `Текущие подписи (не повторять): ${existingSignatures.slice(0, 8).join(' ; ')}`,
      ];
      const subPrompt = '\n\n' + subPromptLines.join(' ');

      const res = await findSimilarArtworks(
        (dream.dreamText || '') + subPrompt,
        dream.globalFinalInterpretation ?? undefined,
        blockInterpretations
      );

      if ('error' in res) {
        throw new Error(res.message || 'Ошибка перегенерации произведения');
      }

      const candidates = res.similarArtworks || [];
      const currentArt = artworks[idx];
      let chosen: SimilarArtwork | null = null;

      for (const cand of candidates) {
        if (!isSameArtwork(cand, currentArt)) {
          const dup = artworks.some((a, i) => i !== idx && isSameArtwork(a, cand));
          if (!dup) {
            chosen = cand;
            break;
          }
        }
      }

      if (!chosen && candidates.length > 0) {
        const firstDifferent = candidates.find((c) => !isSameArtwork(c, currentArt));
        chosen = firstDifferent ?? candidates[0];
      }

      if (!chosen) {
        throw new Error('Не удалось сгенерировать уникальное произведение');
      }

      const updated = [...artworks];
      updated[idx] = chosen;
      setArtworks(updated);

      await updateDream(
        dream.id,
        dream.dreamText,
        dream.title,
        dream.blocks,
        dream.globalFinalInterpretation,
        dream.dreamSummary,
        updated,
        dream.category,
        dream.date
      );

      setSnackbar({ open: true, message: 'Произведение успешно перегенерировано!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message || 'Ошибка перегенерации произведения', severity: 'error' });
    } finally {
      setRegeneratingArtwork(null);
    }
  };

  const handleAddArtwork = async () => {
    if (!id || !dream) return;
    if (artworks.length >= MAX_ARTWORKS) return;

    setRegeneratingArtwork(ADDING_INDEX);
    try {
      let blockInterpretations = '';
      if (Array.isArray(dream.blocks)) {
        blockInterpretations = dream.blocks
          .filter((b: any) => b?.meta?.kind === 'block_interpretation')
          .map((b: any) => b.interpretation || b.text || '')
          .join('\n\n');
      }

      const existingSignatures = artworks
        .map((a) => `${normalizeText(a.title)}|${normalizeText(a.author)}|${normalizeText(a.desc)}`)
        .filter(Boolean);

      const subPromptLines = [
        'Инструкция для генерации: пожалуйста, сгенерируй одно уникальное произведение,',
        'не повторяющее названия, авторов или описания из текущего списка.',
        'Избегай близких дубликатов по названию/автору/описанию.',
        `Текущие подписи (не повторять): ${existingSignatures.slice(0, 8).join(' ; ')}`,
      ];
      const subPrompt = '\n\n' + subPromptLines.join(' ');

      const res = await findSimilarArtworks(
        (dream.dreamText || '') + subPrompt,
        dream.globalFinalInterpretation ?? undefined,
        blockInterpretations
      );

      if ('error' in res) {
        throw new Error(res.message || 'Ошибка генерации произведения');
      }

      const candidates = res.similarArtworks || [];
      let chosen: SimilarArtwork | null = null;
      for (const cand of candidates) {
        const dup = artworks.some((a) => isSameArtwork(a, cand));
        if (!dup) {
          chosen = cand;
          break;
        }
      }
      chosen = chosen ?? candidates[0] ?? null;

      if (!chosen) {
        throw new Error('Не удалось сгенерировать произведение');
      }

      const updated = [...artworks, chosen].slice(0, MAX_ARTWORKS);
      setArtworks(updated);

      await updateDream(
        dream.id,
        dream.dreamText,
        dream.title,
        dream.blocks,
        dream.globalFinalInterpretation,
        dream.dreamSummary,
        updated,
        dream.category,
        dream.date
      );

      setSnackbar({ open: true, message: 'Произведение добавлено', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message || 'Ошибка добавления произведения', severity: 'error' });
    } finally {
      setRegeneratingArtwork(null);
    }
  };

  const promptDeleteArtwork = (idx: number) => {
    setDeletingArtworkIndex(idx);
  };

  const confirmDeleteArtwork = async () => {
    if (deletingArtworkIndex === null || !dream) {
      setDeletingArtworkIndex(null);
      return;
    }
    const idx = deletingArtworkIndex;
    setDeletingProcessing(true);
    try {
      const updated = artworks.filter((_, i) => i !== idx);
      setArtworks(updated);

      await updateDream(
        dream.id,
        dream.dreamText,
        dream.title,
        dream.blocks,
        dream.globalFinalInterpretation,
        dream.dreamSummary,
        updated,
        dream.category,
        dream.date
      );

      setSnackbar({ open: true, message: 'Произведение удалено', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message || 'Ошибка удаления', severity: 'error' });
    } finally {
      setDeletingProcessing(false);
      setDeletingArtworkIndex(null);
    }
  };

  const promptDeleteList = () => {
    setDeletingListOpen(true);
  };

  const confirmDeleteList = async () => {
    if (!dream) {
      setDeletingListOpen(false);
      return;
    }
    setDeletingProcessing(true);
    try {
      await updateDream(
        dream.id,
        dream.dreamText,
        dream.title,
        dream.blocks,
        dream.globalFinalInterpretation,
        dream.dreamSummary,
        [],
        dream.category,
        dream.date
      );
      setArtworks([]);
      setSnackbar({ open: true, message: 'Список удалён!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message || 'Ошибка удаления списка', severity: 'error' });
    } finally {
      setDeletingProcessing(false);
      setDeletingListOpen(false);
    }
  };

  const renderArtworkAvatar = (art: SimilarArtwork, idx: number) => {
    const type = detectType(art);
    const typeKey = (type in ART_TYPE_ICONS ? type : 'default') as ArtworkType;
    const { icon, color } = ART_TYPE_ICONS[typeKey];

    const overlaySx = {
      position: 'absolute' as const,
      right: -6,
      bottom: -6,
      width: 28,
      height: 28,
      borderRadius: '7px',
      bgcolor: 'rgba(255,255,255,0.10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 12px rgba(24,32,80,0.12)',
      border: `1px solid rgba(255,255,255,0.08)`,
      backdropFilter: 'blur(4px)',
      overflow: 'hidden' as const,
    };

    if (art.value) {
      return (
        <Box sx={{ width: 64, height: 64, mr: 2, position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={art.value}
            alt={art.title || 'art'}
            variant="rounded"
            sx={{
              width: 64,
              height: 64,
              borderRadius: 2,
              boxShadow: 2,
              flexShrink: 0,
              border: `1px solid rgba(255,255,255,0.06)`,
              backgroundColor: 'rgba(0,0,0,0.04)',
              objectFit: 'cover',
            }}
          />
          <Box sx={overlaySx} aria-hidden>
            <img
              src="/logo.png"
              alt="S"
              style={{
                width: 14,
                height: 14,
                objectFit: 'contain',
                opacity: 0.7,
                filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.2))',
              }}
            />
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ width: 64, height: 64, mr: 2, position: 'relative', flexShrink: 0 }}>
        <Avatar
          variant="rounded"
          sx={{
            width: 64,
            height: 64,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${color}, rgba(20,30,40,0.12))`,
            color: '#fff',
            fontWeight: 700,
            fontSize: 20,
            flexShrink: 0,
            boxShadow: '0 8px 20px rgba(0,0,0,0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid rgba(255,255,255,0.04)`,
          }}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '& svg': {
              fontSize: 20,
              color: 'rgba(255,255,255,0.95)'
            }
          }}>
            {icon}
          </Box>
        </Avatar>

        <Box sx={overlaySx} aria-hidden>
          <img
            src="/logo.png"
            alt="S"
            style={{
              width: 14,
              height: 14,
              objectFit: 'contain',
              opacity: 0.65,
              filter: 'grayscale(1) brightness(1.4)',
            }}
          />
        </Box>
      </Box>
    );
  };

  const formatDate = (dateValue?: string | number): string => {
    if (!dateValue) return '';
    const date = typeof dateValue === 'number' ? new Date(dateValue) : new Date(String(dateValue));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const insightsCount = useMemo(() => (insightsList ? insightsList.length : 0), [insightsList]);

  return (
    <Box sx={pageSx}>
      <Box sx={mainCardSx}>
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

        {dream && (
          <Paper
            sx={{
              mb: 2,
              p: 2,
              pt: 6,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${glassBorder}`,
              borderRadius: 2.5,
              color: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
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
                <Typography variant="h5" sx={{ mb: 0.5, color: '#fff' }}>
                  {formatDate(dream.date)}
                </Typography>
                {dream.title && (
                  <Typography variant="h6" sx={{ mb: 0.5, color: '#fff' }}>
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
                    }}
                  />
                )}
              </Box>
            </Box>

            {dream.dreamSummary && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 0.5 }}>
                Контекст: {dream.dreamSummary}
              </Typography>
            )}
            {dream.autoSummary && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                Краткое резюме: {dream.autoSummary}
              </Typography>
            )}
          </Paper>
        )}

        <Paper
          sx={{
            p: 2,
            mb: 2,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${glassBorder}`,
            borderRadius: 2,
            color: '#fff',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
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
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.85)' }} />
            </Box>
          )}

          {!insightsLoading && insightsError && (
            <Alert severity="error" sx={{ bgcolor: 'rgba(255,80,80,0.12)', color: '#fff' }}>
              {insightsError}
            </Alert>
          )}

          {!insightsLoading && !insightsError && insightsCount === 0 && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              Пока нет сохранённых инсайтов. Дважды коснитесь сообщения ассистента в диалоге, чтобы сохранить инсайт.
            </Typography>
          )}

          {!insightsLoading && !insightsError && insightsCount > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {insightsList!.slice(0, 6).map((insight, index) => {
                const displayDate = formatDateTimeRu(insight.createdAt);
                return (
                  <Paper
                    key={insight.messageId || `insight-${index}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleInsightClick(insight)}
                    elevation={0}
                    sx={{
                      p: 1.25,
                      textAlign: 'left',
                      cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: `1px solid rgba(255,255,255,0.06)`,
                      borderRadius: 2,
                      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 26px rgba(88,120,255,0.18)',
                      },
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#fff', fontSize: 14 }}>
                      {insight.text}
                    </Typography>
                    {(insight.blockId || displayDate) && (
                      <Box
                        sx={{
                          mt: 0.75,
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

              {insightsCount > 6 && (
                <Typography
                  role="button"
                  onClick={() => navigate(`/dreams/${dream?.id}/insights`)}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    textAlign: 'right',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                    fontSize: '0.875rem',
                    mt: 0.5,
                  }}
                >
                  Показать все инсайты ({insightsCount})
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ color: '#fff' }}>
            Схожие произведения искусства
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Обновить список">
              <span>
                <IconButton
                  color="primary"
                  onClick={() => fetchArtworks(true)}
                  disabled={loading}
                  aria-label="Обновить список"
                  sx={iconBtnSxLight}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Удалить список">
              <span>
                <IconButton
                  color="error"
                  onClick={() => {
                    promptDeleteList();
                  }}
                  disabled={loading || artworks.length === 0}
                  aria-label="Удалить список"
                  sx={iconBtnSxLight}
                >
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress sx={{ color: accentColor }} />
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            sx={{
              bgcolor: 'rgba(255,80,80,0.12)',
              color: '#fff',
              border: `1px solid rgba(255,80,80,0.2)`,
            }}
          >
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <List sx={{ width: '100%' }}>
            {artworks.length === 0 && (
              <Typography color="rgba(255,255,255,0.65)" sx={{ mt: 2, textAlign: 'center' }}>
                Ничего не найдено.
              </Typography>
            )}

            {artworks.map((art, idx) => {
              const isRegenerating = regeneratingArtwork === idx;
              return (
                <ListItem
                  key={idx}
                  alignItems="flex-start"
                  onClick={() => handleArtworkChat(art, idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleArtworkChat(art, idx);
                    }
                  }}
                  sx={{
                    mb: 1.5,
                    py: 1.5,
                    px: 2,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${glassBorder}`,
                    minHeight: 84,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.07)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
                    },
                    position: 'relative',
                    overflow: 'visible',
                    cursor: 'pointer',
                  }}
                >
                  {renderArtworkAvatar(art, idx)}

                  <ListItemText
                    sx={{
                      pr: { xs: '130px', sm: '150px' },
                    }}
                    primary={
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: 16, color: '#fff' }}>
                        {art.title}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" sx={{ fontSize: 14, color: 'rgba(255,255,255,0.92)' }}>
                          {art.author}
                        </Typography>
                        <br />
                        <Typography variant="body2" sx={{ fontSize: 13, color: 'rgba(255,255,255,0.74)' }}>
                          {art.desc}
                        </Typography>
                      </>
                    }
                  />

                  <Box
                    sx={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      display: 'flex',
                      gap: 0.75,
                      alignItems: 'center',
                      zIndex: 5,
                    }}
                  >
                    <Tooltip title="Перегенерировать">
                      <span>
                        <IconButton
                          aria-label="перегенерировать"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateArtwork(idx);
                          }}
                          disabled={isRegenerating}
                          sx={cardIconSx}
                        >
                          {/* Встраиваем keyframes и маску в sx.
                              Оборачиваем spin3dKeyframes в sx, чтобы ключевые кадры применились. */}
                          {isRegenerating ? (
                            <Box sx={{ ...spin3dKeyframes, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Box sx={{ ...heartSxBase }} aria-hidden />
                            </Box>
                          ) : (
                            <AutorenewIcon sx={{ color: 'rgba(255,255,255,0.95)', fontSize: 18 }} />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Удалить">
                      <span>
                        <IconButton
                          aria-label="удалить"
                          onClick={(e) => {
                            e.stopPropagation();
                            promptDeleteArtwork(idx);
                          }}
                          sx={cardIconSx}
                        >
                          <DeleteIcon sx={{ color: 'rgba(255,255,255,0.95)', fontSize: 18 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </ListItem>
              );
            })}

            {artworks.length < MAX_ARTWORKS && (() => {
              const isAdding = regeneratingArtwork === ADDING_INDEX;

              return (
                <ListItem
                  key="add-placeholder"
                  alignItems="center"
                  onClick={(e) => {
                    if (isAdding) return;
                    handleAddArtwork();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (isAdding) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAddArtwork();
                    }
                  }}
                  sx={{
                    mb: 1.5,
                    py: 1.5,
                    px: 2,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px dashed rgba(255,255,255,0.04)`,
                    minHeight: 84,
                    transition: 'all 0.18s ease',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.035)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                    },
                    position: 'relative',
                    overflow: 'visible',
                    cursor: isAdding ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: isAdding ? 0.98 : 1,
                  }}
                >
                  {isAdding && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        display: 'flex',
                        gap: 0.75,
                        alignItems: 'center',
                        zIndex: 5,
                      }}
                    >
                      <Tooltip title="Генерация..." placement="top">
                        <span>
                          <IconButton aria-label="генерация" disabled sx={cardIconSx}>
                            <Box sx={{ ...spin3dKeyframes, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Box sx={{ ...heartSxBase }} aria-hidden />
                            </Box>
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  )}

                  <Box sx={{ width: 64, height: 64, mr: 2, position: 'relative', flexShrink: 0 }}>
                    <Avatar
                      src="/logo.png"
                      alt="Saviora"
                      variant="rounded"
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        boxShadow: 1,
                        border: `1px solid rgba(255,255,255,0.04)`,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        opacity: 0.95,
                        objectFit: 'contain',
                      }}
                    />
                  </Box>

                  <ListItemText
                    sx={{
                      pr: { xs: '130px', sm: '150px' },
                    }}
                    primary={
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: 15, color: 'rgba(255,255,255,0.86)' }}>
                        Добавление произведения
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ fontSize: 13, color: 'rgba(255,255,255,0.58)' }}>
                        Нажмите карточку, чтобы сгенерировать новое похожее произведение.
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })()}
          </List>
        )}

        <Dialog
          open={deletingArtworkIndex !== null}
          onClose={() => {
            if (!deletingProcessing) setDeletingArtworkIndex(null);
          }}
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
          <DialogTitle>Удалить произведение?</DialogTitle>
          <DialogContent>
            <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
              Вы уверены, что хотите удалить это произведение из списка? Действие можно отменить, восстановив и сохранив список заново.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDeletingArtworkIndex(null)}
              sx={{ color: '#fff' }}
              disabled={deletingProcessing}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={confirmDeleteArtwork}
              sx={{
                bgcolor: 'rgba(255, 100, 100, 0.95)',
                '&:hover': {
                  bgcolor: 'rgba(255, 100, 100, 0.85)',
                },
              }}
              disabled={deletingProcessing}
            >
              {deletingProcessing ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={deletingListOpen}
          onClose={() => {
            if (!deletingProcessing) setDeletingListOpen(false);
          }}
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
          <DialogTitle>Удалить весь список произведений?</DialogTitle>
          <DialogContent>
            <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
              Это удалит все сгенерированные произведения для этого сна. Действие невозможно отменить.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDeletingListOpen(false)}
              sx={{ color: '#fff' }}
              disabled={deletingProcessing}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={confirmDeleteList}
              sx={{
                bgcolor: 'rgba(255, 100, 100, 0.95)',
                '&:hover': {
                  bgcolor: 'rgba(255, 100, 100, 0.85)',
                },
              }}
              disabled={deletingProcessing}
            >
              {deletingProcessing ? 'Удаление...' : 'Удалить список'}
            </Button>
          </DialogActions>
        </Dialog>

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