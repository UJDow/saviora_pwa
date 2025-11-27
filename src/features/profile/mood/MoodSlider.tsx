// mood/MoodSlider.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Tooltip,
  Typography,
  useTheme,
  CircularProgress,
  ClickAwayListener,
  Snackbar,
  Alert,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import EditIcon from '@mui/icons-material/Edit';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';

import MOODS from './MoodIcons';
import type { MoodOption } from './MoodIcons';
import { useNavigate } from 'react-router-dom';

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
  /**
   * Если ready === false — компонент считает, что данные (profile / todayMood) ещё загружаются
   * и начально будет свернут и без анимации, чтобы избежать "мигания" раскрытого слайдера.
   * Когда ready станет true, компонент применит обычную логику открытия/закрытия.
   */
  ready?: boolean;
};

const GLASS_BG = 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

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
  ready = true, // По умолчанию считаем, что данные готовы
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const moods = useMemo(() => MOODS, []);
  const swiperRef = useRef<SwiperType | null>(null);

  // responsiveness
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isVerySmall = useMediaQuery('(max-width:359px)');

  // visual / UX state
  const [saving, setSaving] = useState(false);
  const [localValue, setLocalValue] = useState<string | null>(value ?? null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

  // first render flag — used to suppress jarring initial animation and slideTo speed
  const firstRenderRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      firstRenderRef.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // open/collapsed local control (click to open, click away closes)
  // IMPORTANT: initial open depends on `ready` now to avoid flash
  const initialOpen = ready ? (startCollapsed ? false : !Boolean(value)) : false;
  const [open, setOpen] = useState<boolean>(initialOpen);
  const handleOpen = () => { if (!isDisabled) setOpen(true); };
  const handleClose = () => { if (!saving) setOpen(false); };

  // sync localValue from props unless currently saving
  useEffect(() => {
    if (!saving) setLocalValue(value ?? null);
  }, [value, saving]);

  // when readiness changes from false -> true, apply the usual open logic (if needed)
  useEffect(() => {
    if (!ready) return;
    // if there's no mood and startCollapsed is false -> open
    if (!value && !startCollapsed) {
      setOpen(true);
    }
    // if there is a mood -> collapse
    if (value) {
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, value, startCollapsed]); // Добавил value и startCollapsed в зависимости

  const valueIndex = useMemo(() => moods.findIndex((m) => m.id === value), [moods, value]);

  useEffect(() => {
    // slideTo selected mood only when valid index
    if (valueIndex >= 0 && swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
      // if not ready or first render -> jump (speed 0) to avoid scroll animation showing
      const speed = firstRenderRef.current || !ready ? 0 : 300;
      try {
        swiperRef.current.slideTo(Math.min(valueIndex, Math.max(0, moods.length - 1)), speed);
      } catch {
        // ignore swiper internal errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueIndex, moods.length, ready]);

  const isDisabled = loading || disabled || saving;

  // sizes
  const AVATAR_SIZE = isXs ? 44 : 56;
  const INNER_AVATAR_SIZE = Math.round(AVATAR_SIZE * 0.78);
  const COLLAPSED_WIDTH = isXs ? 180 : 320;
  const EXPANDED_MAX_WIDTH = isXs ? 360 : 420;
  const slidesPerView = isXs ? (isVerySmall ? 3 : 4) : 5;

  const maybeTransferToProfile = () => {
    if (!transferToProfileOnSelect) return;
    if (window.location.pathname !== profileRoute) {
      setTimeout(() => navigate(profileRoute), 220);
    }
  };

  const handleSelect = async (mood: MoodOption) => {
    if (isDisabled) return;
    const previous = localValue;

    // Если клик по уже выбранному — просто свернём и, возможно, перейдём
    if (mood.id === localValue) {
      setOpen(false);
      maybeTransferToProfile();
      return;
    }

    if (closeOnSelect === 'optimistic') {
      setLocalValue(mood.id);
      setSaving(true);
      try {
        setOpen(false);
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

  const selectedMood = moods.find((m) => m.id === localValue) ?? null;
  const shouldUseInitialAnimation = !(firstRenderRef.current && !ready);

  return (
    <>
      <ClickAwayListener onClickAway={() => handleClose()}>
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="moods-open"
                initial={shouldUseInitialAnimation ? { opacity: 0, y: 8, scale: 0.98 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                style={{ width: '100%', maxWidth: EXPANDED_MAX_WIDTH }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    height: AVATAR_SIZE + 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    background: GLASS_BG,
                    border: `1px solid ${GLASS_BORDER}`,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: '0 18px 60px rgba(8,12,40,0.45)',
                    overflow: 'hidden',
                    px: 0.5,
                  }}
                >
                  <Swiper
                    onSwiper={(s) => (swiperRef.current = s)}
                    slidesPerView={slidesPerView}
                    spaceBetween={8}
                    slideToClickedSlide={true}
                    allowTouchMove={!isDisabled}
                    style={{ width: '100%', padding: '6px 6px', overflow: 'visible' }}
                    loop={false}
                  >
                    {moods.map((mood) => {
                      const IconComp = mood.icon;
                      const isSelected = mood.id === localValue;
                      const gradient = `linear-gradient(135deg, ${mood.color} 0%, rgba(18,22,30,0.06) 100%)`;

                      return (
                        <SwiperSlide key={mood.id} style={{ display: 'flex', justifyContent: 'center' }}>
                          <Tooltip title={mood.label} placement="top" arrow>
                            <span>
                              <IconButton
                                size="large"
                                onClick={(e) => { e.stopPropagation(); void handleSelect(mood); }}
                                disabled={isDisabled}
                                aria-label={`Выбрать настроение ${mood.label}`}
                                sx={{
                                  p: 0,
                                  borderRadius: '50%',
                                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                                  '&:hover': { transform: isDisabled ? 'none' : 'translateY(-6px)' },
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 6px',
                                }}
                              >
                                <Avatar
                                  sx={{
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    background: gradient,
                                    color: 'rgba(255,255,255,0.96)',
                                    boxShadow: isSelected
                                      ? `0 18px 48px ${alpha('#000', 0.20)}, 0 0 0 6px ${alpha(mood.color, 0.06)}`
                                      : `0 8px 22px ${alpha('#000', 0.10)}`,
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {renderIcon ? renderIcon(mood.id) : <IconComp style={{ color: '#fff', fontSize: Math.round(AVATAR_SIZE * 0.44) }} />}
                                </Avatar>
                              </IconButton>
                            </span>
                          </Tooltip>
                        </SwiperSlide>
                      );
                    })}
                  </Swiper>
                </Box>
              </motion.div>
            ) : (
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
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 10px 28px rgba(8,12,40,0.28)`,
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
                          background: `linear-gradient(135deg, ${selectedMood.color} 0%, rgba(20,30,40,0.06) 100%)`,
                          color: '#fff',
                        }}
                      >
                        {renderIcon ? renderIcon(selectedMood.id) : (() => {
                          const IconComp = selectedMood.icon;
                          return <IconComp style={{ color: '#fff', fontSize: Math.round(INNER_AVATAR_SIZE * 0.45) }} />;
                        })()}
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