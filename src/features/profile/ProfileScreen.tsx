import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Avatar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';

import { useAuth } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { request } from 'src/utils/api';
import { motion, AnimatePresence } from 'framer-motion';

import { CalendarLine } from './calendar/CalendarLine';
import { MonthView } from './calendar/MonthView';
import { YearView } from './calendar/YearView';
import { DayView } from './calendar/DayView';
import { DreamsByDateScreen } from '../dreams/DreamsByDateScreen';

import { GlassInputBox } from './GlassInputBox';

type Dream = {
  id: string;
  dreamText: string;
  date: number;
};

type CalendarView = 'week' | 'month' | 'year' | 'day';

export function ProfileScreen() {
  const { logout } = useAuth();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [filteredDreams, setFilteredDreams] = useState<Dream[]>([]);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [previousMonthDate, setPreviousMonthDate] = useState<Date | null>(null);
  const [selectedDreamDate, setSelectedDreamDate] = useState<string | null>(null);

  const [inputOpen, setInputOpen] = useState(false);
  const [dreamText, setDreamText] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Меню пользователя слева
  const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null);
  const userMenuOpen = Boolean(userAnchorEl);

  const navigate = useNavigate();

  // Ссылка на контейнер с прокруткой
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!selectedDreamDate) {
      setFilteredDreams([]);
      return;
    }
    const filtered = dreams.filter(d => {
      const dreamDateStr = new Date(d.date).toLocaleDateString('ru-RU');
      return dreamDateStr === selectedDreamDate;
    });
    filtered.sort((a, b) => b.date - a.date);
    setFilteredDreams(filtered);
  }, [dreams, selectedDreamDate]);

  // Прокрутка вниз при открытии поля ввода
  useEffect(() => {
    if (inputOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [inputOpen]);

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
      alert('Введите текст сна');
      return;
    }
    setSaving(true);
    try {
      const newDream = await request<Dream>(
        '/dreams',
        {
          method: 'POST',
          body: JSON.stringify({
            dreamText: dreamText.trim(),
            // date не передаём, сервер сам ставит дату
          }),
        },
        true
      );

      setDreams(prev => [newDream, ...prev]);
      setDreamText('');
      setInputOpen(false);
      setSnackbarOpen(true);

      const dateStr = new Date(newDream.date).toLocaleDateString('ru-RU');
      setSelectedDreamDate(dateStr);
    } catch (e: any) {
      alert('Ошибка при сохранении сна: ' + (e.message || 'Неизвестная ошибка'));
      console.error('Ошибка при сохранении сна:', e);
    } finally {
      setSaving(false);
    }
  };

  // Меню пользователя слева
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserAnchorEl(event.currentTarget);
  };
  const handleUserMenuClose = () => {
    setUserAnchorEl(null);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    logout();
  };

  const openInput = () => {
    setSelectedDate(new Date());
    setInputOpen(true);
  };

  // Форматируем месяц и год для отображения сверху
  const displayMonthYear = selectedDate.toLocaleString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Box
      component={Paper}
      elevation={4}
      sx={{
        p: 4,
        mt: 8,
        maxWidth: 600,
        mx: 'auto',
        background: 'rgba(255,255,255,0.85)',
        borderRadius: 3,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '80vh',
      }}
    >
      {/* Иконка пользователя слева сверху */}
      <Box sx={{ position: 'absolute', top: 16, left: 16 }}>
        <IconButton
          aria-label="Пользователь"
          aria-controls={userMenuOpen ? 'user-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={userMenuOpen ? 'true' : undefined}
          onClick={handleUserMenuOpen}
          size="large"
          sx={{
            bgcolor: 'transparent',
            color: 'rgba(88, 120, 255, 0.85)',
            borderRadius: '50%',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: 'rgba(88, 120, 255, 0.1)',
              boxShadow: '0 0 8px rgba(88, 120, 255, 0.4)',
            },
            p: 1,
            minWidth: 40,
            minHeight: 40,
          }}
        >
          <PersonIcon />
        </IconButton>
        <Menu
          id="user-menu"
          anchorEl={userAnchorEl}
          open={userMenuOpen}
          onClose={handleUserMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: 150,
              boxShadow:
                '0 4px 20px rgba(0,0,0,0.12), 0 7px 10px rgba(0,0,0,0.08)',
            },
          }}
        >
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Выйти</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      {/* Иконка календаря справа сверху */}
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <IconButton
          aria-label="Календарь"
          onClick={() => navigate('/calendar/month')}
          size="large"
          sx={{
            bgcolor: 'transparent',
            color: 'rgba(88, 120, 255, 0.85)',
            borderRadius: '50%',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: 'rgba(88, 120, 255, 0.1)',
              boxShadow: '0 0 8px rgba(88, 120, 255, 0.4)',
            },
            p: 1,
            minWidth: 40,
            minHeight: 40,
          }}
        >
          <CalendarTodayIcon />
        </IconButton>
      </Box>

      {/* Строка с месяцем и годом сверху, уменьшенный и серый */}
      <Typography
        variant="subtitle2"
        align="center"
        sx={{
          position: 'absolute',
          top: 56,
          left: 0,
          right: 0,
          color: 'gray',
          userSelect: 'none',
          fontWeight: '500',
        }}
      >
        {displayMonthYear}
      </Typography>

      {/* Переносим единственную полоску с датами (CalendarLine) сюда, под месяцем/годом */}
      {calendarView === 'week' && (
        <Box sx={{ mt: 8, mb: 3 }}>
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

      {/* Приветственное окно с собачкой */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'rgba(200, 180, 200, 0.2)',
          borderRadius: 2,
          p: 2,
          mb: 3,
          gap: 2,
          width: '60%',
          mx: 'auto',
          mt: calendarView === 'week' ? 0 : '20vh',
          justifyContent: 'center',
        }}
      >
        <Avatar
          src="/path-to-dog-image.jpg"
          alt="Собачка"
          sx={{ width: 40, height: 40 }}
        />
        <Typography variant="h6" sx={{ color: 'text.primary', textAlign: 'center' }}>
          Сегодня вы не записали ни одного сна
        </Typography>
      </Box>

      {/* Основной контент с прокруткой */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flexGrow: 1,
          mt: 2,
          maxWidth: 600,
          mx: 'auto',
          overflowY: 'auto',
          position: 'relative',
          paddingBottom: inputOpen ? '160px' : '80px',
          transition: 'padding-bottom 0.1s ease',
        }}
      >
        <AnimatePresence mode="wait">
          {selectedDreamDate ? (
            <motion.div
              key="dreamsList"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <DreamsByDateScreen
                date={selectedDreamDate}
                onBack={handleBackToCalendar}
                usePaper={false}
                dreams={filteredDreams}
              />
            </motion.div>
          ) : (
            <motion.div
              key="calendarView"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
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
                  onMonthClick={(monthDate) => {
                    setSelectedDate(monthDate);
                    setCalendarView('month');
                  }}
                  onYearChange={(year) => {
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

        {/* Анимированное появление поля ввода */}
        <AnimatePresence>
          {inputOpen && (
            <motion.div
              key="inputBox"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'relative',
                bottom: 'auto',
                left: 'auto',
                right: 'auto',
                zIndex: 1400,
                margin: '0 16px',
              }}
            >
              <GlassInputBox
                value={dreamText}
                onChange={setDreamText}
                onSend={handleSendDream}
                disabled={saving}
                onClose={() => setInputOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Кнопка плюсика в правом нижнем углу контейнера */}
      {!inputOpen && (
        <IconButton
          color="primary"
          onClick={openInput}
          aria-label="Добавить сон"
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            bgcolor: 'transparent',
            borderRadius: '50%',
            boxShadow: 'none',
            border: 'none',
            color: 'rgba(88, 120, 255, 0.85)',
            '&:hover': {
              bgcolor: 'rgba(88, 120, 255, 0.1)',
              boxShadow: '0 0 8px rgba(88, 120, 255, 0.4)',
            },
            p: 1,
            minWidth: 40,
            minHeight: 40,
            zIndex: 1300,
          }}
          size="large"
        >
          <AddIcon fontSize="inherit" />
        </IconButton>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Сон успешно сохранён!
        </Alert>
      </Snackbar>
    </Box>
  );
}