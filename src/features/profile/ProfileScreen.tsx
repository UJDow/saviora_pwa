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
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';

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

// --- Локальные нормализованные типы (гарантируют date: number) ---
type NormalizedDream = Omit<ApiDream, 'date'> & { date: number };
type NormalizedDailyConvo = Omit<ApiDailyConvo, 'date' | 'createdAt' | 'updatedAt'> & {
  date: number;
  createdAt: number;
  updatedAt: number;
};

// --------------------------------------------------------------------------

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

  // unified create box state
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

  // --- Настроение ---
  const [moodSaving, setMoodSaving] = useState(false);
  const todayStr = getLocalDateStr(); // используем локальную дату

  // Консистентные цвета/стили
  const accentColor = 'rgba(88,120,255,0.95)';
  const screenGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const glassBorder = 'rgba(255,255,255,0.06)';

  // === Вспомогательная функция: безопасно -> ms (number) ===
  const toMs = (raw?: number | string | null): number => {
    if (raw == null || raw === '') return Date.now();
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isNaN(n)) return Date.now();
    return n < 1e12 ? n * 1000 : n;
  };

  // === Fetch dreams (normalize to NormalizedDream) ===
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

  // === Fetch daily convos (normalize to NormalizedDailyConvo) ===
  useEffect(() => {
    const fetchDailyConvos = async () => {
      try {
        const data = await api.getDailyConvos();
        const normalized: NormalizedDailyConvo[] = (data || []).map((c: ApiDailyConvo) => {
          const dateMs = toMs((c as any).date ?? (c as any).createdAt);
          const createdAtMs = toMs((c as any).createdAt ?? dateMs);
          const updatedAtMs = toMs((c as any).updatedAt ?? createdAtMs);
          return {
            ...c,
            date: dateMs,
            createdAt: createdAtMs,
            updatedAt: updatedAtMs,
          } as NormalizedDailyConvo;
        });
        normalized.sort((a, b) => b.date - a.date);
        setDailyConvos(normalized);
      } catch (err) {
        console.error('Ошибка загрузки daily convos:', err);
      }
    };
    void fetchDailyConvos();
  }, []);

  // Фильтрация снов и daily convos по дате (строка в формате локальной даты)
  useEffect(() => {
    if (!selectedDreamDate) {
      setFilteredDreams([]);
      setFilteredDailyConvos([]);
      return;
    }

    const fDreams = dreams.filter((d) => new Date(d.date).toLocaleDateString('ru-RU') === selectedDreamDate);
    fDreams.sort((a, b) => b.date - a.date);
    setFilteredDreams(fDreams);

    const fDaily = dailyConvos.filter((c) => new Date(c.date).toLocaleDateString('ru-RU') === selectedDreamDate);
    fDaily.sort((a, b) => b.date - a.date);
    setFilteredDailyConvos(fDaily);
  }, [dreams, dailyConvos, selectedDreamDate]);

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

  // Объединяем даты (строки) для календаря
  const dreamDateStrs = dreams.map((d) => new Date(d.date).toLocaleDateString('ru-RU'));
  const dailyConvoDateStrs = dailyConvos.map((c) => new Date(c.date).toLocaleDateString('ru-RU'));
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

  // unified create handlers
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
      showSnackbar(createMode === 'daily' ? 'Введите тему беседы' : 'Введите текст сна', 'error');
      return;
    }
    setSaving(true);

    try {
      if (createMode === 'dream') {
        const newDream = await api.addDream(createText.trim());
        const norm: NormalizedDream = { ...newDream, date: toMs((newDream as any).date ?? (newDream as any).createdAt) };
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

        const newDaily = await api.addDailyConvo(createText.trim(), null, [], null, null, dateSeconds);

        // Нормализуем поля даты в ms
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

        const highlightParam = normalizedNewDaily?.id ? `&highlight=${encodeURIComponent(normalizedNewDaily.id)}` : '';
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

  const fabLeftSx = {
    ...fabSx,
    left: 18,
    right: 'auto',
    color: '#fff',
    bgcolor: 'rgba(88,120,255,0.95)',
    '&:hover': {
      bgcolor: 'rgba(88,120,255,0.85)',
      boxShadow: '0 0 12px rgba(88, 120, 255, 0.32)',
    },
  };

  const avatarSx = {
    width: 40,
    height: 40,
    bgcolor: avatarColor,
    color: '#fff',
  };

  const showMainSlider = !(profile?.loading) && !profile?.todayMood;

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

        {/* Календарная линия */}
        {calendarView === 'week' && (
          <Box sx={{ mt: 8, mb: 2 }}>
            <CalendarLine
              eventDates={eventDates}
              selectedDate={selectedDate}
              onDateClick={handleDreamDateSelect}
              onMonthYearClick={handleMonthYearClick}
              onDateChange={setSelectedDate}
              hideMonthYearTitle={true}
            />
          </Box>
        )}

        {/* Mood slider */}
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
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'primary.main', fontWeight: 500 }}>
                    Сохраняем...
                  </Typography>
                )}
              </Box>
            </Box>
          </motion.div>
        )}

        {/* Основной контент */}
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

                {filteredDailyConvos.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
                      Темы беседы за {selectedDreamDate}
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {filteredDailyConvos.map((c) => (
                        <Box
                          key={c.id}
                          onClick={() => navigate(`/daily/${c.id}`)}
                          sx={{
                            p: 1,
                            borderRadius: 2,
                            background: 'rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                            '&:hover': { background: 'rgba(255,255,255,0.09)' },
                          }}
                        >
                          <Typography sx={{ color: '#fff', fontWeight: 500 }}>
                            {c.title ?? (c.notes ? c.notes.slice(0, 80) + '...' : 'Без названия')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            {new Date(c.date).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </motion.div>
            ) : (
              <motion.div key="calendarView" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
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
              <motion.div key="inputBox" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.25 }} style={{ position: 'relative', margin: '0 12px' }}>
                <Box sx={{ bgcolor: 'transparent', borderRadius: 2, p: 1 }}>
                  <GlassInputBox
                    value={createText}
                    onChange={setCreateText}
                    onSend={handleCreateSubmit}
                    disabled={saving}
                    onClose={handleCreateClose}
                    placeholder={createMode === 'daily' ? 'Напишите тему или заметку для беседы…' : 'Опишите сон…'}
                  />
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {!inputOpen && (
          <IconButton
            aria-label="Добавить сон"
            onClick={() => { setSelectedDate(new Date()); openCreateBox('dream'); }}
            sx={fabSx}
            size="large"
          >
            <AddIcon fontSize="inherit" />
          </IconButton>
        )}

        {!inputOpen && (
          <IconButton
            aria-label="Создать тему беседы"
            onClick={() => openCreateBox('daily')}
            sx={fabLeftSx}
            size="large"
          >
            <AddIcon fontSize="inherit" />
          </IconButton>
        )}

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

export default ProfileScreen;