// SimilarArtworksScreen.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getDream,
  findSimilarArtworks,
  updateDream,
  getDreamArtworksInsights,
  getMoodForDate,
  setMoodForDate,
  clearArtChat,
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
  Menu,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DeleteIcon from '@mui/icons-material/Delete';
import MoodIcon from '@mui/icons-material/Mood';

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
import { normalizeInsightsResponse, formatDateTimeRu } from '../../features/insights/helpers';
import { MOODS, type MoodOption } from 'src/features/profile/mood/MoodIcons';
import type { SvgIconProps } from '@mui/material/SvgIcon';

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

const HEADER_BASE = 56;

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

// ✅ Утилита для гарантированного uniqueId
const attachUniqueId = (art: SimilarArtwork, index: number): SimilarArtwork => ({
  ...art,
  uniqueId:
    (art as any).uniqueId ||
    art.artworkId ||
    `art_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 11)}`,
});

// ✅ Стабильный ключ для artwork (одинаковый в списке и в чате)
const getArtworkKey = (art: SimilarArtwork, index: number): string => {
  return art.artworkId || (art as any).uniqueId || `art_${index}`;
};

export function SimilarArtworksScreen(): React.ReactElement {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dream, setDream] = useState<Dream | null>(null);
  const [artworks, setArtworks] = useState<SimilarArtwork[]>([]);
  const [insightsByMessage, setInsightsByMessage] = useState<Record<string, boolean>>({});
  const [insightsByBlock, setInsightsByBlock] = useState<Record<string, boolean>>({});
  const [insightsList, setInsightsList] = useState<any[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState<boolean>(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [dayMood, setDayMood] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodAnchorEl, setMoodAnchorEl] = useState<null | HTMLElement>(null);
  const moodMenuOpen = Boolean(moodAnchorEl);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

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
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  };

  const mainCardSx = {
    width: '100%',
    maxWidth: 840,
    borderRadius: 0,
    background: 'transparent',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    border: 'none',
    boxShadow: 'none',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 'calc(100vh - env(safe-area-inset-top))',
    overflow: 'hidden',
    color: '#fff',
    p: { xs: 2, sm: 3 },
    pt: 2,
    pb: 3,
    mt: `calc(${HEADER_BASE}px + env(safe-area-inset-top))`,
  };

  const heartSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 3.99 4 6.5 4c1.74 0 3.41 0.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18.01 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' /></svg>`;
  const heartMaskUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(heartSvg)}")`;

  const spin3dKeyframes = {
    '@keyframes spin3D': {
      '0%': { transform: 'rotateY(0deg)' },
      '100%': { transform: 'rotateY(360deg)' },
    },
  } as const;

  const heartSxBase = {
    width: 16,
    height: 16,
    minWidth: 16,
    minHeight: 16,
    borderRadius: 0,
    background: 'linear-gradient(135deg, #a77bff 0%, #80ffea 100%)',
    WebkitMaskImage: heartMaskUrl,
    maskImage: heartMaskUrl,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'cover',
    maskSize: 'cover',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    animation: 'spin3D 900ms linear infinite',
    transformStyle: 'preserve-3d' as const,
    backfaceVisibility: 'hidden' as const,
    display: 'inline-block',
  } as const;

  const heartSxSmall = {
    width: 16,
    height: 16,
    minWidth: 16,
    minHeight: 16,
    borderRadius: 0,
    background: 'linear-gradient(135deg, #a77bff 0%, #80ffea 100%)',
    WebkitMaskImage: heartMaskUrl,
    maskImage: heartMaskUrl,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'cover',
    maskSize: 'cover',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    display: 'inline-block',
  } as const;

  const moodGradient = (color: string) => `linear-gradient(135deg, ${color} 0%, rgba(18,22,30,0.06) 100%)`;

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

      if (d.date) {
        const dateYmd = new Date(d.date).toISOString().split('T')[0];
        try {
          const moodId = await getMoodForDate(dateYmd);
          setDayMood(moodId);
          setSelectedMood(moodId);
        } catch (err) {
          console.warn('Failed to load mood for date:', err);
          setDayMood(null);
          setSelectedMood(null);
        }
      }

      if (!force && d.similarArtworks && d.similarArtworks.length > 0) {
        const arts = (d.similarArtworks as SimilarArtwork[]).map((art, i) =>
          attachUniqueId(art, i),
        );
        setArtworks(arts);
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
          d.id,
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
          const withId = (res.similarArtworks || []).map((art, i) => attachUniqueId(art, i));
          setArtworks(withId);
          await updateDream(
            d.id,
            d.dreamText,
            d.title,
            d.blocks,
            d.globalFinalInterpretation,
            d.dreamSummary,
            withId,
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
  }, [id]);

  const handleArtworkChat = (art: SimilarArtwork, idx: number) => {
    if (!id) return;

    const artworkKey = getArtworkKey(art, idx);

    navigate(`/dreams/${id}/artwork-chat/${idx}`, {
      state: {
        artwork: art,
        artworkId: artworkKey,
        artworkIndex: idx,
        origin: 'art_list',
      },
    });
  };

  const handleInsightClick = (insight: any) => {
    if (!dream || !id) return;

    let idx = 0;

    if (insight.blockId && insight.blockId.startsWith('artwork__')) {
      const match = insight.blockId.match(/artwork__(\d+)/);
      if (match) {
        idx = parseInt(match[1], 10);
      }
    }

    const art = dream.similarArtworks?.[idx] as SimilarArtwork | undefined;
    const artworkKey = art ? getArtworkKey(art, idx) : undefined;

    navigate(
      `/dreams/${id}/artwork-chat/${idx}?messageId=${encodeURIComponent(insight.messageId)}`,
      {
        state: {
          highlightMessageId: insight.messageId,
          artwork: art,
          artworkId: artworkKey,
          artworkIndex: idx,
          origin: 'insight',
        },
      },
    );
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
      const currentArt = artworks[idx];
      const artworkId = getArtworkKey(currentArt, idx);

      await clearArtChat(id, artworkId);

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
        dream.id,
        dream.globalFinalInterpretation ?? undefined,
        blockInterpretations
      );

      if ('error' in res) {
        throw new Error(res.message || 'Ошибка перегенерации произведения');
      }

      const candidates = (res.similarArtworks || []) as SimilarArtwork[];
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
      updated[idx] = attachUniqueId(chosen, idx);
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

      showSnackbar('Произведение успешно перегенерировано!', 'success');
    } catch (e: any) {
      showSnackbar(e?.message || 'Ошибка перегенерации произведения', 'error');
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
        dream.id,
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

      const withNew = attachUniqueId(chosen, artworks.length);
      const updated = [...artworks, withNew].slice(0, MAX_ARTWORKS);
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

      showSnackbar('Произведение добавлено', 'success');
    } catch (e: any) {
      showSnackbar(e?.message || 'Ошибка добавления произведения', 'error');
    } finally {
      setRegeneratingArtwork(null);
    }
  };

  const promptDeleteArtwork = (idx: number) => {
    setDeletingArtworkIndex(idx);
  };

  const confirmDeleteArtwork = async () => {
    if (deletingArtworkIndex === null || !dream || !id) {
      setDeletingArtworkIndex(null);
      return;
    }
    const idx = deletingArtworkIndex;
    const currentArt = artworks[idx];
    const artworkId = getArtworkKey(currentArt, idx);

    setDeletingProcessing(true);
    try {
      await clearArtChat(id, artworkId);

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

      showSnackbar('Произведение удалено', 'success');
    } catch (e: any) {
      showSnackbar(e?.message || 'Ошибка удаления', 'error');
    } finally {
      setDeletingProcessing(false);
      setDeletingArtworkIndex(null);
    }
  };

  const promptDeleteList = () => {
    setDeletingListOpen(true);
  };

  const confirmDeleteList = async () => {
    if (!dream || !id) {
      setDeletingListOpen(false);
      return;
    }
    setDeletingProcessing(true);
    try {
      const deletePromises = artworks.map((art, i) => {
        const artworkId = getArtworkKey(art, i);
        return clearArtChat(id, artworkId).catch(() => null);
      });
      await Promise.all(deletePromises);

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
      showSnackbar('Список удалён!', 'success');
    } catch (e: any) {
      showSnackbar(e?.message || 'Ошибка удаления списка', 'error');
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

  const dreamDate = dream?.date ?? null;
  const dateStr = useMemo(() => {
    if (!dreamDate) return '';
    return new Date(dreamDate).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [dreamDate]);

  const Header = (
    <Box
      sx={{
        position: 'fixed',
        top: 'env(safe-area-inset-top)',
        left: 0,
        right: 0,
        height: `${HEADER_BASE}px`,
        background: 'rgba(255,255,255,0.10)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1400,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 8px 28px rgba(41, 52, 98, 0.12)',
        px: 2,
      }}
    >
      <IconButton
        aria-label="Назад"
        onClick={() => navigate(-1)}
        sx={{
          position: 'absolute',
          left: 12,
          color: '#fff',
          bgcolor: 'transparent',
          borderRadius: '50%',
          p: 1,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
        }}
        size="large"
      >
        <ArrowBackIosNewIcon fontSize="small" />
      </IconButton>

      <Typography
        sx={{
          maxWidth: 220,
          textAlign: 'center',
          fontWeight: 600,
          fontSize: '0.98rem',
          color: 'rgba(255,255,255,0.95)',
          letterSpacing: 0.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {dream?.title || 'Saviora'}
      </Typography>

      <Box sx={{ position: 'absolute', right: 12, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Tooltip title="Перегенерировать весь список (форс-запрос)">
          <span>
            <IconButton
              aria-label="перегенерировать весь список"
              onClick={() => fetchArtworks(true)}
              disabled={loading}
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                color: '#fff',
                backgroundColor: 'transparent',
                border: '1px solid rgba(209,213,219,0.45)',
                transition: 'all 0.18s ease',
                '&:hover': {
                  backgroundColor: 'rgba(209,213,219,0.12)',
                },
              }}
            >
              <RefreshIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Удалить весь список">
          <span>
            <IconButton
              aria-label="удалить список"
              onClick={() => promptDeleteList()}
              disabled={loading || artworks.length === 0}
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                color: '#fff',
                backgroundColor: 'transparent',
                border: '1px solid rgba(209,213,219,0.45)',
                transition: 'all 0.18s ease',
                '&:hover': {
                  backgroundColor: 'rgba(209,213,219,0.12)',
                },
              }}
            >
              <DeleteIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );

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

  const effectiveMoodId = useMemo(() => {
    return selectedMood ?? dayMood ?? null;
  }, [selectedMood, dayMood]);

  const currentMoodOption = useMemo(() => {
    return MOODS.find((m: MoodOption) => m.id === effectiveMoodId) ?? null;
  }, [effectiveMoodId]);

  const MoodIconComponent = currentMoodOption?.icon as React.ComponentType<SvgIconProps> | undefined;

  const handleMoodClick = (event: React.MouseEvent<HTMLElement>) => {
    setMoodAnchorEl(event.currentTarget);
  };

  const handleMoodClose = () => {
    setMoodAnchorEl(null);
  };

  const handleMoodSelect = async (moodId: string) => {
    if (!dream?.id || !dream?.date) return;
    try {
      const dateYmd = new Date(dream.date).toISOString().split('T')[0];
      await setMoodForDate(dateYmd, moodId);
      setSelectedMood(moodId);
      setDayMood(moodId);
      showSnackbar('Настроение дня обновлено', 'success');
    } catch (e: any) {
      showSnackbar(e.message || 'Ошибка обновления настроения', 'error');
    } finally {
      handleMoodClose();
    }
  };

  return (
    <Box sx={pageSx}>
      {Header}

      <Box sx={mainCardSx}>
        {dream && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2,
            }}
          >
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
                  flex: '0 0 auto',
                }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1.5,
                    minWidth: 0,
                  }}
                >
                  {dateStr && (
                    <Chip
                      label={dateStr}
                      size="small"
                      sx={{
                        borderColor: alpha('#ffffff', 0.24),
                        background:
                          'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(200,220,255,0.14))',
                        color: alpha('#ffffff', 0.92),
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        '& .MuiChip-label': {
                          px: 1.2,
                          fontWeight: 600,
                        },
                      }}
                    />
                  )}

                  {dream.category && (
                    <Chip
                      label={dream.category}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontWeight: 500,
                        border: `1px solid ${alpha('#fff', 0.1)}`,
                      }}
                    />
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Tooltip title={currentMoodOption?.label ?? 'Выбрать настроение'} arrow>
                      <span>
                        <IconButton
                          aria-label="Выбрать настроение"
                          onClick={handleMoodClick}
                          sx={{
                            p: 0,
                            borderRadius: '50%',
                            '&:hover': { transform: 'translateY(-1px)' },
                          }}
                        >
                          {currentMoodOption ? (
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                background: moodGradient(currentMoodOption.color),
                                boxShadow: `0 4px 12px ${alpha('#000', 0.2)}`,
                              }}
                            >
                              {MoodIconComponent ? (
                                <MoodIconComponent style={{ color: '#fff', fontSize: 16 }} />
                              ) : (
                                <MoodIcon style={{ color: '#fff', fontSize: 16 }} />
                              )}
                            </Avatar>
                          ) : (
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                background: alpha('#fff', 0.04),
                                border: `1px solid ${alpha('#fff', 0.1)}`,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: '50%',
                                  bgcolor: 'rgba(255,255,255,0.6)',
                                }}
                              />
                            </Avatar>
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    {currentMoodOption && (
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}
                      >
                        {currentMoodOption.label}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Menu
                  anchorEl={moodAnchorEl}
                  open={moodMenuOpen}
                  onClose={handleMoodClose}
                  MenuListProps={{
                    'aria-labelledby': 'mood-button',
                  }}
                  PaperProps={{
                    sx: {
                      bgcolor: 'rgba(255,255,255,0.06)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${glassBorder}`,
                      color: '#fff',
                      mt: 1,
                      minWidth: 260,
                    },
                  }}
                >
                  {MOODS.map((mood: MoodOption) => {
                    const Icon = mood.icon as React.ComponentType<SvgIconProps>;
                    const isActive = mood.id === effectiveMoodId;
                    return (
                      <MenuItem
                        key={mood.id}
                        onClick={() => handleMoodSelect(mood.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          color: '#fff',
                          bgcolor: isActive ? alpha('#000', 0.06) : 'transparent',
                          borderRadius: 1,
                          px: 1.25,
                          py: 0.5,
                          '&:hover': {
                            bgcolor: `linear-gradient(135deg, ${alpha(
                              mood.color,
                              0.16,
                            )} 0%, ${alpha(mood.color, 0.08)} 100%)`,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `linear-gradient(135deg, ${mood.color} 0%, rgba(20,30,40,0.06) 100%)`,
                            boxShadow: isActive
                              ? `0 14px 36px ${alpha('#000', 0.18)}, 0 0 0 6px ${alpha(
                                  mood.color,
                                  0.06,
                                )}`
                              : `0 8px 22px ${alpha('#000', 0.1)}`,
                          }}
                        >
                          <Icon sx={{ color: '#fff', width: 20, height: 20 }} />
                        </Box>

                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ color: '#fff' }}>
                            {mood.label}
                          </Typography>
                        </Box>

                        {isActive && (
                          <Typography
                            variant="caption"
                            sx={{ color: alpha(mood.color, 0.95), fontWeight: 700 }}
                          >
                            ✓
                          </Typography>
                        )}
                      </MenuItem>
                    );
                  })}
                </Menu>
              </Box>
            </Box>

            <Box sx={{ width: 0, height: 0 }} />
          </Box>
        )}

        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${glassBorder}`,
            borderRadius: 2,
            color: '#fff',
            boxShadow: 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, minWidth: 0 }}>
            <Box sx={heartSxSmall} aria-hidden />
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
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
                      transition: 'transform 0.18s ease, background 0.18s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        background:
                          'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(88,120,255,0.10))',
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

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Chip
            label="Схожие произведения искусства"
            size="small"
            sx={{
              borderColor: alpha('#ffffff', 0.24),
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(200,220,255,0.14))',
              color: alpha('#ffffff', 0.92),
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: 999,
              '& .MuiChip-label': {
                px: 1.6,
                py: 0.4,
                fontWeight: 600,
                fontSize: '0.85rem',
              },
            }}
          />
        </Box>

        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
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
              <Typography
                color="rgba(255,255,255,0.65)"
                sx={{ mt: 2, textAlign: 'center' }}
              >
                Ничего не найдено.
              </Typography>
            )}

            {artworks.map((art, idx) => {
              const isRegenerating = regeneratingArtwork === idx;

              const key =
                (art as any).uniqueId ||
                art.artworkId ||
                `art-${idx}`;

              return (
                <ListItem
                  key={key}
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
                    py: { xs: 1.4, sm: 1.6 },
                    px: { xs: 1.6, sm: 2 },
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${glassBorder}`,
                    minHeight: 84,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.07)',
                      transform: 'translateY(-2px)',
                    },
                    position: 'relative',
                    overflow: 'visible',
                    cursor: 'pointer',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      width: '100%',
                    }}
                  >
                    {renderArtworkAvatar(art, idx)}

                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.75,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1,
                          minWidth: 0,
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            fontWeight: 700,
                            fontSize: '0.98rem',
                            color: '#fff',
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {art.title}
                        </Typography>

                        <Box
                          sx={{
                            display: 'flex',
                            flexShrink: 0,
                            gap: 1,
                            alignItems: 'center',
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
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '999px',
                                  color: '#fff',
                                  backgroundColor: 'rgba(255,255,255,0.10)',
                                  border: '1px solid rgba(255,255,255,0.25)',
                                  boxShadow: 'none',
                                  backdropFilter: 'blur(8px)',
                                  WebkitBackdropFilter: 'blur(8px)',
                                  transition:
                                    'background-color 0.18s ease, transform 0.18s ease',
                                  '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.18)',
                                    transform: 'translateY(-1px)',
                                  },
                                  '& .MuiSvgIcon-root': {
                                    fontSize: 18,
                                  },
                                }}
                              >
                                {isRegenerating ? (
                                  <Box
                                    sx={{
                                      ...spin3dKeyframes,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Box sx={{ ...heartSxBase }} aria-hidden />
                                  </Box>
                                ) : (
                                  <AutorenewIcon
                                    sx={{ color: 'rgba(255,255,255,0.95)' }}
                                  />
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
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '999px',
                                  color: '#fff',
                                  backgroundColor: 'rgba(255,255,255,0.10)',
                                  border: '1px solid rgba(255,255,255,0.25)',
                                  boxShadow: 'none',
                                  backdropFilter: 'blur(8px)',
                                  WebkitBackdropFilter: 'blur(8px)',
                                  transition:
                                    'background-color 0.18s ease, transform 0.18s ease',
                                  '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.18)',
                                    transform: 'translateY(-1px)',
                                  },
                                  '& .MuiSvgIcon-root': {
                                    fontSize: 18,
                                  },
                                }}
                              >
                                <DeleteIcon sx={{ color: 'rgba(255,255,255,0.95)' }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </Box>

                      <Box sx={{ mt: 0.25 }}>
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{
                            display: 'block',
                            fontSize: '0.86rem',
                            fontWeight: 500,
                            color: 'rgba(255,255,255,0.9)',
                            mb: 0.25,
                          }}
                        >
                          {art.author}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.83rem',
                            lineHeight: 1.35,
                            color: 'rgba(255,255,255,0.8)',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {art.desc}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </ListItem>
              );
            })}

            {artworks.length < MAX_ARTWORKS &&
              (() => {
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
                      py: { xs: 1.4, sm: 1.6 },
                      px: { xs: 1.6, sm: 2 },
                      borderRadius: 2,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${glassBorder}`,
                      minHeight: 84,
                      transition: 'all 0.18s ease',
                      '&:hover': {
                        background: 'rgba(255,255,255,0.07)',
                        transform: 'translateY(-2px)',
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
                            <IconButton
                              aria-label="генерация"
                              disabled
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '999px',
                                color: '#fff',
                                backgroundColor: 'rgba(255,255,255,0.10)',
                                border: '1px solid rgba(255,255,255,0.25)',
                                boxShadow: 'none',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                              }}
                            >
                              <Box
                                sx={{
                                  ...spin3dKeyframes,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Box sx={{ ...heartSxBase }} aria-hidden />
                              </Box>
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    )}

                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        mr: 2,
                        position: 'relative',
                        flexShrink: 0,
                      }}
                    >
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
                        minWidth: 0,
                      }}
                      primary={
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.98rem',
                            color: '#fff',
                            lineHeight: 1.25,
                          }}
                        >
                          Добавление произведения
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.83rem',
                            color: 'rgba(255,255,255,0.8)',
                            lineHeight: 1.4,
                            mt: 0.4,
                          }}
                        >
                          Нажмите на карточку, чтобы сгенерировать новое похожее
                          произведение.
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
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{
            bottom: '20vh',
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
              sx={{
                fontSize: '1.0rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {snackbarMessage}
            </Box>
          </Paper>
        </Snackbar>
      </Box>
    </Box>
  );
}

export default SimilarArtworksScreen;