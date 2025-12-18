import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Snackbar,
  Autocomplete,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MoodIcon from '@mui/icons-material/Mood';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from 'src/utils/api';
import type { DailyConvo as ApiDailyConvo } from 'src/utils/api';
import { formatDateTimeRu } from 'src/features/insights/helpers';
import { MOODS, type MoodOption } from 'src/features/profile/mood/MoodIcons';

type EnrichedDailyConvoInsight = {
  messageId: string;
  text: string;
  blockId: string | null;
  createdAt: string;
  insightLiked?: boolean;
  meta?: Record<string, unknown>;
};

const categories = [
  'Личное',
  'Работа',
  'Учеба',
  'Здоровье',
  'Финансы',
  'Отношения',
  'Путешествия',
  'Другое',
];

export function DailyConvoScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [convo, setConvo] = useState<ApiDailyConvo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedText, setEditedText] = useState('');
  const [editedContext, setEditedContext] = useState<string | null>('');
  const [editedCategory, setEditedCategory] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [dayMood, setDayMood] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [autoSummaryRequested, setAutoSummaryRequested] = useState(false);

  const [insights, setInsights] = useState<EnrichedDailyConvoInsight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

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

  // Heart mask SVG + small gradient heart sx (to match SimilarArtworksScreen gradient heart)
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

  // Безопасный перевод timestamp в миллисекунды:
  const toMs = (v: unknown): number | undefined => {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    if (!isFinite(n)) return undefined;
    return n < 1e12 ? n * 1000 : n;
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!id) {
          setError('ID записи не указан');
          setConvo(null);
          return;
        }
        const found = await api.getDailyConvo(id);
        if (!mounted) return;
        setConvo(found ?? null);
        setEditedTitle(found?.title ?? '');
        setEditedText(found?.notes ?? found?.body ?? '');
        setEditedContext(found?.context ?? '');
        setEditedCategory(found?.category ?? null);

        const dateYmd = new Date(toMs(found?.date ?? found?.createdAt) ?? Date.now()).toISOString().split('T')[0];
        api.getMoodForDate(dateYmd)
          .then(moodId => {
            setDayMood(moodId);
            setSelectedMood(moodId);
          })
          .catch(err => {
            console.warn('Не удалось загрузить настроение дня:', err);
          });

      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? 'Ошибка загрузки');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Автоматическая генерация автосаммари при первом заходе
  useEffect(() => {
    if (!convo?.id) return;
    if (autoSummaryRequested) return;
    if (convo.autoSummary) return;

    const generateSummary = async () => {
      setAutoSummaryRequested(true);
      try {
        await api.generateAutoSummaryDailyConvo(convo.id, convo.notes ?? convo.body ?? '');
        const refreshed = await api.getDailyConvo(convo.id);
        if (refreshed) {
          setConvo(refreshed);
        }
      } catch (e) {
        console.error('Auto summary generation error:', e);
      } finally {
        setAutoSummaryRequested(false);
      }
    };

    generateSummary();
  }, [convo, autoSummaryRequested]);

  useEffect(() => {
    if (!convo?.id) return;

    let mounted = true;
    setInsightsLoading(true);
    setInsightsError(null);
    setInsights(null);

    void (async () => {
      try {
        const raw = await api.getDailyConvoInsights(convo.id);
        if (!mounted) return;
        const list = Array.isArray(raw) ? raw : [];
        const normalized = list
          .filter((insight) => Boolean(insight?.text?.trim?.()))
          .map((insight) => ({
            ...insight,
            createdAt: new Date(toMs(insight?.createdAt) ?? Date.now()).toISOString(),
            text: insight?.text ?? '',
            messageId: insight?.messageId ?? `insight-${Math.random().toString(36).slice(2)}`,
            blockId: insight?.blockId ?? null,
            insightLiked: insight?.insightLiked ?? Boolean(insight?.meta?.insightLiked),
            meta: insight?.meta ?? {},
          }));
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
  }, [convo?.id]);

  const handleSave = async () => {
    if (!convo) return;
    try {
      const textChanged = editedText.trim() !== (convo.notes ?? convo.body ?? '').trim();

      const updated = await api.updateDailyConvo(
        convo.id,
        editedText, // notes
        editedTitle || null,
        undefined, // blocks
        undefined, // globalFinalInterpretation
        convo.autoSummary || null, // оставляем текущее autoSummary, чтобы не затирать
        editedCategory || null, // category
        editedContext || null, // context
        undefined // date
      );
      setConvo(updated);
      setEditing(false);
      setSnackbar({ open: true, message: 'Запись обновлена', severity: 'success' });

      if (textChanged && updated?.id && (updated?.notes ?? updated?.body)) {
        try {
          setAutoSummaryRequested(true);
          await api.generateAutoSummaryDailyConvo(updated.id, updated.notes ?? updated.body ?? '');
          const refreshed = await api.getDailyConvo(updated.id);
          setConvo(refreshed);
        } catch (e) {
          console.error('Auto summary regen error:', e);
        } finally {
          setAutoSummaryRequested(false);
        }
      }
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message ?? 'Ошибка обновления', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!convo) return;
    try {
      await api.deleteDailyConvo(convo.id);
      setSnackbar({ open: true, message: 'Запись удалена', severity: 'success' });
      navigate('/daily');
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message ?? 'Ошибка удаления', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleInsightClick = (insight: EnrichedDailyConvoInsight) => {
    if (!convo) return;

    const params = new URLSearchParams();
    params.set('messageId', insight.messageId);
    params.set('highlight', Date.now().toString());

    navigate(`/daily/${convo.id}/chat?${params.toString()}`, {
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
    if (!convo?.id) return;
    try {
      const dateYmd = new Date(toMs(convo.date ?? convo.createdAt) ?? Date.now()).toISOString().split('T')[0];
      await api.setMoodForDate(dateYmd, moodId);
      setSelectedMood(moodId);
      setDayMood(moodId);
      setSnackbar({ open: true, message: 'Настроение дня обновлено', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Ошибка обновления настроения', severity: 'error' });
    } finally {
      handleMoodClose();
    }
  };

  const convoDate = convo?.date ?? convo?.createdAt ?? null;
  const dateStr = useMemo(() => {
    const ms = toMs(convoDate);
    if (!ms) return '';
    return new Date(ms).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [convoDate]);

  const displayInsights = useMemo(() => {
    if (!insights) return [];
    return [...insights].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [insights]);

  const insightsCount = displayInsights.length;

  const effectiveMoodId = useMemo(() => {
    return selectedMood ?? dayMood ?? null;
  }, [selectedMood, dayMood]);

  const currentMoodOption = useMemo(() => {
    return MOODS.find((m: MoodOption) => m.id === effectiveMoodId) ?? null;
  }, [effectiveMoodId]);

  const MoodIconComponent = currentMoodOption?.icon as React.ComponentType<SvgIconProps> | undefined;

  const moodGradient = (color: string) => `linear-gradient(135deg, ${color} 0%, rgba(18,22,30,0.06) 100%)`;

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

  if (!convo) {
    return (
      <Box sx={pageSx}>
        <Box sx={mainCardSx}>
          <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            Дневная запись не найдена
          </Alert>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => navigate('/daily')} sx={{ bgcolor: accentColor }}>Назад</Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={pageSx}>
      <Box sx={mainCardSx}>
        <IconButton
          aria-label="Назад"
          onClick={() => navigate('/daily')}
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

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, pt: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src="/logo.png" // Замените на актуальный логотип, если есть
              alt="Daily Convo"
              sx={{
                width: 48,
                height: 48,
                border: `1px solid ${glassBorder}`,
                backgroundColor: 'rgba(255,255,255,0.08)',
                boxShadow: '0 8px 24px rgba(24,32,80,0.3)',
              }}
            />
            <Box>
  <Chip
    label={dateStr}
    size="small"
    variant="outlined"
    sx={{
      mb: convo.title ? 1 : 1.2,
      borderColor: alpha('#ffffff', 0.24),
      background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(200,220,255,0.14))',
      color: alpha('#ffffff', 0.92),
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      '& .MuiChip-label': {
        px: 1.6,
        py: 0.38,
        fontWeight: 600,
        letterSpacing: 0.2,
      },
    }}
  />
  {convo.title && (
    <Typography variant="h6" sx={{ mb: 1, color: '#fff' }}>
      {convo.title}
    </Typography>
  )}
  {convo.category && (
    <Chip
      label={convo.category}
      size="small"
      sx={{
        bgcolor: 'rgba(255,255,255,0.1)',
        color: '#fff',
        mb: 1,
                  }}
                />
              )}
              {/* Mood display */}
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
                <Tooltip title={currentMoodOption?.label ?? 'Выбрать настроение'} arrow>
                  <span>
                    <IconButton
                      aria-label="Выбрать настроение"
                      onClick={handleMoodClick}
                      sx={{
                        p: 0,
                        mr: 0.5,
                        borderRadius: '50%',
                        bgcolor: 'transparent',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                        },
                        cursor: 'pointer',
                      }}
                    >
                      {currentMoodOption ? (
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            background: moodGradient(currentMoodOption.color),
                            color: '#fff',
                            boxShadow: `0 10px 28px ${alpha('#000', 0.18)}, ${currentMoodOption ? `0 0 0 6px ${alpha(currentMoodOption.color, 0.06)}` : 'none'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {MoodIconComponent ? (
                            <MoodIconComponent style={{ color: '#fff', fontSize: 18 }} />
                          ) : (
                            <MoodIcon style={{ color: '#fff', fontSize: 18 }} />
                          )}
                        </Avatar>
                      ) : (
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            background: alpha('#fff', 0.04),
                            color: 'rgba(255,255,255,0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.6)' }} />
                        </Avatar>
                      )}
                    </IconButton>
                  </span>
                </Tooltip>

                {currentMoodOption && (
                  <Typography variant="caption" sx={{ color: '#fff' }}>
                    {currentMoodOption.label}
                  </Typography>
                )}

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
                            bgcolor: `linear-gradient(135deg, ${alpha(mood.color, 0.16)} 0%, ${alpha(mood.color, 0.08)} 100%)`,
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
                            boxShadow: isActive ? `0 14px 36px ${alpha('#000', 0.18)}, 0 0 0 6px ${alpha(mood.color, 0.06)}` : `0 8px 22px ${alpha('#000', 0.10)}`,
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
                          <Typography variant="caption" sx={{ color: alpha(mood.color, 0.95), fontWeight: 700 }}>
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
                  Пока нет сохранённых инсайтов. Дважды коснитесь сообщения ассистента в диалоге, чтобы
                  сохранить инсайт.
                </Typography>
              )}

              {!insightsLoading && !insightsError && insightsCount > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {displayInsights.map((insight, index) => {
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

            {convo.context && (
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
    {convo.notes ?? convo.body}
  </Typography>

  <Box sx={{ display: 'flex', gap: 1 }}>
  <IconButton aria-label="Редактировать" onClick={() => setEditing(true)} sx={iconBtnSxLight}>
    <EditIcon fontSize="small" />
  </IconButton>
  <IconButton aria-label="Удалить" onClick={() => setDeleting(true)} sx={iconBtnSxLight}>
    <DeleteIcon fontSize="small" />
  </IconButton>
</Box>
</Paper>
            )}

            {convo.autoSummary && (
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
                  {convo.autoSummary}
                </Typography>
              </Paper>
            )}

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
    {convo.notes ?? convo.body}
  </Typography>

  {/* Плавающая кнопка перехода к чату в правом нижнем углу карточки */}
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
    <IconButton
      aria-label="Открыть чат"
      onClick={() => navigate(`/daily/${convo.id}/chat`)}
      sx={iconBtnSxLight}
    >
      <ChatBubbleOutlineRoundedIcon fontSize="small" />
    </IconButton>
  </Box>
</Paper>
          </>
        ) : (
          <Box component="form" sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Заголовок"
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
      label="Категория записи"
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
              fullWidth
              label="Контекст (коротко)"
              value={editedContext ?? ''}
              onChange={(e) => setEditedContext(e.target.value)}
              variant="outlined"
              multiline
              minRows={3}
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
              fullWidth
              label="Запись дня"
              multiline
              rows={6}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              variant="outlined"
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
            <Box sx={{ display: 'flex', gap: 1 }}>
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
          <DialogTitle>Удалить запись?</DialogTitle>
          <DialogContent>
            <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
              Вы уверены, что хотите удалить эту дневную запись? Это действие нельзя отменить.
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

export default DailyConvoScreen;