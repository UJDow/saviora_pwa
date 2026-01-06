// mood/MoodSlider.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Typography,
  useTheme,
  CircularProgress,
  ClickAwayListener,
  Snackbar,
  Alert,
  useMediaQuery,
  Tabs,
  Tab,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';

import MOODS, { MOOD_GROUPS, type MoodGroupId } from './MoodIcons';
import type { MoodOption } from './MoodIcons';
import { useNavigate } from 'react-router-dom';

// Haptic feedback utilities
const hapticTick = () => {
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(10);
  }
};

const hapticSuccess = () => {
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate([15, 30, 15]);
  }
};

export type MoodSliderProps = {
  value: string | null;
  onChange: (moodId: string) => Promise<void> | void;
  loading?: boolean;
  disabled?: boolean;
  closeOnSelect?: 'optimistic' | 'confirmed' | 'manual';
  renderIcon?: (moodId: string) => React.ReactNode;
  transferToProfileOnSelect?: boolean;
  startCollapsed?: boolean;
  profileRoute?: string;
  ready?: boolean;
};

const GLASS_BG = 'rgba(255, 255, 255, 0.06)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const GLASS_SHADOW = '0 12px 40px rgba(8,12,40,0.45)';
const BORDER_RADIUS = 16;

export const MoodSlider: React.FC<MoodSliderProps> = ({
  value,
  onChange,
  loading = false,
  disabled = false,
  closeOnSelect = 'optimistic',
  renderIcon,
  transferToProfileOnSelect = false,
  startCollapsed = false,
  profileRoute = '/profile',
  ready = true,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const moods = useMemo(() => MOODS, []);
  const swiperRef = useRef<SwiperType | null>(null);

  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isVerySmall = useMediaQuery('(max-width:359px)');

  const [saving, setSaving] = useState(false);
  const [localValue, setLocalValue] = useState<string | null>(value ?? null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

  // preview state (показ описания при первом тапе)
  const [previewMoodId, setPreviewMoodId] = useState<string | null>(null);

  // first-time hint (show unless already dismissed)
  const [showFirstTimeHint, setShowFirstTimeHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem('moodSliderHintShown') !== 'true';
    } catch {
      return true;
    }
  });

  // two-level: active group
  const selectedMood = moods.find((m) => m.id === localValue) ?? null;
  const [activeGroup, setActiveGroup] = useState<MoodGroupId>(selectedMood?.groupId ?? 'joy');

  const firstRenderRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      firstRenderRef.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const initialOpen = ready ? (startCollapsed ? false : !Boolean(value)) : false;
  const [open, setOpen] = useState<boolean>(initialOpen);

  const isDisabled = loading || disabled || saving;

  const handleOpen = () => {
    if (!isDisabled) {
      setOpen(true);
      hapticTick();
    }
  };

  const handleClose = () => {
    if (!saving) {
      setOpen(false);
      hapticTick();
      setPreviewMoodId(null);
    }
  };

  useEffect(() => {
    if (!saving) setLocalValue(value ?? null);
  }, [value, saving]);

  useEffect(() => {
    if (!ready) return;
    if (!value && !startCollapsed) setOpen(true);
    if (value) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, value, startCollapsed]);

  // sync active group with selection
  useEffect(() => {
    if (selectedMood) {
      setActiveGroup(selectedMood.groupId);
    }
  }, [selectedMood]);

  // filtered moods for active group
  const filteredMoods = useMemo(() => moods.filter((m) => m.groupId === activeGroup), [moods, activeGroup]);

  const valueIndex = useMemo(() => filteredMoods.findIndex((m) => m.id === localValue), [filteredMoods, localValue]);

  useEffect(() => {
    if (valueIndex >= 0 && swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
      const speed = firstRenderRef.current || !ready ? 0 : 300;
      try {
        swiperRef.current.slideTo(Math.min(valueIndex, Math.max(0, filteredMoods.length - 1)), speed);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueIndex, filteredMoods.length, ready]);

  // sizes & layout
  const AVATAR_SIZE_OPEN = isXs ? 64 : 78;
  const AVATAR_SIZE_COLLAPSED = isXs ? 44 : 56;
  const INNER_AVATAR_SIZE = Math.round(AVATAR_SIZE_COLLAPSED * 0.78);
  const COLLAPSED_WIDTH = isXs ? 160 : 300;
  const EXPANDED_MAX_WIDTH = isXs ? 360 : 640;
  const slidesPerView = isXs ? (isVerySmall ? 3 : 3) : 5;
  const spaceBetween = isXs ? 12 : 20;
  const slideMinWidth = AVATAR_SIZE_OPEN + 28;

  const maybeTransferToProfile = () => {
    if (!transferToProfileOnSelect) return;
    if (window.location.pathname !== profileRoute) {
      setTimeout(() => navigate(profileRoute), 220);
    }
  };

  // handleSelect confirms selection (optimistic/confirmed/manual as before)
  const handleSelect = async (mood: MoodOption) => {
    if (isDisabled) return;
    const previous = localValue;

    if (mood.id === localValue) {
      hapticTick();
      setOpen(false);
      setPreviewMoodId(null);
      maybeTransferToProfile();
      return;
    }

    hapticSuccess();

    if (closeOnSelect === 'optimistic') {
      setLocalValue(mood.id);
      setSaving(true);
      try {
        setOpen(false);
        setPreviewMoodId(null);
        await onChange(mood.id);
        setSnackMsg('Настроение сохранено');
        setSnackSeverity('success');
        setSnackOpen(true);
        maybeTransferToProfile();
      } catch (e) {
        console.error('Ошибка сохранения (optimistic):', e);
        setLocalValue(previous);
        setOpen(true);
        setSnackMsg('Ошибка при сохранении настроения');
        setSnackSeverity('error');
        setSnackOpen(true);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (closeOnSelect === 'confirmed') {
      setSaving(true);
      try {
        await onChange(mood.id);
        setLocalValue(mood.id);
        setOpen(false);
        setPreviewMoodId(null);
        setSnackMsg('Настроение сохранено');
        setSnackSeverity('success');
        setSnackOpen(true);
        maybeTransferToProfile();
      } catch (e) {
        console.error('Ошибка сохранения (confirmed):', e);
        setSnackMsg('Ошибка при сохранении настроения');
        setSnackSeverity('error');
        setSnackOpen(true);
        throw e;
      } finally {
        setSaving(false);
      }
      return;
    }

    // manual
    setSaving(true);
    try {
      await onChange(mood.id);
      setLocalValue(mood.id);
      setOpen(false);
      setPreviewMoodId(null);
      setSnackMsg('Настроение сохранено');
      setSnackSeverity('success');
      setSnackOpen(true);
      maybeTransferToProfile();
    } catch (e) {
      console.error('Ошибка сохранения (manual):', e);
      setSnackMsg('Ошибка при сохранении настроения');
      setSnackSeverity('error');
      setSnackOpen(true);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const shouldUseInitialAnimation = !(firstRenderRef.current && !ready);

  // moodToShow: только превью (первый тап). Описание не показывается при простом переключении категории.
  const moodToShow = moods.find((m) => m.id === previewMoodId) ?? null;

  return (
    <>
      <ClickAwayListener onClickAway={() => handleClose()}>
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="moods-open"
                initial={shouldUseInitialAnimation ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                style={{ width: '100%' }}
              >
                {/* full-screen blurred overlay */}
                <Box
                  onClick={() => handleClose()}
                  sx={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    WebkitBackdropFilter: 'blur(10px)',
                    backdropFilter: 'blur(10px)',
                  }}
                  aria-modal
                  role="dialog"
                >
                  {/* center panel */}
                  <Box
  onClick={(e) => e.stopPropagation()}
  sx={{
    width: '100%',
    maxWidth: EXPANDED_MAX_WIDTH,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    px: { xs: 2, sm: 3 },
    pt: { xs: 5, sm: 6 },      // <-- увеличиваем верхний padding (примерно 40-48px)
    pb: { xs: 2.5, sm: 3.5 },  // <-- оставляем нижний padding как был
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
    background: GLASS_BG,
    border: `1px solid ${GLASS_BORDER}`,
    boxShadow: GLASS_SHADOW,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    position: 'relative',
  }}
>
                    {/* top: title centered, close button at right */}
                    <Box
  sx={{
    width: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pt: { xs: 1.5, sm: 2 },
    pb: { xs: 1, sm: 1.5 },
  }}
>
  <Typography
    sx={{
      color: 'rgba(255,255,255,0.95)',
      fontWeight: 600,
      fontSize: { xs: '1.1rem', sm: '1.25rem' },
      userSelect: 'none',
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      whiteSpace: 'nowrap',
    }}
  >
    Настроение
  </Typography>

  <IconButton
    onClick={() => handleClose()}
    aria-label="Закрыть"
    sx={{
      color: '#fff',
      bgcolor: 'transparent',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
      position: 'absolute',
      right: 0,
      top: '50%',
      transform: 'translateY(-50%)',
      p: 0,
      minWidth: 'auto',
      width: 32,
      height: 32,
    }}
    size="large"
  >
    <CloseIcon fontSize="small" />
  </IconButton>
</Box>

                    {/* LEVEL 1: groups (tabs) - original slider behavior */}
                    <Tabs
  value={activeGroup}
  onChange={(_, v) => {
    hapticTick();
    setActiveGroup(v);
    setPreviewMoodId(null);
  }}
  variant="scrollable"
  scrollButtons={false}
  sx={{
    mt: { xs: 2.2, sm: 2.6 },           // <-- важный параметр: отодвигает табы вниз от шапки
    mb: 2,
    width: '100%',
    borderBottom: `1px solid ${GLASS_BORDER}`,
    '& .MuiTab-root': {
      color: 'rgba(255,255,255,0.5)',
      minWidth: 'auto',
      px: 2,
      fontSize: '0.85rem',
      fontWeight: 500,
      textTransform: 'none',
    },
    '& .Mui-selected': {
      color: '#fff !important',
    },
    '& .MuiTabs-indicator': {
      bgcolor: MOOD_GROUPS.find((g) => g.id === activeGroup)?.color ?? '#fff',
      height: 3,
      borderRadius: '3px 3px 0 0',
    },
  }}
>
  {MOOD_GROUPS.map((g) => (
    <Tab key={g.id} value={g.id} label={g.label} />
  ))}
</Tabs>

                    {/* First-time opaque hint (непрозрачная "стекляшка" для читаемости) */}
                    {showFirstTimeHint && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: { xs: 76, sm: 84 },
                          left: '50%',
                          transform: 'translateX(-50%)',
                          maxWidth: 520,
                          width: '90%',
                          bgcolor: 'rgba(20, 24, 40, 0.85)', // почти непрозрачный тёмный синий оттенок
                          backdropFilter: 'blur(24px)',
                          WebkitBackdropFilter: 'blur(24px)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          boxShadow: '0 14px 56px rgba(10, 14, 30, 0.25)',
                          color: 'rgba(255, 255, 255, 0.95)',
                          p: 2,
                          zIndex: 1900,
                          display: 'flex',
                          gap: 1,
                          alignItems: 'flex-start',
                          borderRadius: 3,
                          userSelect: 'none',
                          textAlign: 'center',
                        }}
                        role="status"
                        aria-live="polite"
                      >
                        <Box sx={{ textAlign: 'center' }} role="status" aria-live="polite">
  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
    Выберите 1 из 6 категорий настроения.
  </Typography>
  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
    Проведите влево/вправо, чтобы увидеть все. Нажмите по иконке эмоции — увидите описание, нажмите ещё раз — подтвердите выбор.
  </Typography>
</Box>

                        <IconButton
                          size="small"
                          onClick={() => {
                            setShowFirstTimeHint(false);
                            try {
                              localStorage.setItem('moodSliderHintShown', 'true');
                            } catch {}
                          }}
                          sx={{ color: '#fff', ml: 1 }}
                          aria-label="Закрыть подсказку"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}

                    {/* LEVEL 2: moods (either centered flex for small groups or Swiper) */}
                    <Box
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: isXs ? 110 : 140,
                        px: 1,
                        py: 1,
                      }}
                    >
                      {filteredMoods.length <= slidesPerView ? (
                        // centered flex layout for small groups
                        <Box
                          sx={{
                            display: 'flex',
                            gap: `${spaceBetween}px`,
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            px: 2,
                          }}
                        >
                          {filteredMoods.map((mood) => {
                            const IconComp = mood.icon;
                            const avatarSize = AVATAR_SIZE_OPEN;
                            const gradient = `linear-gradient(135deg, ${mood.color} 0%, ${alpha(mood.color, 0.9)} 100%)`;

                            const isPreview = previewMoodId === mood.id;
                            const isSelected = localValue === mood.id;
                            const isFocused = isPreview || isSelected;

                            const avatarStyles = {
                              width: avatarSize,
                              height: avatarSize,
                              background: gradient,
                              color: '#fff',
                              transform: isFocused ? 'scale(1.12)' : 'scale(1)',
                              transition: 'transform 160ms ease, box-shadow 160ms ease',
                              boxShadow: isFocused ? `0 14px 40px ${alpha(mood.color, 0.32)}` : 'none',
                              border: isFocused ? `2px solid ${alpha('#fff', 0.14)}` : 'none',
                            };

                            return (
                              <Box key={mood.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <IconButton
                                  size="large"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isDisabled) return;
                                    if (previewMoodId === mood.id) {
                                      void handleSelect(mood);
                                    } else {
                                      setPreviewMoodId(mood.id);
                                      hapticTick();
                                    }
                                  }}
                                  disabled={isDisabled}
                                  aria-label={`Выбрать настроение ${mood.label}`}
                                  aria-pressed={isFocused}
                                >
                                  <Avatar sx={avatarStyles}>
                                    {renderIcon ? (
                                      renderIcon(mood.id)
                                    ) : (
                                      <IconComp style={{ color: '#fff', fontSize: Math.round(avatarSize * 0.42) }} />
                                    )}
                                  </Avatar>
                                </IconButton>

                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'rgba(255,255,255,0.92)',
                                    fontWeight: isFocused ? 700 : 500,
                                    fontSize: isFocused ? '1rem' : '0.75rem',
                                    transition: 'all 160ms ease',
                                    mt: 0.25,
                                  }}
                                >
                                  {mood.label}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      ) : (
                        // Swiper for larger groups
                        <Swiper
                          onSwiper={(s) => (swiperRef.current = s)}
                          slidesPerView={slidesPerView}
                          spaceBetween={spaceBetween}
                          slideToClickedSlide={true}
                          allowTouchMove={!isDisabled}
                          centeredSlides={false}
                          onSlideChange={() => hapticTick()}
                          style={{ width: '100%', padding: '6px 6px', overflow: 'visible' }}
                          loop={false}
                        >
                          {filteredMoods.map((mood) => {
                            const IconComp = mood.icon;
                            const avatarSize = AVATAR_SIZE_OPEN;
                            const gradient = `linear-gradient(135deg, ${mood.color} 0%, ${alpha(mood.color, 0.9)} 100%)`;

                            const isPreview = previewMoodId === mood.id;
                            const isSelected = localValue === mood.id;
                            const isFocused = isPreview || isSelected;

                            const avatarStyles = {
                              width: avatarSize,
                              height: avatarSize,
                              background: gradient,
                              color: '#fff',
                              transform: isFocused ? 'scale(1.12)' : 'scale(1)',
                              transition: 'transform 160ms ease, box-shadow 160ms ease',
                              boxShadow: isFocused ? `0 14px 40px ${alpha(mood.color, 0.32)}` : 'none',
                              border: isFocused ? `2px solid ${alpha('#fff', 0.14)}` : 'none',
                            };

                            return (
                              <SwiperSlide key={mood.id} style={{ display: 'flex', justifyContent: 'center', width: slideMinWidth }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  <IconButton
                                    size="large"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isDisabled) return;
                                      if (previewMoodId === mood.id) {
                                        void handleSelect(mood);
                                      } else {
                                        setPreviewMoodId(mood.id);
                                        hapticTick();
                                      }
                                    }}
                                    disabled={isDisabled}
                                    aria-label={`Выбрать настроение ${mood.label}`}
                                    aria-pressed={isFocused}
                                  >
                                    <Avatar sx={avatarStyles}>
                                      {renderIcon ? (
                                        renderIcon(mood.id)
                                      ) : (
                                        <IconComp style={{ color: '#fff', fontSize: Math.round(avatarSize * 0.42) }} />
                                      )}
                                    </Avatar>
                                  </IconButton>

                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'rgba(255,255,255,0.92)',
                                      fontWeight: isFocused ? 700 : 500,
                                      fontSize: isFocused ? '1rem' : '0.75rem',
                                      transition: 'all 160ms ease',
                                      mt: 0.25,
                                    }}
                                  >
                                    {mood.label}
                                  </Typography>
                                </Box>
                              </SwiperSlide>
                            );
                          })}
                        </Swiper>
                      )}
                    </Box>

                    {/* CAPTION: показываем ТОЛЬКО при preview (первый тап) или при сохранении */}
                    <Box
                      sx={{
                        width: '100%',
                        borderRadius: BORDER_RADIUS,
                        px: 3,
                        py: 2,
                        mt: 1,
                        minHeight: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          color: 'rgba(255,255,255,0.88)',
                          textAlign: 'center',
                          fontWeight: 600,
                          fontSize: { xs: '0.95rem', sm: '1rem' },
                          lineHeight: 1.45,
                        }}
                      >
                        {saving || loading ? 'Сохраняем...' : moodToShow ? moodToShow.fullLabel : ''}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </motion.div>
            ) : (
              // COLLAPSED / COMPACT VIEW
              <motion.div
                key="moods-closed"
                initial={shouldUseInitialAnimation ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.12 }}
                style={{ width: '100%', maxWidth: COLLAPSED_WIDTH }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 1,
                    py: 0.5,
                    borderRadius: 12,
                    mx: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    role="button"
                    aria-label={selectedMood ? `Текущее настроение: ${selectedMood.label}` : 'Выбрать настроение'}
                    sx={{
                      width: INNER_AVATAR_SIZE,
                      height: INNER_AVATAR_SIZE,
                      borderRadius: '50%',
                      background: GLASS_BG,
                      border: `1px solid ${GLASS_BORDER}`,
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 8px 24px rgba(8,12,40,0.28)`,
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpen();
                    }}
                  >
                    {saving || loading ? (
                      <CircularProgress size={18} sx={{ color: selectedMood?.color ?? theme.palette.primary.main }} />
                    ) : selectedMood ? (
                      <Avatar
                        sx={{
                          width: INNER_AVATAR_SIZE,
                          height: INNER_AVATAR_SIZE,
                          background: `linear-gradient(135deg, ${selectedMood.color} 0%, ${alpha(selectedMood.color, 0.9)} 100%)`,
                          color: '#fff',
                        }}
                      >
                        {renderIcon ? (
                          renderIcon(selectedMood.id)
                        ) : (
                          (() => {
                            const IconComp = selectedMood.icon;
                            return <IconComp style={{ color: '#fff', fontSize: Math.round(INNER_AVATAR_SIZE * 0.45) }} />;
                          })()
                        )}
                      </Avatar>
                    ) : (
                      <Avatar
                        sx={{
                          width: INNER_AVATAR_SIZE,
                          height: INNER_AVATAR_SIZE,
                          background: alpha(theme.palette.common.white, 0.06),
                          color: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.6)' }} />
                      </Avatar>
                    )}
                  </Box>

                  <Box sx={{ textAlign: 'left', flex: 1, minWidth: 120 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25, color: 'rgba(255,255,255,0.95)' }}>
                      {selectedMood?.label ?? (loading ? 'Загружается...' : 'Настроение не выбрано')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.75rem' }}>
                      {saving || loading ? 'Сохраняем...' : 'Нажмите, чтобы изменить'}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {(saving || loading) && (
                      <CircularProgress size={16} thickness={4} sx={{ color: selectedMood?.color ?? theme.palette.primary.main }} />
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen();
                      }}
                      aria-label="Редактировать настроение"
                      disabled={isDisabled}
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                      }}
                    >
                      <EditIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.95)' }} />
                    </IconButton>
                  </Box>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </ClickAwayListener>

      <Snackbar open={snackOpen} autoHideDuration={2400} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} sx={{ bgcolor: 'rgba(0,0,0,0.36)', color: '#fff', border: `1px solid ${GLASS_BORDER}` }}>
          {snackMsg}
        </Alert>
      </Snackbar>
    </>
  );
};

export default MoodSlider;