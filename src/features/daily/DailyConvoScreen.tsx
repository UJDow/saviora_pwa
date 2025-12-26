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
  Menu,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MoodIcon from '@mui/icons-material/Mood';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from 'src/utils/api';
import type { DailyConvo as ApiDailyConvo } from 'src/utils/api';
import { formatDateTimeRu } from 'src/features/insights/helpers';
import { MOODS, type MoodOption } from 'src/features/profile/mood/MoodIcons';

// ---- types ----
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

// та же высота, что и в DreamDetail
const HEADER_BASE = 56;

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

  // heart mask как в DreamDetail
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

  const toMs = (v: unknown): number | undefined => {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    if (!isFinite(n)) return undefined;
    return n < 1e12 ? n * 1000 : n;
  };

  // ---- load convo ----
  useEffect(() => {
    let mounted = true;

    const run = async () => {
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
        if (found) {
          setEditedTitle(found.title ?? '');
          setEditedText(found.notes ?? found.body ?? '');
          setEditedContext(found.context ?? '');
          setEditedCategory(found.category ?? null);

          const dateYmd = new Date(
            toMs(found.date ?? found.createdAt) ?? Date.now(),
          )
            .toISOString()
            .split('T')[0];

          api
            .getMoodForDate(dateYmd)
            .then((moodId) => {
              if (!mounted) return;
              setDayMood(moodId);
              setSelectedMood(moodId);
            })
            .catch((err) => {
              console.warn('Не удалось загрузить настроение дня:', err);
            });
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Ошибка загрузки');
        setConvo(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [id]);

  // ---- auto summary ----
  useEffect(() => {
    if (!convo?.id) return;
    if (autoSummaryRequested) return;
    if (convo.autoSummary) return;

    const text = convo.notes ?? convo.body ?? '';
    if (!text.trim()) return;

    const generateSummary = async () => {
      setAutoSummaryRequested(true);
      try {
        await api.generateAutoSummaryDailyConvo(convo.id!, text);
        const refreshed = await api.getDailyConvo(convo.id!);
        setConvo(refreshed ?? convo);
      } catch (e) {
        console.error('Auto summary generation error:', e);
      } finally {
        setAutoSummaryRequested(false);
      }
    };

    void generateSummary();
  }, [convo, autoSummaryRequested]);

  // ---- insights ----
  useEffect(() => {
    if (!convo?.id) return;

    let mounted = true;
    setInsightsLoading(true);
    setInsightsError(null);
    setInsights(null);

    const run = async () => {
      try {
        const raw = await api.getDailyConvoInsights(convo.id!);
        if (!mounted) return;
        const list = Array.isArray(raw) ? raw : [];
        const normalized = list
          .filter((insight) => Boolean(insight?.text?.trim?.()))
          .map((insight) => ({
            ...insight,
            createdAt: new Date(
              toMs(insight?.createdAt) ?? Date.now(),
            ).toISOString(),
            text: insight?.text ?? '',
            messageId:
              insight?.messageId ??
              `insight-${Math.random().toString(36).slice(2)}`,
            blockId: insight?.blockId ?? null,
            insightLiked:
              insight?.insightLiked ??
              Boolean(insight?.meta?.insightLiked),
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
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [convo?.id]);

  const handleSave = async () => {
    if (!convo) return;
    try {
      const textBefore = (convo.notes ?? convo.body ?? '').trim();
      const textAfter = editedText.trim();
      const textChanged = textBefore !== textAfter;

      const updated = await api.updateDailyConvo(
        convo.id!,
        editedText,
        editedTitle || null,
        undefined,
        undefined,
        convo.autoSummary || null,
        editedCategory || null,
        editedContext || null,
        undefined,
      );

      setConvo(updated);
      setEditing(false);
      setSnackbar({
        open: true,
        message: 'Запись обновлена',
        severity: 'success',
      });

      if (textChanged && updated?.id && (updated.notes ?? updated.body)) {
        try {
          setAutoSummaryRequested(true);
          await api.generateAutoSummaryDailyConvo(
            updated.id,
            updated.notes ?? updated.body ?? '',
          );
          const refreshed = await api.getDailyConvo(updated.id);
          setConvo(refreshed ?? updated);
        } catch (e) {
          console.error('Auto summary regen error:', e);
        } finally {
          setAutoSummaryRequested(false);
        }
      }
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.message ?? 'Ошибка обновления',
        severity: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (!convo) return;
    try {
      await api.deleteDailyConvo(convo.id!);
      setDeleting(false);
      setSnackbar({
        open: true,
        message: 'Запись удалена',
        severity: 'success',
      });
      navigate(-1);
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.message ?? 'Ошибка удаления',
        severity: 'error',
      });
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
    if (!convo) return;
    try {
      const dateYmd = new Date(
        toMs(convo.date ?? convo.createdAt) ?? Date.now(),
      )
        .toISOString()
        .split('T')[0];
      await api.setMoodForDate(dateYmd, moodId);
      setSelectedMood(moodId);
      setDayMood(moodId);
      setSnackbar({
        open: true,
        message: 'Настроение дня обновлено',
        severity: 'success',
      });
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.message ?? 'Ошибка обновления настроения',
        severity: 'error',
      });
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
    return [...insights].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
  }, [insights]);

  const insightsCount = displayInsights.length;

  const effectiveMoodId = useMemo(
    () => selectedMood ?? dayMood ?? null,
    [selectedMood, dayMood],
  );

  const currentMoodOption = useMemo(
    () =>
      MOODS.find((m: MoodOption) => m.id === effectiveMoodId) ?? null,
    [effectiveMoodId],
  );

  const MoodIconComponent =
    currentMoodOption?.icon as
      | React.ComponentType<SvgIconProps>
      | undefined;

  const moodGradient = (color: string) =>
    `linear-gradient(135deg, ${color} 0%, rgba(18,22,30,0.06) 100%)`;

  const handleBack = () => {
    navigate(-1);
  };

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
        onClick={handleBack}
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
        {convo?.title || 'Saviora'}
      </Typography>

      <Box
        sx={{
          position: 'absolute',
          right: 12,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
        }}
      >
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

  if (loading) {
    return (
      <Box sx={pageSx}>
        {Header}
        <Box sx={mainCardSx}>
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

  if (!convo) return null;

  return (
    <Box sx={pageSx}>
      {Header}

      <Box sx={mainCardSx}>
        {/* Верхняя зона с аватаром, датой, категорией и mood — как в DreamDetail */}
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
              alt="Saviora"
              sx={{
                width: 48,
                height: 48,
                border: `1px solid ${glassBorder}`,
                backgroundColor: 'rgba(255,255,255,0.08)',
                boxShadow: '0 8px 24px rgba(24,32,80,0.3)',
              }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                {dateStr && (
                  <Chip
                    label={dateStr}
                    size="small"
                    variant="outlined"
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

                {convo.category && (
                  <Chip
                    label={convo.category}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontWeight: 500,
                      border: `1px solid ${alpha('#fff', 0.1)}`,
                    }}
                  />
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip
                    title={currentMoodOption?.label ?? 'Выбрать настроение'}
                    arrow
                  >
                    <span>
                      <IconButton
                        aria-label="Выбрать настроение"
                        onClick={handleMoodClick}
                        sx={{
                          p: 0,
                          borderRadius: '50%',
                          '&:hover': {
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        {currentMoodOption ? (
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              background: moodGradient(
                                currentMoodOption.color,
                              ),
                              boxShadow: `0 4px 12px ${alpha(
                                '#000',
                                0.2,
                              )}`,
                            }}
                          >
                            {MoodIconComponent ? (
                              <MoodIconComponent
                                style={{ color: '#fff', fontSize: 16 }}
                              />
                            ) : (
                              <MoodIcon
                                style={{ color: '#fff', fontSize: 16 }}
                              />
                            )}
                          </Avatar>
                        ) : (
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              background: alpha('#fff', 0.04),
                              border: `1px solid ${alpha(
                                '#fff',
                                0.1,
                              )}`,
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
                      sx={{
                        color: 'rgba(255,255,255,0.8)',
                        fontWeight: 500,
                      }}
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
                MenuListProps={{ 'aria-labelledby': 'mood-button' }}
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
                  const Icon =
                    mood.icon as React.ComponentType<SvgIconProps>;
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
                        bgcolor: isActive
                          ? alpha('#000', 0.06)
                          : 'transparent',
                        borderRadius: 1,
                        px: 1.25,
                        py: 0.5,
                        '&:hover': {
                          bgcolor: `linear-gradient(135deg, ${alpha(
                            mood.color,
                            0.16,
                          )} 0%, ${alpha(
                            mood.color,
                            0.08,
                          )} 100%)`,
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
                            ? `0 14px 36px ${alpha(
                                '#000',
                                0.18,
                              )}, 0 0 0 6px ${alpha(
                                mood.color,
                                0.06,
                              )}`
                            : `0 8px 22px ${alpha('#000', 0.1)}`,
                        }}
                      >
                        <Icon
                          sx={{
                            color: '#fff',
                            width: 20,
                            height: 20,
                          }}
                        />
                      </Box>

                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{ color: '#fff' }}
                        >
                          {mood.label}
                        </Typography>
                      </Box>

                      {isActive && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: alpha(mood.color, 0.95),
                            fontWeight: 700,
                          }}
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

        {!editing ? (
          <>
            {/* Инсайты — визуально как в DreamDetail */}
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
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <Box sx={heartSxSmall} aria-hidden />
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: '#fff' }}
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
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    py: 2,
                  }}
                >
                  <CircularProgress
                    size={24}
                    sx={{ color: 'rgba(255,255,255,0.8)' }}
                  />
                </Box>
              )}

              {!insightsLoading && insightsError && (
                <Alert
                  severity="error"
                  sx={{
                    bgcolor: 'rgba(255,80,80,0.12)',
                    color: '#fff',
                  }}
                >
                  {insightsError}
                </Alert>
              )}

              {!insightsLoading &&
                !insightsError &&
                insightsCount === 0 && (
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(255,255,255,0.65)' }}
                  >
                    Пока нет сохранённых инсайтов. Дважды коснитесь
                    сообщения ассистента в диалоге, чтобы
                    сохранить инсайт.
                  </Typography>
                )}

              {!insightsLoading &&
                !insightsError &&
                insightsCount > 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    {displayInsights.map((insight, index) => {
                      const displayDate = formatDateTimeRu(
                        insight.createdAt,
                      );
                      const liked =
                        insight.insightLiked ??
                        Boolean(insight.meta?.insightLiked);
                      return (
                        <Paper
                          key={
                            insight.messageId ||
                            `insight-${index}`
                          }
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            handleInsightClick(insight)
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key === 'Enter' ||
                              event.key === ' '
                            ) {
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
                              boxShadow:
                                '0 12px 26px rgba(88,120,255,0.28)',
                              bgcolor: liked
                                ? 'rgba(255,120,160,0.16)'
                                : 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(88,120,255,0.08))',
                            },
                            '&:focus-visible': {
                              outline:
                                '2px solid rgba(255,255,255,0.6)',
                              outlineOffset: '2px',
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#fff',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {insight.text}
                          </Typography>
                          {(insight.blockId || displayDate) && (
                            <Box
                              sx={{
                                mt: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent:
                                  'space-between',
                                color: 'rgba(255,255,255,0.55)',
                                fontSize: '0.75rem',
                              }}
                            >
                              <span>
                                {insight.blockId
                                  ? `Блок: ${insight.blockId}`
                                  : ''}
                              </span>
                              <span>{displayDate}</span>
                            </Box>
                          )}
                        </Paper>
                      );
                    })}
                  </Box>
                )}
            </Paper>

            {/* Контекст (аналог dreamSummary) */}
            {convo.context && (
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
                  sx={{
                    mb: 1,
                    color: 'rgba(255,255,255,0.8)',
                  }}
                >
                  Контекст:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#fff',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {convo.context}
                </Typography>
              </Paper>
            )}

            {/* Текст дневной записи + кнопка "в чат" снизу */}
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
                sx={{
                  mb: 1,
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                Запись:
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: '#fff',
                  whiteSpace: 'pre-wrap',
                  mb: 2,
                }}
              >
                {convo.notes ?? convo.body}
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
  aria-label="Открыть чат"
  title="Открыть чат"
  onClick={() => navigate(`/daily/${convo.id}/chat`)}
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
  <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 20 }} />
</IconButton>
              </Box>
            </Paper>
          </>
        ) : (
          // Режим редактирования — те же контролы, что в DreamDetail
          <Box
            component="form"
            sx={{
              mt: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <TextField
              label="Название записи"
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
              InputLabelProps={{ style: { color: '#fff' } }}
              InputProps={{ style: { color: '#fff' } }}
            />

            <Autocomplete
              freeSolo
              options={categories}
              value={editedCategory}
              onChange={(_, newValue) =>
                setEditedCategory(newValue)
              }
              onInputChange={(_, newInputValue) =>
                setEditedCategory(newInputValue)
              }
              PaperComponent={({ children }) => (
                <Paper
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${glassBorder}`,
                    borderRadius: 2,
                    color: '#fff',
                    mt: 0.5,
                    boxShadow:
                      '0 8px 32px rgba(0,0,0,0.2)',
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
                        borderColor:
                          'rgba(255,255,255,0.2)',
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
                  InputLabelProps={{ style: { color: '#fff' } }}
                />
              )}
            />

            <TextField
              label="Контекст"
              value={editedContext ?? ''}
              onChange={(e) =>
                setEditedContext(e.target.value)
              }
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
              InputLabelProps={{ style: { color: '#fff' } }}
              InputProps={{ style: { color: '#fff' } }}
            />

            <TextField
              label="Текст записи"
              value={editedText}
              onChange={(e) =>
                setEditedText(e.target.value)
              }
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
              InputLabelProps={{ style: { color: '#fff' } }}
              InputProps={{ style: { color: '#fff' } }}
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
                  backgroundColor:
                    'rgba(255,255,255,0.04)',
                  boxShadow: 'none',
                  letterSpacing: 0.2,
                  '&:hover': {
                    backgroundColor:
                      'rgba(255,255,255,0.08)',
                    borderColor:
                      'rgba(220,230,255,0.7)',
                    boxShadow:
                      '0 6px 18px rgba(24,32,80,0.28)',
                  },
                }}
              >
                Отмена
              </Button>

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
                    'linear-gradient(135deg, #6C7CFF 0%, #B36CFF 100%)',
                  color: '#fff',
                  border: 'none',
                  boxShadow:
                    '0 6px 18px rgba(24,32,80,0.35)',
                  letterSpacing: 0.25,
                  transition: 'all 0.22s ease',
                  '&:hover': {
                    background:
                      'linear-gradient(135deg, #7484FF 0%, #BD76FF 100%)',
                    boxShadow:
                      '0 10px 26px rgba(24,32,80,0.45)',
                    transform: 'translateY(-1px)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow:
                      '0 4px 14px rgba(24,32,80,0.32)',
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
          <DialogTitle>Удалить запись?</DialogTitle>
          <DialogContent>
            <Typography
              sx={{ color: 'rgba(255,255,255,0.85)' }}
            >
              Вы уверены, что хотите удалить эту дневную
              запись? Это действие нельзя отменить.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDeleting(false)}
              sx={{ color: '#fff' }}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
              sx={{
                bgcolor: 'rgba(255, 100, 100, 0.95)',
                '&:hover': {
                  bgcolor:
                    'rgba(255, 100, 100, 0.85)',
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
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          sx={{
            '&.MuiSnackbar-root': {
              bottom: '25vh',
            },
          }}
        >
          <Alert
            onClose={() =>
              setSnackbar((s) => ({ ...s, open: false }))
            }
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
              boxShadow: 'none',
              color: '#fff',
              '& .MuiAlert-message': {
                fontSize: '1.05rem',
                padding: 0,
              },
              ...(snackbar.severity === 'error'
                ? {
                    borderColor:
                      'rgba(255,120,120,0.7)',
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

export default DailyConvoScreen;