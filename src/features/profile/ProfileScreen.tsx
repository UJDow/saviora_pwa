// ProfileScreen.tsx
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
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';

import { useAuth } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { request, getMoodForDate, setMoodForDate } from 'src/utils/api';
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

// --------------------------------------------------------------------------

type Dream = {
  id: string;
  dreamText: string;
  date: number;
  context?: string;
};

type CalendarView = 'week' | 'month' | 'year' | 'day';

export function ProfileScreen() {
  const { logout } = useAuth();
  const { profile, getIconComponent, updateProfile } = useProfile();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [filteredDreams, setFilteredDreams] = useState<Dream[]>([]);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [previousMonthDate, setPreviousMonthDate] = useState<Date | null>(null);
  const [selectedDreamDate, setSelectedDreamDate] = useState<string | null>(null);

  const [inputOpen, setInputOpen] = useState(false);
  const [dreamText, setDreamText] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const avatarIcon = profile.avatarIcon;
  const IconComp = getIconComponent(avatarIcon);
  const avatarColor =
    AVATAR_OPTIONS.find((o) => o.icon === avatarIcon)?.color || '#f0f0f0';

  // --- Настроение ---
  const [moodSaving, setMoodSaving] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Консистентные цвета/стили
  const accentColor = 'rgba(88,120,255,0.95)';
  const screenGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const glassBorder = 'rgba(255,255,255,0.06)';

  // Загрузка снов
  useEffect(() => {
    const fetchDreams = async () => {
      try {
        const data = await request<Dream[]>('/dreams', {}, true);
        data.sort((a, b) => b.date - a.date);
        setDreams(data);
      } catch (error) {
        console.error('Ошибка загрузки снов:', error);
      }
    };
    fetchDreams();
  }, []);

  // Фильтрация снов по дате
  useEffect(() => {
    if (!selectedDreamDate) {
      setFilteredDreams([]);
      return;
    }
    const filtered = dreams.filter((d) => {
      const dreamDateStr = new Date(d.date).toLocaleDateString('ru-RU');
      return dreamDateStr === selectedDreamDate;
    });
    filtered.sort((a, b) => b.date - a.date);
    setFilteredDreams(filtered);
  }, [dreams, selectedDreamDate]);

  // Автоскролл при открытии инпута
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

  // Обработчик выбора настроения — сохраняет и обновляет контекст (без навигации)
  const handleMoodSelect = async (moodId: string): Promise<void> => {
    setMoodSaving(true);
    try {
      const res = await setMoodForDate(todayStr, moodId);
      // обновляем контекст — теперь profile.todayMood != null => слайдер исчезнет
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

  const dreamDates = Array.from(
    new Set(dreams.map((d) => new Date(d.date).toLocaleDateString('ru-RU')))
  );

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

  const handleSendDream = async () => {
    if (!dreamText.trim()) {
      showSnackbar('Введите текст сна', 'error');
      return;
    }
    setSaving(true);
    try {
      const newDream = await request<Dream>(
        '/dreams',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dreamText: dreamText.trim(),
          }),
        },
        true
      );
      setDreams((prev) => [newDream, ...prev]);
      setDreamText('');
      setInputOpen(false);
      showSnackbar('Сон успешно сохранён! 🌙', 'success');
      const dateStr = new Date(newDream.date).toLocaleDateString('ru-RU');
      setSelectedDreamDate(dateStr);
    } catch (e: any) {
      showSnackbar('Ошибка при сохранении сна: ' + (e.message || 'Неизвестная ошибка'), 'error');
      console.error('Ошибка при сохранении сна:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    navigate('/profile/user');
  };

  const displayMonthYear = selectedDate.toLocaleString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  // --- Стили для консистентности ---
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

  const smallIconBtnSx = {
    bgcolor: 'transparent',
    color: accentColor,
    borderRadius: '50%',
    boxShadow: 'none',
    '&:hover': {
      bgcolor: 'rgba(88, 120, 255, 0.12)',
      boxShadow: '0 0 12px rgba(88, 120, 255, 0.28)',
    },
    p: 1,
    minWidth: 40,
    minHeight: 40,
  };

  const fabSx = {
    position: 'absolute',
    bottom: 18,
    right: 18,
    bgcolor: 'rgba(255,255,255,0.12)',
    borderRadius: '50%',
    boxShadow: '0 6px 18px rgba(24,32,80,0.18)',
    border: 'none',
    color: accentColor,
    '&:hover': {
      bgcolor: 'rgba(88, 120, 255, 0.18)',
      boxShadow: '0 0 12px rgba(88, 120, 255, 0.28)',
    },
    p: 1,
    minWidth: 44,
    minHeight: 44,
    zIndex: 1300,
    backdropFilter: 'blur(4px)',
  };

  const avatarSx = {
    width: 40,
    height: 40,
    bgcolor: avatarColor,
    color: '#fff',
  };

  // Показ слайдера только если профиль загружен и сегодня ещё нет настроения
  const showMainSlider = !profile.loading && !profile.todayMood;

  return (
    <Box sx={pageSx}>
      <Box sx={mainCardSx}>
        {/* Верхний левый — кнопка профиля */}
        <Box sx={{ position: 'absolute', top: 12, left: 12 }}>
          <IconButton
            aria-label="Пользователь"
            onClick={handleUserMenuOpen}
            size="large"
            sx={smallIconBtnSx}
          >
            <Avatar sx={avatarSx}>
              {IconComp ? <IconComp /> : <PersonIcon />}
            </Avatar>
          </IconButton>
        </Box>

        {/* Верхний правый — календарь */}
        <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
          <IconButton
            aria-label="Календарь"
            onClick={() => navigate('/calendar/month')}
            size="large"
            sx={smallIconBtnSx}
          >
            <CalendarTodayIcon />
          </IconButton>
        </Box>

        {/* Месяц и год (центр) */}
        <Typography
          variant="subtitle2"
          align="center"
          sx={{
            position: 'absolute',
            top: 56,
            left: 0,
            right: 0,
            color: '#fff',
            userSelect: 'none',
            fontWeight: 500,
            textShadow: '0 2px 12px rgba(4,6,26,0.28)',
          }}
        >
          {displayMonthYear}
        </Typography>

        {/* Календарная линия (у CalendarLine фон уже прозрачный) */}
        {calendarView === 'week' && (
          <Box sx={{ mt: 8, mb: 2 }}>
            <CalendarLine
              dreamDates={dreamDates}
              selectedDate={selectedDate}
              onDateClick={handleDreamDateSelect}
              onMonthYearClick={handleMonthYearClick}
              onDateChange={setSelectedDate}
              hideMonthYearTitle={true}
            />
          </Box>
        )}

        {/* --- Mood text + slider: показываем только если нет todayMood --- */}
        {showMainSlider && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
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

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 84 }}>
                  {moodSaving ? (
                    <CircularProgress size={28} sx={{ color: accentColor }} />
                  ) : (
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MoodSlider 
  value={profile.todayMood ?? null}
  onChange={handleMoodSelect} 
  loading={moodSaving} 
  transferToProfileOnSelect={false}
  profileRoute="/profile/user"
  ready={!profile.loading}
/>
                    </Box>
                  )}
                </Box>

                {moodSaving && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'primary.main', fontWeight: 500 }}>
                    Сохраняем...
                  </Typography>
                )}
              </Box>
            </Box>
          </motion.div>
        )}

        {/* Основной скролл-контент */}
        <Box
          ref={scrollContainerRef}
          sx={{
            flexGrow: 1,
            mt: 0,
            maxWidth: 760,
            mx: 'auto',
            overflowY: 'auto',
            position: 'relative',
            paddingBottom: inputOpen ? '160px' : '100px',
            transition: 'padding-bottom 0.1s ease',
            width: '100%',
            px: 0,
          }}
        >
          <AnimatePresence mode="wait">
            {selectedDreamDate ? (
              <motion.div key="dreamsList" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
                <DreamsByDateScreen date={selectedDreamDate} onBack={handleBackToCalendar} usePaper={false} dreams={filteredDreams} />
              </motion.div>
            ) : (
              <motion.div key="calendarView" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
                {calendarView === 'month' && (
                  <MonthView
                    dreamDates={dreamDates}
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
                    dreamDates={dreamDates}
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
                    dreamDates={dreamDates}
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
              <motion.div key="inputBox" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.25 }} style={{ position: 'relative', margin: '0 12px' }}>
                <Box sx={{ bgcolor: 'transparent', borderRadius: 2, p: 1 }}>
                  <GlassInputBox value={dreamText} onChange={setDreamText} onSend={handleSendDream} disabled={saving} onClose={() => setInputOpen(false)} />
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Floating add */}
        {!inputOpen && (
          <IconButton aria-label="Добавить сон" onClick={() => { setSelectedDate(new Date()); setInputOpen(true); }} sx={fabSx} size="large">
            <AddIcon fontSize="inherit" />
          </IconButton>
        )}

        {/* Snackbar */}
        <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
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
    </Box>
  );
}