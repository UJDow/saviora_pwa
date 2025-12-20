// src/screens/ProfileScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Snackbar,
  Alert,
  Avatar,
  CircularProgress,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

import { alpha } from '@mui/material/styles';

import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

import { useAuth } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import * as api from 'src/utils/api';
import type { Dream as ApiDream, DailyConvo as ApiDailyConvo } from 'src/utils/api';
import { motion, AnimatePresence } from 'framer-motion';

import { CalendarLine } from './calendar/CalendarLine';
import { MonthView } from './calendar/MonthView';
import { YearView } from './calendar/YearView';
import { DayView } from './calendar/DayView';
import { DreamsByDateScreen } from '../dreams/DreamsByDateScreen';
import { GlassInputBox } from './GlassInputBox';

import { useProfile } from './ProfileContext';
import { AVATAR_OPTIONS } from './ProfileEditForm';

import { MoodSlider } from './mood/MoodSlider';
import { getLocalDateStr } from 'src/utils/dateUtils';

import AutoGraphIcon from '@mui/icons-material/AutoGraph';

type NormalizedDream = Omit<ApiDream, 'date'> & { date: number };
type NormalizedDailyConvo = Omit<ApiDailyConvo, 'date' | 'createdAt' | 'updatedAt'> & {
  date: number;
  createdAt: number;
  updatedAt: number;
};

type CalendarView = 'week' | 'month' | 'year' | 'day';

