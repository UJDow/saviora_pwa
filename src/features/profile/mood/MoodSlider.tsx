import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Typography,
  useTheme,
  ClickAwayListener,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';

import MOODS, { MOOD_GROUPS, type MoodGroupId, type MoodOption } from './MoodIcons';
import { useNavigate } from 'react-router-dom';

// Haptic feedback
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
  
  const [view, setView] = useState<'groups' | 'subcategories'>('groups');
  const [activeGroupId, setActiveGroupId] = useState<MoodGroupId | null>(null);
  const [previewMoodId, setPreviewMoodId] = useState<string | null>(null);

  const initialOpen = ready ? (startCollapsed ? false : !Boolean(value)) : false;
  const [open, setOpen] = useState<boolean>(initialOpen);

  const isDisabled = loading || disabled || saving;

  useEffect(() => {
    if (value) {
      const found = moods.find(m => m.id === value);
      if (found) {
        setActiveGroupId(found.groupId);
        setView('subcategories');
      }
    } else {
      setView('groups');
      setActiveGroupId(null);
    }
    setLocalValue(value ?? null);
  }, [value, moods]);

  const handleOpen = () => {
    if (!isDisabled) {
      setOpen(true);
      hapticTick();
      if (localValue) {
        const found = moods.find(m => m.id === localValue);
        if (found) {
          setActiveGroupId(found.groupId);
          setView('subcategories');
        }
      } else {
        setView('groups');
        setActiveGroupId(null);
      }
    }
  };

  const handleClose = () => {
    if (!saving) {
      setOpen(false);
      hapticTick();
      setPreviewMoodId(null);
    }
  };

  const handleGroupSelect = (groupId: MoodGroupId) => {
    hapticTick();
    setActiveGroupId(groupId);
    setView('subcategories');
  };

  const handleBackToGroups = () => {
    hapticTick();
    setView('groups');
    setPreviewMoodId(null);
  };

  const maybeTransferToProfile = () => {
    if (!transferToProfileOnSelect) return;
    if (window.location.pathname !== profileRoute) {
      setTimeout(() => navigate(profileRoute), 220);
    }
  };

  const handleSubcategorySelect = async (mood: MoodOption) => {
    if (isDisabled) return;
    
    if (previewMoodId !== mood.id) {
      setPreviewMoodId(mood.id);
      hapticTick();
      return;
    }

    hapticSuccess();
    const previous = localValue;

    if (closeOnSelect === 'optimistic') {
      setLocalValue(mood.id);
      setSaving(true);
      try {
        setOpen(false);
        setPreviewMoodId(null);
        await onChange(mood.id);
        maybeTransferToProfile();
      } catch (e) {
        console.error('Error saving mood:', e);
        setLocalValue(previous);
        setOpen(true);
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      await onChange(mood.id);
      setLocalValue(mood.id);
      setOpen(false);
      setPreviewMoodId(null);
      maybeTransferToProfile();
    } catch (e) {
      console.error('Error saving mood:', e);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const filteredMoods = useMemo(() => {
    if (!activeGroupId) return [];
    return moods.filter((m) => m.groupId === activeGroupId);
  }, [moods, activeGroupId]);

  const AVATAR_SIZE_OPEN = isXs ? 64 : 78;
  const AVATAR_SIZE_COLLAPSED = isXs ? 44 : 56;
  const INNER_AVATAR_SIZE = Math.round(AVATAR_SIZE_COLLAPSED * 0.78);
  const EXPANDED_MAX_WIDTH = isXs ? 360 : 640;
  const slidesPerView = isXs ? (isVerySmall ? 3 : 3) : 5;
  const spaceBetween = isXs ? 12 : 20;
  const slideMinWidth = AVATAR_SIZE_OPEN + 28;

  const selectedMood = moods.find((m) => m.id === localValue) ?? null;
  const moodToShow = moods.find((m) => m.id === previewMoodId) ?? null;

  return (
    <>
      <ClickAwayListener onClickAway={() => handleClose()}>
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="moods-open"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                style={{ width: '100%' }}
              >
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
                >
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
                      pt: { xs: 4, sm: 5 },
                      pb: { xs: 3, sm: 4 },
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
                    {/* Header */}
                    <Box
                      sx={{
                        width: '100%',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                        minHeight: 40,
                      }}
                    >
                      {view === 'subcategories' && (
                        <IconButton
                          onClick={handleBackToGroups}
                          sx={{
                            position: 'absolute',
                            left: 0,
                            color: 'rgba(255,255,255,0.8)',
                          }}
                        >
                          <ArrowBackIcon />
                        </IconButton>
                      )}

                      <Typography
                        sx={{
                          color: 'rgba(255,255,255,0.95)',
                          fontWeight: 600,
                          fontSize: { xs: '1.1rem', sm: '1.25rem' },
                        }}
                      >
                        {view === 'groups' 
                          ? 'Как вы себя чувствуете?' 
                          : MOOD_GROUPS.find(g => g.id === activeGroupId)?.label}
                      </Typography>

                      <IconButton
                        onClick={() => handleClose()}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          color: '#fff',
                        }}
                      >
                        <CloseIcon />
                      </IconButton>
                    </Box>

                    {/* Content Area */}
                    <Box sx={{ width: '100%', minHeight: 180, position: 'relative' }}>
                      <AnimatePresence mode="wait">
                        {view === 'groups' ? (
                          <motion.div
                            key="groups-view"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            style={{ width: '100%' }}
                          >
                            {/* LEVEL 1: GROUPS GRID (MUI ICONS) */}
                            <Box
                              sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                gap: 2,
                              }}
                            >
                              {MOOD_GROUPS.map((group) => {
                                const isActive = activeGroupId === group.id;
                                const GroupIcon = group.icon;
                                
                                return (
                                  <Box
                                    key={group.id}
                                    onClick={() => handleGroupSelect(group.id)}
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      width: 80, 
                                    }}
                                  >
                                    <Avatar
                                      sx={{
                                        width: 72,
                                        height: 72,
                                        bgcolor: 'transparent',
                                        border: `2px solid ${isActive ? group.color : alpha(group.color, 0.5)}`,
                                        color: group.color,
                                        transition: 'all 0.2s ease',
                                        boxShadow: isActive 
                                          ? `0 0 15px ${alpha(group.color, 0.4)}` 
                                          : 'none',
                                        '&:hover': {
                                          transform: 'scale(1.08)',
                                          border: `2px solid ${group.color}`,
                                          boxShadow: `0 0 20px ${alpha(group.color, 0.3)}`,
                                        },
                                      }}
                                    >
                                      <GroupIcon sx={{ fontSize: 36 }} />
                                    </Avatar>
                                    
                                    <Typography 
                                      variant="caption" 
                                      sx={{ 
                                        color: 'rgba(255,255,255,0.9)', 
                                        mt: 1,
                                        fontWeight: isActive ? 600 : 400 
                                      }}
                                    >
                                      {group.label}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="subcategories-view"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            style={{ width: '100%' }}
                          >
                            {/* LEVEL 2: SUBCATEGORIES SWIPER */}
                            <Box
                              sx={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: isXs ? 110 : 140,
                              }}
                            >
                              <Swiper
                                onSwiper={(s) => (swiperRef.current = s)}
                                slidesPerView={slidesPerView}
                                spaceBetween={spaceBetween}
                                centeredSlides={false}
                                style={{ width: '100%', padding: '6px 6px' }}
                              >
                                {filteredMoods.map((mood) => {
                                  const IconComp = mood.icon;
                                  const isPreview = previewMoodId === mood.id;
                                  const isSelected = localValue === mood.id;
                                  const isFocused = isPreview || isSelected;
                                  
                                  return (
                                    <SwiperSlide key={mood.id} style={{ display: 'flex', justifyContent: 'center', width: slideMinWidth }}>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                        <IconButton
                                          size="large"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSubcategorySelect(mood);
                                          }}
                                          disabled={isDisabled}
                                        >
                                          <Avatar
                                            sx={{
                                              width: AVATAR_SIZE_OPEN,
                                              height: AVATAR_SIZE_OPEN,
                                              // ТЕПЕРЬ ПРОЗРАЧНЫЙ ФОН + ОБВОДКА
                                              background: 'transparent',
                                              border: `2px solid ${isFocused ? mood.color : alpha(mood.color, 0.5)}`,
                                              color: mood.color,
                                              
                                              transform: isFocused ? 'scale(1.12)' : 'scale(1)',
                                              transition: 'transform 160ms ease, box-shadow 160ms ease',
                                              boxShadow: isFocused ? `0 0 20px ${alpha(mood.color, 0.35)}` : 'none',
                                            }}
                                          >
                                            <IconComp style={{ fontSize: Math.round(AVATAR_SIZE_OPEN * 0.42) }} />
                                          </Avatar>
                                        </IconButton>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: 'rgba(255,255,255,0.92)',
                                            fontWeight: isFocused ? 700 : 500,
                                            fontSize: isFocused ? '1rem' : '0.75rem',
                                            transition: 'all 160ms ease',
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

                            <Box
                              sx={{
                                width: '100%',
                                minHeight: 56,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mt: 2,
                                px: 2,
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
                                {moodToShow ? moodToShow.fullLabel : 'Выберите состояние'}
                              </Typography>
                            </Box>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Box>

                  </Box>
                </Box>
              </motion.div>
            ) : (
              // COLLAPSED VIEW
              <motion.div
                key="moods-closed"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.12 }}
                style={{ width: '100%', maxWidth: 300 }}
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
                    sx={{
                      width: INNER_AVATAR_SIZE,
                      height: INNER_AVATAR_SIZE,
                      borderRadius: '50%',
                      background: GLASS_BG,
                      border: `1px solid ${GLASS_BORDER}`,
                      backdropFilter: 'blur(8px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 8px 24px rgba(8,12,40,0.28)`,
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpen();
                    }}
                  >
                    {selectedMood ? (
                      <Avatar
                        sx={{
                          width: INNER_AVATAR_SIZE,
                          height: INNER_AVATAR_SIZE,
                          // В свернутом виде тоже делаем прозрачным с обводкой, чтобы было единообразно
                          background: 'transparent',
                          border: `2px solid ${selectedMood.color}`,
                          color: selectedMood.color,
                        }}
                      >
                        {(() => {
                          const IconComp = selectedMood.icon;
                          return <IconComp style={{ fontSize: Math.round(INNER_AVATAR_SIZE * 0.5) }} />;
                        })()}
                      </Avatar>
                    ) : (
                      <Avatar sx={{ width: INNER_AVATAR_SIZE, height: INNER_AVATAR_SIZE, bgcolor: 'rgba(255,255,255,0.1)' }} />
                    )}
                  </Box>

                  <Box sx={{ textAlign: 'left', flex: 1, minWidth: 120 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
                      {selectedMood?.label ?? 'Настроение'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                      Нажмите, чтобы изменить
                    </Typography>
                  </Box>

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpen();
                    }}
                    sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}
                  >
                    <EditIcon fontSize="small" sx={{ color: '#fff' }} />
                  </IconButton>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </ClickAwayListener>
    </>
  );
};

export default MoodSlider;