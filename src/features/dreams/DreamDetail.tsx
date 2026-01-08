// DreamDetail.tsx
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
  Menu,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import InsightsIcon from '@mui/icons-material/Insights';
import MoodIcon from '@mui/icons-material/Mood';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  updateDream,
  deleteDream as apiDeleteDream,
  getDreams,
  generateAutoSummary,
  getDreamInsights,
  getMoodForDate,
  setMoodForDate,
} from '../../utils/api';
import type { Dream } from '../../utils/api';
import { DreamBlocks } from './DreamBlocks';
import type { WordBlock } from './DreamTextSelector';
import { normalizeInsightsResponse, formatDateTimeRu } from '../../features/insights/helpers';
import { MOODS, type MoodOption } from 'src/features/profile/mood/MoodIcons';

import SplitscreenIcon from '@mui/icons-material/Splitscreen';
import PaletteIcon from '@mui/icons-material/Palette';

type EnrichedDreamInsight = {
  messageId: string;
  text: string;
  blockId: string | null;
  createdAt: string;
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

// Высота хедера как в ProfileEditForm
const HEADER_BASE = 56;


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
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [dayMood, setDayMood] = useState<string | null>(null);

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

  const [moodAnchorEl, setMoodAnchorEl] = useState<null | HTMLElement>(null);
  const moodMenuOpen = Boolean(moodAnchorEl);

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
  pt: 2, // обычный внутренний отступ
  pb: 3,
  // ключевая строка — смещаем весь блок под фикс‑хедер
  mt: `calc(${HEADER_BASE}px + env(safe-area-inset-top))`,
};

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

  // Heart mask SVG + small gradient heart sx
  const heartSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 3.99 4 6.5 4c1.74 0 3.41 0.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18.01 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' /></svg>`;
  const heartMaskUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(heartSvg)}")`;
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

  // ---- fetch dream ----
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
        const dreamList = Array.isArray(dreamsResponse) ? dreamsResponse : [];

        if (!dreamList.length) {
          setError('Сон не найден');
          setDream(null);
          setBlocks([]);
          return;
        }

        const found = dreamList.find((d) => d.id === id);
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

        const dateYmd = new Date(found.date).toISOString().split('T')[0];
        getMoodForDate(dateYmd)
          .then((moodId) => {
            setDayMood(moodId);
            setSelectedMood(moodId);
          })
          .catch((err) => {
            console.warn('Не удалось загрузить настроение дня:', err);
          });

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

  // ---- insights ----
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

  // ---- auto summary on blocks view ----
  useEffect(() => {
    const run = async () => {
      if (!isBlockView || autoSummaryRequested) return;
      if (!dream?.id || !dream?.dreamText) return;
      if (dream.autoSummary) return;

      setAutoSummaryRequested(true);
      try {
        await generateAutoSummary(dream.id, dream.dreamText);
        const dreamsResponse = await getDreams();
        const dreamList = Array.isArray(dreamsResponse) ? dreamsResponse : [];
        const refreshed = dreamList.find((d) => d.id === dream.id);
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
          const dreamList = Array.isArray(dreamsResponse) ? dreamsResponse : [];
          const refreshed = dreamList.find((d) => d.id === updated.id);
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

  navigate(url, { replace: true }); // КЛЮЧЕВОЕ: не добавляем лишний шаг в историю
};

  const handleInsightClick = (insight: EnrichedDreamInsight) => {
    if (!dream) return;

    const matchedBlock = insight.blockId
      ? blocks.find((block) => block.id === insight.blockId)
      : null;

    const fallbackBlock = blocks.length ? blocks[0].id : null;
    const targetBlockId = matchedBlock ? matchedBlock.id : fallbackBlock;

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

  const handleMoodClick = (event: React.MouseEvent<HTMLElement>) => {
    setMoodAnchorEl(event.currentTarget);
  };

  const handleMoodClose = () => {
    setMoodAnchorEl(null);
  };

  const handleMoodSelect = async (moodId: string) => {
    if (!dream?.id) return;
    try {
      const dateYmd = new Date(dream.date).toISOString().split('T')[0];
      await setMoodForDate(dateYmd, moodId);
      setSelectedMood(moodId);
      setDayMood(moodId);
      setSnackbar({ open: true, message: 'Настроение дня обновлено', severity: 'success' });
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e.message || 'Ошибка обновления настроения',
        severity: 'error',
      });
    } finally {
      handleMoodClose();
    }
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
      return (
        insight.insightLiked === true ||
        (insight.meta && (insight.meta as Record<string, unknown>).insightLiked === true)
      );
    });
  }, [insights]);

  const insightsCount = filteredInsights.length;

  const effectiveMoodId = useMemo(() => {
    return selectedMood ?? dayMood ?? null;
  }, [selectedMood, dayMood]);

  const currentMoodOption = useMemo(() => {
    return MOODS.find((m: MoodOption) => m.id === effectiveMoodId) ?? null;
  }, [effectiveMoodId]);

  const MoodIconComponent = currentMoodOption?.icon as
    | React.ComponentType<SvgIconProps>
    | undefined;

  const moodGradient = (color: string) =>
    `linear-gradient(135deg, ${color} 0%, rgba(18,22,30,0.06) 100%)`;

  // ---- Header JSX (общий для всех состояний) ----
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
          maxWidth: 200,
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
  <IconButton
    aria-label="Редактировать"
    title="Редактировать"
    onClick={() => setEditing(true)}
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
    <EditIcon sx={{ fontSize: 20 }} />
  </IconButton>

  <IconButton
    aria-label="Удалить"
    title="Удалить"
    onClick={() => setDeleting(true)}
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
</Box>
    </Box>
  );

  // ---- Loading / error ----
  if (loading) {
    return (
      <Box sx={pageSx}>
        {Header}
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
        {Header}
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
    {Header}

    <Box sx={mainCardSx}>
      {/* Верхняя часть карточки под хедером */}
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
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Контейнер для даты, категории и настроения */}
            <Box 
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                alignItems: 'center', 
                gap: 1.5 
              }}
            >
              {dateStr && (
                <Chip
                  label={dateStr}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: alpha('#ffffff', 0.24),
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(200,220,255,0.14))',
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

              {/* Mood display переехал сюда в общий ряд */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.6)' }} />
                        </Avatar>
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                {currentMoodOption && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                    {currentMoodOption.label}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Меню выбора настроения */}
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
      </Box>

      {/* ----------- НЕ РЕДАКТИРУЕМЫЙ РЕЖИМ ----------- */}
      {!editing ? (
        <>
          <Paper
  elevation={0}
  sx={{
    p: 2,
    mb: 2,
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${glassBorder}`,
    borderRadius: 2.5,
    position: 'relative',
    boxShadow: 'none',
  }}
>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box sx={heartSxSmall} aria-hidden />
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
                Пока нет сохранённых инсайтов. Дважды коснитесь сообщения ассистента в диалоге,
                чтобы сохранить инсайт.
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
                        bgcolor: liked
                          ? 'rgba(255,120,160,0.12)'
                          : 'rgba(255,255,255,0.05)',
                        border: `1px solid rgba(255,255,255,0.08)`,
                        borderRadius: 2,
                        transition:
                          'transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease',
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
                      <Typography
                        variant="body2"
                        sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}
                      >
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

          {dream.dreamSummary && (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      mb: 2,
      background: 'rgba(255,255,255,0.05)',
      border: `1px solid ${glassBorder}`,
      borderRadius: 2,
      boxShadow: 'none',
    }}
  >
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, color: 'rgba(255,255,255,0.8)' }}
              >
                Контекст:
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}
              >
                {dream.dreamSummary}
              </Typography>
            </Paper>
          )}
{dream.globalFinalInterpretation && (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      mb: 2,
      borderRadius: 2,
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(88,120,255,0.03))',
      border: `1px solid ${glassBorder}`,
      boxShadow: 'none',
    }}
  >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 1, color: '#fff' }}
              >
                Итоговое толкование
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}
              >
                {dream.globalFinalInterpretation}
              </Typography>
            </Paper>
          )}

          {/* Текст сновидения + кнопки внизу */}
<Paper
  elevation={0}
  sx={{
    p: 2,
    pb: 2.5,
    mb: 3,
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${glassBorder}`,
    borderRadius: 2,
    boxShadow: 'none',
  }}
>
            <Typography
  variant="subtitle2"
  sx={{ mb: 1, color: 'rgba(255,255,255,0.8)' }}
>
  Текст:
</Typography>
<Typography
  variant="body1"
  sx={{ color: '#fff', whiteSpace: 'pre-wrap', mb: 2 }}
>
  {dream.dreamText}
</Typography>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <IconButton
  aria-label="Схожие произведения искусства"
  title="Схожие произведения искусства"
  onClick={() => navigate(`/dreams/${dream.id}/similar`)}
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
  <PaletteIcon sx={{ fontSize: 20 }} />
</IconButton>
              <IconButton
  aria-label="Блоки сна"
  title="Блоки сна"
  onClick={() => handleOpenBlockView()}
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
  <SplitscreenIcon sx={{ fontSize: 20 }} />
</IconButton>
            </Box>
          </Paper>

          {/* Диалог с блоками сна */}
           <Dialog
  open={isBlockView}
  onClose={handleCloseBlockView}
  maxWidth="md"
  fullWidth
  scroll="paper"
  sx={{
    '& .MuiDialog-container': {
      alignItems: 'flex-start', // не по центру, а сверху
      paddingTop: `calc(${HEADER_BASE}px + env(safe-area-inset-top) + 12px)`,
      paddingBottom: `calc(env(safe-area-inset-bottom) + 12px)`,
    },
  }}
  PaperProps={{
    sx: {
      // теперь модалка НЕ сможет уехать вверх под хедер
      // и НЕ сможет вылезти вниз — она ограничена контейнером
      maxHeight: '100%',
      width: '100%',
      m: 0, // важно: margin убираем, у нас padding у container
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: 4,
      background:
        'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
      backdropFilter: 'blur(18px)',
      border: `1px solid ${glassBorder}`,
      color: '#fff',
      boxShadow: '0 12px 60px rgba(24,32,80,0.38)',
    },
  }}
>
            <DialogTitle
  sx={{
    px: 3,
    pt: 2,
    pb: 1,

    position: 'sticky',
    top: 0,
    zIndex: 2,

    backdropFilter: 'blur(10px)',
    background: 'rgba(40,56,96,0.35)',
    borderBottom: '1px solid rgba(255,255,255,0.10)',
  }}
>
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
                      <Box
                        component="span"
                        sx={{ fontSize: '0.65rem', fontWeight: 700, lineHeight: 1 }}
                      >
                        -1
                      </Box>
                    }
                    sx={{
                      '& .MuiBadge-badge': {
                        pointerEvents: 'none',
                        background: blocks.length
                          ? 'linear-gradient(135deg, #a77bff 0%, #80ffea 100%)'
                          : 'rgba(255,255,255,0.12)',
                        color: '#fff',
                        minWidth: 18,
                        height: 18,
                        borderRadius: '9px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                        transform: 'translate(50%,-70%)',
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
                          bgcolor: blocks.length
                            ? 'rgba(255,255,255,0.16)'
                            : 'rgba(255,255,255,0.08)',
                        },
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Badge>
                </Tooltip>
              </Box>
            </DialogTitle>

            <DialogContent
  dividers
  sx={{
    px: 3,
    pt: 1,
    pb: 10,        // запас под кнопку чата
    flex: 1,       // занимает всё оставшееся место
    minHeight: 0,  // критично для flex+scroll
    overflowY: 'auto',
  }}
>
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
        // ----------- РЕЖИМ РЕДАКТИРОВАНИЯ ----------- //
        <Box
          component="form"
          sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
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
            PaperComponent={({ children }) => (
              <Paper
                sx={{
                  bgcolor: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${glassBorder}`,
                  borderRadius: 2,
                  color: '#fff',
                  mt: 0.5,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
              >
                {children}
              </Paper>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Категория"
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
            label="Контекст"
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
            label="Текст"
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

          <Box
  sx={{
    display: 'flex',
    gap: 1.5,
    mt: 3,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  }}
>
  {/* Отмена — прозрачная капсула */}
  <Button
    variant="outlined"
    onClick={() => setEditing(false)}
    sx={{
      textTransform: 'none',
      fontWeight: 500,
      px: 3,
      py: 1.1,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(220,230,255,0.45)',
      color: 'rgba(255,255,255,0.9)',
      backgroundColor: 'rgba(255,255,255,0.04)',
      boxShadow: 'none',
      letterSpacing: 0.2,
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(220,230,255,0.7)',
        boxShadow: '0 6px 18px rgba(24,32,80,0.28)',
      },
    }}
  >
    Отмена
  </Button>

  {/* Сохранить — капсула, градиент как у "Сделать целью" */}
  <Button
    variant="contained"
    onClick={handleSave}
    disabled={!editedText.trim()}
    sx={{
      textTransform: 'none',
      fontWeight: 600,
      px: 3.2,
      py: 1.1,
      borderRadius: 999,
      background:
        'linear-gradient(135deg, #6C7CFF 0%, #B36CFF 100%)', // как "Сделать целью"
      color: '#fff',
      border: 'none',
      boxShadow: '0 6px 18px rgba(24,32,80,0.35)',
      letterSpacing: 0.25,
      transition: 'all 0.22s ease',
      '&:hover': {
        background:
          'linear-gradient(135deg, #7484FF 0%, #BD76FF 100%)',
        boxShadow: '0 10px 26px rgba(24,32,80,0.45)',
        transform: 'translateY(-1px)',
      },
      '&:active': {
        transform: 'translateY(0)',
        boxShadow: '0 4px 14px rgba(24,32,80,0.32)',
      },
      '&.Mui-disabled': {
        background:
          'linear-gradient(135deg, rgba(108,124,255,0.35), rgba(179,108,255,0.32))',
        color: 'rgba(255,255,255,0.65)',
        boxShadow: 'none',
      },
    }}
  >
    Сохранить
  </Button>
</Box>
        </Box>
      )}

      {/* Диалог удаления */}
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        PaperProps={{
          sx: {
            background:
              'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
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

      <Snackbar
  open={snackbar.open}
  autoHideDuration={4000}
  onClose={(_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((s) => ({ ...s, open: false }));
  }}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
  sx={{
    '&.MuiSnackbar-root': {
      bottom: '25vh', // как и было
    },
  }}
>
  <Alert
    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
    severity={snackbar.severity}
    icon={false}
    variant="outlined"
    sx={{
      width: '100%',
      px: 2.4,
      py: 1.4,
      borderRadius: 2.5,
      display: 'flex',
      alignItems: 'center',
      border: `1px solid ${glassBorder}`,
      background: 'rgba(255,255,255,0.10)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      boxShadow: 'none', // было: '0 18px 45px rgba(0,0,0,0.55)'
      color: '#fff',
      '& .MuiAlert-message': {
        fontSize: '1.05rem',
        padding: 0,
      },
      ...(snackbar.severity === 'error'
        ? {
            borderColor: 'rgba(255,120,120,0.7)',
            // без доп. тени для error
            boxShadow: 'none',
          }
        : {}),
    }}
  >
    {snackbar.message}
  </Alert>
</Snackbar>
    </Box>
  </Box>
);
}

export default DreamDetail;