export function ProfileScreen() {
  const { logout } = useAuth();
  const { profile, getIconComponent, updateProfile } = useProfile();
  const [dreams, setDreams] = useState<NormalizedDream[]>([]);
  const [filteredDreams, setFilteredDreams] = useState<NormalizedDream[]>([]);
  const [dailyConvos, setDailyConvos] = useState<NormalizedDailyConvo[]>([]);
  const [filteredDailyConvos, setFilteredDailyConvos] = useState<NormalizedDailyConvo[]>([]);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [previousMonthDate, setPreviousMonthDate] = useState<Date | null>(null);
  const [selectedDreamDate, setSelectedDreamDate] = useState<string | null>(null);

  const [inputOpen, setInputOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'dream' | 'daily' | null>(null);
  const [createText, setCreateText] = useState('');
  const [saving, setSaving] = useState(false);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const avatarIcon = profile?.avatarIcon ?? null;
  const IconComp = getIconComponent ? getIconComponent(avatarIcon) : null;
  const avatarColor =
    AVATAR_OPTIONS.find((o) => o.icon === avatarIcon)?.color || '#f0f0f0';

  const [moodSaving, setMoodSaving] = useState(false);
  const todayStr = getLocalDateStr();

  const accentColor = 'rgba(88,120,255,0.95)';
  const screenGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const glassBorder = 'rgba(255,255,255,0.06)';

  const [loading, setLoading] = useState(true);

useEffect(() => {
  const timer = setTimeout(() => setLoading(false), 2000);
  return () => clearTimeout(timer);
}, []);

  const toMs = (raw?: number | string | null): number => {
    if (raw == null || raw === '') return Date.now();
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isNaN(n)) return Date.now();
    return n < 1e12 ? n * 1000 : n;
  };

  // === Угловые иконки: общие стили ===
  const cornerIconOffset = 18; // подбери под макет (12/16/18)
  const cornerIconBoxSx = {
    position: 'absolute' as const,
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.10)',
    boxShadow:
      '0 4px 16px 0 rgba(88,120,255,0.14), 0 1.5px 8px 0 rgba(255,255,255,0.08) inset',
    border: '1.2px solid rgba(255,255,255,0.14)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 1200,
    transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 0,
  } as const;

  useEffect(() => {
    const fetchDreams = async () => {
      try {
        const data = await api.getDreams();
        const normalized: NormalizedDream[] = (data || []).map((d: ApiDream) => ({
          ...d,
          date: toMs((d as any).date ?? (d as any).createdAt),
        }));
        normalized.sort((a, b) => b.date - a.date);
        setDreams(normalized);
      } catch (error) {
        console.error('Ошибка загрузки снов:', error);
      }
    };
    void fetchDreams();
  }, []);

  useEffect(() => {
    const fetchDailyConvos = async () => {
      try {
        const data = await api.getDailyConvos();
        const normalized: NormalizedDailyConvo[] = (data || []).map(
          (c: ApiDailyConvo) => {
            const dateMs = toMs((c as any).date ?? (c as any).createdAt);
            const createdAtMs = toMs((c as any).createdAt ?? dateMs);
            const updatedAtMs = toMs((c as any).updatedAt ?? createdAtMs);
            return {
              ...c,
              date: dateMs,
              createdAt: createdAtMs,
              updatedAt: updatedAtMs,
            } as NormalizedDailyConvo;
          },
        );
        normalized.sort((a, b) => b.date - a.date);
        setDailyConvos(normalized);
      } catch (err) {
        console.error('Ошибка загрузки daily convos:', err);
      }
    };
    void fetchDailyConvos();
  }, []);

  useEffect(() => {
    if (!selectedDreamDate) {
      setFilteredDreams([]);
      setFilteredDailyConvos([]);
      return;
    }

    const fDreams = dreams.filter(
      (d) => new Date(d.date).toLocaleDateString('ru-RU') === selectedDreamDate,
    );
    fDreams.sort((a, b) => b.date - a.date);
    setFilteredDreams(fDreams);

    const fDaily = dailyConvos.filter(
      (c) => new Date(c.date).toLocaleDateString('ru-RU') === selectedDreamDate,
    );
    fDaily.sort((a, b) => b.date - a.date);
    setFilteredDailyConvos(fDaily);
  }, [dreams, dailyConvos, selectedDreamDate]);

  useEffect(() => {
    if (inputOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [inputOpen]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleMoodSelect = async (moodId: string): Promise<void> => {
    setMoodSaving(true);
    try {
      await api.setMoodForDate(todayStr, moodId);
      updateProfile?.({ todayMood: moodId });
      showSnackbar('Настроение сохранено!', 'success');
    } catch (error) {
      console.error('Ошибка сохранения настроения:', error);
      showSnackbar('Не удалось сохранить настроение', 'error');
      throw error;
    } finally {
      setMoodSaving(false);
    }
  };

  const dreamDateStrs = dreams.map((d) =>
    new Date(d.date).toLocaleDateString('ru-RU'),
  );
  const dailyConvoDateStrs = dailyConvos.map((c) =>
    new Date(c.date).toLocaleDateString('ru-RU'),
  );
  const eventDates = Array.from(new Set([...dreamDateStrs, ...dailyConvoDateStrs]));

  const handleDreamDateSelect = (dateStr: string) => {
    setSelectedDreamDate(dateStr);
  };

  const handleBackToCalendar = () => {
    setSelectedDreamDate(null);
    setCalendarView('week');
  };

  const goToWeekView = () => {
    setCalendarView('week');
  };

  const handleMonthYearClick = () => {
    if (calendarView === 'week') {
      if (previousMonthDate) {
        setSelectedDate(previousMonthDate);
      }
      setCalendarView('month');
    } else if (calendarView === 'month') {
      setCalendarView('year');
    }
  };

  const openCreateBox = (mode: 'dream' | 'daily') => {
    setCreateMode(mode);
    setInputOpen(true);
    setCreateText('');
  };

  const handleCreateClose = () => {
    setInputOpen(false);
    setCreateMode(null);
    setCreateText('');
  };

  const handleCreateSubmit = async () => {
    if (!createText.trim()) {
      showSnackbar(
        createMode === 'daily' ? 'Введите тему беседы' : 'Введите текст сна',
        'error',
      );
      return;
    }
    setSaving(true);

    try {
      if (createMode === 'dream') {
        const newDream = await api.addDream(createText.trim());
        const norm: NormalizedDream = {
          ...newDream,
          date: toMs((newDream as any).date ?? (newDream as any).createdAt),
        };
        setDreams((prev) => [norm, ...prev]);
        setCreateText('');
        setInputOpen(false);
        setCreateMode(null);
        showSnackbar('Сон успешно сохранён! 🌙', 'success');
        setSelectedDreamDate(new Date(norm.date).toLocaleDateString('ru-RU'));
        return;
      }

      if (createMode === 'daily') {
        const baseDate = selectedDate ?? new Date();
        const dateObj = new Date(baseDate);
        dateObj.setHours(0, 0, 0, 0);
        const dateSeconds = Math.floor(dateObj.getTime() / 1000);

        const newDaily = await api.addDailyConvo(
          createText.trim(),
          null,
          [],
          null,
          null,
          dateSeconds,
        );

        const dateMs = toMs((newDaily as any).date ?? (newDaily as any).createdAt);
        const createdAtMs = toMs((newDaily as any).createdAt ?? dateMs);
        const updatedAtMs = toMs((newDaily as any).updatedAt ?? createdAtMs);

        const normalizedNewDaily: NormalizedDailyConvo = {
          ...newDaily,
          date: dateMs,
          createdAt: createdAtMs,
          updatedAt: updatedAtMs,
        };

        setDailyConvos((prev) => [normalizedNewDaily, ...prev]);

        setCreateText('');
        setInputOpen(false);
        setCreateMode(null);
        showSnackbar('Тема для беседы создана', 'success');

        const cd = new Date(dateMs);
        const yyyy = cd.getFullYear();
        const mm = String(cd.getMonth() + 1).padStart(2, '0');
        const dd = String(cd.getDate()).padStart(2, '0');
        const dateYmd = `${yyyy}-${mm}-${dd}`;

        const highlightParam = normalizedNewDaily?.id
          ? `&highlight=${encodeURIComponent(normalizedNewDaily.id)}`
          : '';
        navigate(`/daily?date=${encodeURIComponent(dateYmd)}${highlightParam}`);
        return;
      }

      showSnackbar('Не выбран режим создания', 'error');
    } catch (e: any) {
      console.error('Create error:', e);
      showSnackbar(e?.message ?? 'Ошибка при сохранении', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUserMenuOpen = () => {
    navigate('/profile/user');
  };

  const displayMonth = selectedDate.toLocaleString('ru-RU', { month: 'long' });
const displayMonthCapitalized = displayMonth.charAt(0).toUpperCase() + displayMonth.slice(1);

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

  // FAB‑кнопки внизу (оставляем как есть, но теперь они визуально сочетаются с угловыми)
  const fabSx = {
    position: 'absolute' as const,
    bottom: 18,
    right: 18,
    bgcolor: 'rgba(88,120,255,0.85)',
    color: '#fff',
    borderRadius: '50%',
    boxShadow:
      '0 4px 16px 0 rgba(88,120,255,0.18), 0 1.5px 8px 0 rgba(255,255,255,0.10) inset',
    border: '1.5px solid rgba(255,255,255,0.18)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
    '&:hover': {
      bgcolor: 'rgba(88,120,255,1)',
      boxShadow:
        '0 8px 32px 0 rgba(88,120,255,0.28), 0 1.5px 8px 0 rgba(255,255,255,0.16) inset',
      transform: 'scale(1.08)',
    },
    p: 1,
    minWidth: 40,
    minHeight: 40,
    zIndex: 1300,
  };

  const fabLeftSx = {
    position: 'absolute' as const,
    bottom: 18,
    left: 18,
    bgcolor: 'rgba(255,255,255,0.18)',
    color: '#fff',
    borderRadius: '50%',
    boxShadow:
      '0 2px 8px 0 rgba(255,255,255,0.10), 0 1.5px 8px 0 rgba(88,120,255,0.08) inset',
    border: '1.5px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
    opacity: 0.72,
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.28)',
      boxShadow:
        '0 8px 32px 0 rgba(255,255,255,0.18), 0 1.5px 8px 0 rgba(88,120,255,0.18) inset',
      opacity: 1,
      transform: 'scale(1.04)',
    },
    p: 1,
    minWidth: 40,
    minHeight: 40,
    zIndex: 1300,
  };

  const avatarSx = {
    width: 40,
    height: 40,
    bgcolor: avatarColor,
    color: '#fff',
  };

  const showMainSlider = !(profile?.loading) && !profile?.todayMood;

  const Header = () => (
  <Box
    sx={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 56,
      px: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 1300,
      userSelect: 'none',

      /* glass style */
      background: 'rgba(255,255,255,0.10)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.14)',
      boxShadow: '0 8px 28px rgba(41, 52, 98, 0.12)',

      /* скругляем только нижние углы с радиусом 24px, как в футере */
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    }}
  >
    {/* Название */}
    <Typography
      sx={{
        fontFamily: '"Poppins", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        fontWeight: 600,
        fontSize: '1.05rem',
        color: 'rgba(255,255,255,0.95)',
        letterSpacing: 0.4,
        userSelect: 'none',
      }}
    >
      Saviora
    </Typography>

    {/* Профиль */}
    <Box
      onClick={handleUserMenuOpen}
      role="button"
      tabIndex={0}
      aria-label="Профиль"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.10)',
        transition: 'background-color 0.18s, transform 0.12s',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.16)', transform: 'translateY(-1px)' },
        boxShadow: '0 6px 18px rgba(10,14,30,0.12)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Avatar
        sx={{
          width: 36,
          height: 36,
          bgcolor: avatarColor,
          color: '#fff',
          border: 'none',
          boxShadow: 'none',
        }}
      >
        {IconComp ? <IconComp /> : <PersonIcon />}
      </Avatar>
    </Box>
  </Box>
);

const Footer = () => {
  const [activeButton, setActiveButton] = useState<string | null>(null);

  const handlePressStart = (buttonName: string) => {
    setActiveButton(buttonName);
  };

  const handlePressEnd = () => {
    setActiveButton(null);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 30,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: 420,
        height: 64,
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 24,
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 8px 32px rgba(88,120,255,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1300,
        userSelect: 'none',
        px: 1,
      }}
    >
      {/* Беседа — heroicons (две округлые пузыри) */}
      <Box
        onClick={() => openCreateBox('daily')}
        onMouseDown={() => handlePressStart('daily')}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={() => handlePressStart('daily')}
        onTouchEnd={handlePressEnd}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.85)',
          userSelect: 'none',
          transition: 'transform 0.1s ease-in-out, color 0.1s ease-in-out',
          ...(activeButton === 'daily' && {
            transform: 'scale(0.92)',
            color: 'rgba(255,255,255,1)',
          }),
          '&:hover': {
            color: 'rgba(255,255,255,1)',
          },
        }}
        aria-label="Создать тему беседы"
        role="button"
        tabIndex={0}
      >
        <ChatBubbleLeftRightIcon style={{ width: 22, height: 22, color: 'currentColor' }} />
        <Typography variant="caption" sx={{ mt: 0.5 }}>
          Беседа
        </Typography>
      </Box>

      {/* График */}
      <Box
        onClick={() => navigate('/calendar/month')}
        onMouseDown={() => handlePressStart('graph')}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={() => handlePressStart('graph')}
        onTouchEnd={handlePressEnd}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.85)',
          userSelect: 'none',
          transition: 'transform 0.1s ease-in-out, color 0.1s ease-in-out',
          ...(activeButton === 'graph' && {
            transform: 'scale(0.92)',
            color: 'rgba(255,255,255,1)',
          }),
          '&:hover': {
            color: 'rgba(255,255,255,1)',
          },
        }}
        aria-label="Открыть график"
        role="button"
        tabIndex={0}
      >
        <AutoGraphIcon fontSize="medium" />
        <Typography variant="caption" sx={{ mt: 0.5 }}>
          График
        </Typography>
      </Box>

      {/* Сон — луна */}
      <Box
        onClick={() => {
          setSelectedDate(new Date());
          openCreateBox('dream');
        }}
        onMouseDown={() => handlePressStart('dream')}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={() => handlePressStart('dream')}
        onTouchEnd={handlePressEnd}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.9)',
          userSelect: 'none',
          transition: 'transform 0.1s ease-in-out, color 0.1s ease-in-out',
          ...(activeButton === 'dream' && {
            transform: 'scale(0.92)',
            color: 'rgba(255,255,255,1)',
          }),
          '&:hover': {
            color: 'rgba(255,255,255,1)',
          },
        }}
        aria-label="Добавить сон"
        role="button"
        tabIndex={0}
      >
        <NightlightRoundIcon fontSize="medium" />
        <Typography variant="caption" sx={{ mt: 0.5 }}>
          Сон
        </Typography>
      </Box>
    </Box>
  );
};

