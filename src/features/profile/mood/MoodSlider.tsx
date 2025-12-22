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
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
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
  ready?: boolean;
};

const HEADER_BG_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; // (можно использовать для фона аватарок или др.)
const GLASS_BG = 'rgba(255, 255, 255, 0.06)'; // стеклянный фон (полупрозрачный)
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const GLASS_SHADOW = '0 12px 40px rgba(8,12,40,0.45)';
const BORDER_RADIUS = 16; // Менее выраженные закругления

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

  const firstRenderRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      firstRenderRef.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const initialOpen = ready ? (startCollapsed ? false : !Boolean(value)) : false;
  const [open, setOpen] = useState<boolean>(initialOpen);
  const handleOpen = () => {
    if (!isDisabled) setOpen(true);
  };
  const handleClose = () => {
    if (!saving) setOpen(false);
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

  const valueIndex = useMemo(() => moods.findIndex((m) => m.id === value), [moods, value]);

  useEffect(() => {
    if (valueIndex >= 0 && swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
      const speed = firstRenderRef.current || !ready ? 0 : 300;
      try {
        swiperRef.current.slideTo(Math.min(valueIndex, Math.max(0, moods.length - 1)), speed);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueIndex, moods.length, ready]);

  const isDisabled = loading || disabled || saving;

  // tuned sizes
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

  const handleSelect = async (mood: MoodOption) => {
    if (isDisabled) return;
    const previous = localValue;

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
                initial={shouldUseInitialAnimation ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                style={{ width: '100%' }}
              >
                {/* Full-screen blurred overlay (transparent "soap") */}
                <Box
                  onClick={() => handleClose()}
                  sx={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent', // keep overlay transparent, blur the background
                    WebkitBackdropFilter: 'blur(10px)',
                    backdropFilter: 'blur(10px)',
                  }}
                  aria-modal
                  role="dialog"
                >
                  {/* Center wrapper (no heavy glass here) */}
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
                      py: { xs: 2.5, sm: 3.5 },
                      borderRadius: BORDER_RADIUS,
                      overflow: 'hidden',
                      background: GLASS_BG, // Стеклянный фон для всего модального окна
                      border: `1px solid ${GLASS_BORDER}`,
                      boxShadow: GLASS_SHADOW,
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                    }}
                  >
                    {/* Top row: close + title */}
                    <Box
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: { xs: 1, sm: 1.5 },
                      }}
                    >
                      <IconButton
                        onClick={() => handleClose()}
                        aria-label="Закрыть"
                        sx={{
                          color: '#fff',
                          bgcolor: 'transparent',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                        }}
                        size="large"
                      >
                        <CloseIcon />
                      </IconButton>

                      <Typography sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 600 }}>
                        Настроение
                      </Typography>

                      <Box sx={{ width: 48 }} />
                    </Box>

                    {/* === SLIDER: only icons, no extra glass block === */}
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
                      <Swiper
                        onSwiper={(s) => (swiperRef.current = s)}
                        slidesPerView={slidesPerView}
                        spaceBetween={spaceBetween}
                        slideToClickedSlide={true}
                        allowTouchMove={!isDisabled}
                        style={{ width: '100%', padding: '6px 6px', overflow: 'visible' }}
                        loop={false}
                      >
                        {moods.map((mood) => {
                          const IconComp = mood.icon;
                          const avatarSize = AVATAR_SIZE_OPEN;
                          const gradient = `linear-gradient(135deg, ${mood.color} 0%, ${alpha(
                            mood.color,
                            0.9
                          )} 100%)`;

                          return (
                            <SwiperSlide
                              key={mood.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'center',
                                minWidth: slideMinWidth,
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 1,
                                  px: 0.5,
                                  width: '100%',
                                  maxWidth: slideMinWidth,
                                }}
                              >
                                <IconButton
                                  size="large"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleSelect(mood);
                                  }}
                                  disabled={isDisabled}
                                  aria-label={`Выбрать настроение ${mood.label}`}
                                  sx={{
                                    p: 0,
                                    borderRadius: '50%',
                                    transition: 'transform 140ms ease',
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
                                      width: avatarSize,
                                      height: avatarSize,
                                      background: gradient,
                                      color: '#fff',
                                      boxShadow: 'none', // плоский вид
                                      border: 'none', // без обводки
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
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
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                    fontSize: 13,
                                    userSelect: 'none',
                                    maxWidth: slideMinWidth,
                                    textAlign: 'center',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    px: 0.5,
                                  }}
                                >
                                  {mood.label}
                                </Typography>
                              </Box>
                            </SwiperSlide>
                          );
                        })}
                      </Swiper>
                    </Box>

                    {/* === CAPTION: glass block (same style as main modal) === */}
                    <Box
                      sx={{
                        width: '100%',
                        borderRadius: BORDER_RADIUS,
                        px: 3,
                        py: 2,
                        mt: 1,
                      }}
                    >
                      <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, textAlign: 'center' }}>
                        {selectedMood?.label ?? (loading ? 'Загружается...' : 'Выберите настроение')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', mt: 0.5 }}>
                        {saving || loading ? 'Сохраняем...' : 'Нажмите на иконку, чтобы выбрать'}
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