return (
  <Box
    sx={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: screenGradient,
      color: '#fff',
      overflow: 'hidden',
      position: 'relative',
    }}
  >
    <Header />

    <Box
      ref={scrollContainerRef}
      sx={{
        flexGrow: 1,
        mt: '56px',
        mb: '56px',
        overflowY: 'auto',
        px: 2,
        py: 1,
        position: 'relative',
        maxWidth: 840,
        mx: 'auto',
        width: '100%',
      }}
    >

      <Typography
  variant="subtitle2"
  align="center"
  sx={{
    color: alpha('#ffffff', 0.525),
    userSelect: 'none',
    fontWeight: 500,
    textShadow: '0 2px 12px rgba(4,6,26,0.28)',
    mb: 2, // увеличенный отступ снизу
    mt: 1, // небольшой отступ сверху, чтобы не прилипало к верху
  }}
>
  {displayMonthCapitalized}
</Typography>

      {calendarView === 'week' && (
        <Box sx={{ mt: 2, mb: 2 }}>
  <CalendarLine
    eventDates={eventDates}
    selectedDate={selectedDate}
    onDateClick={handleDreamDateSelect}
    onMonthYearClick={handleMonthYearClick}
    onDateChange={setSelectedDate}
    hideMonthYearTitle
  />
</Box>
      )}

      {showMainSlider && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 0,
              mb: 3,
              mt: 1,
            }}
          >
            <Box sx={{ width: '100%', maxWidth: 760, textAlign: 'center', px: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  mb: 2,
                  fontWeight: 500,
                  color: '#fff',
                  textShadow: '0 2px 10px rgba(6,8,30,0.18)',
                }}
              >
                Какое у тебя сегодня настроение?
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 84,
                }}
              >
                {moodSaving ? (
                  <CircularProgress size={28} sx={{ color: accentColor }} />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MoodSlider
                      value={profile?.todayMood ?? null}
                      onChange={handleMoodSelect}
                      loading={moodSaving}
                      transferToProfileOnSelect={false}
                      profileRoute="/profile/user"
                      ready={!profile?.loading}
                    />
                  </Box>
                )}
              </Box>

              {moodSaving && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 1,
                    color: 'primary.main',
                    fontWeight: 500,
                  }}
                >
                  Сохраняем...
                </Typography>
              )}
            </Box>
          </Box>
        </motion.div>
      )}

      <Box
        sx={{
          flexGrow: 1,
          mt: 0,
          maxWidth: 760,
          mx: 'auto',
          overflowY: 'auto',
          position: 'relative',
          width: '100%',
          px: 0,
        }}
      >
        <AnimatePresence mode="wait">
          {selectedDreamDate ? (
            <motion.div
              key="dreamsList"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <DreamsByDateScreen
                date={selectedDreamDate}
                onBack={handleBackToCalendar}
                usePaper={false}
                dreams={filteredDreams}
                dailyConvos={filteredDailyConvos}
              />
            </motion.div>
          ) : (
            <motion.div
              key="calendarView"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {calendarView === 'month' && (
                <MonthView
                  dreamDates={eventDates}
                  selectedDate={selectedDate}
                  onDateClick={handleDreamDateSelect}
                  onWeekClick={(weekStartDate: Date) => {
                    setPreviousMonthDate(selectedDate);
                    setSelectedDate(weekStartDate);
                    setCalendarView('week');
                  }}
                  onYearClick={() => setCalendarView('year')}
                  onDateChange={setSelectedDate}
                  onBackToWeek={goToWeekView}
                />
              )}
              {calendarView === 'year' && (
                <YearView
                  dreamDates={eventDates}
                  selectedYear={selectedDate.getFullYear()}
                  onMonthClick={(monthDate: Date) => {
                    setSelectedDate(monthDate);
                    setCalendarView('month');
                  }}
                  onYearChange={(year: number) => {
                    setSelectedDate(new Date(year, selectedDate.getMonth(), 1));
                  }}
                  onBackToWeek={goToWeekView}
                />
              )}
              {calendarView === 'day' && (
                <DayView
                  dreamDates={eventDates}
                  selectedDate={selectedDate}
                  onDateClick={handleDreamDateSelect}
                  onDateChange={setSelectedDate}
                  onBackToWeek={goToWeekView}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {inputOpen && (
            <motion.div
              key="inputBox"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
              style={{ position: 'relative', margin: '0 12px' }}
            >
              <Box sx={{ bgcolor: 'transparent', borderRadius: 2, p: 1 }}>
                <GlassInputBox
                  value={createText}
                  onChange={setCreateText}
                  onSend={handleCreateSubmit}
                  disabled={saving}
                  onClose={handleCreateClose}
                  placeholder={
                    createMode === 'daily'
                      ? 'Напишите тему или заметку для беседы…'
                      : 'Опишите сон…'
                  }
                />
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>

    <Footer />

    <Snackbar
      open={snackbarOpen}
      autoHideDuration={3000}
      onClose={() => setSnackbarOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity={snackbarSeverity}
        sx={{
          width: '100%',
          '& .MuiAlert-message': { fontSize: '0.95rem' },
          bgcolor: 'rgba(0,0,0,0.35)',
          color: '#fff',
          border: `1px solid ${glassBorder}`,
          backdropFilter: 'blur(6px)',
        }}
      >
        {snackbarMessage}
      </Alert>
    </Snackbar>
  </Box>
);
}

export default ProfileScreen;