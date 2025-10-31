import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { MonthView } from './calendar/MonthView';
import { YearView } from './calendar/YearView';
import { DreamsByDateScreen } from '../dreams/DreamsByDateScreen';
import { useNavigate } from 'react-router-dom';
import { useDreams } from '../dreams/useDreams';

export function MonthDashboardScreen() {
  const navigate = useNavigate();
  const {
    dreamsHistory,
    fetchDreams,
    loading,
  } = useDreams();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dreamDates, setDreamDates] = useState<string[]>([]);
  const [showYearView, setShowYearView] = useState(false);
  const [selectedDreamDate, setSelectedDreamDate] = useState<string | null>(null);

  useEffect(() => {
    fetchDreams();
  }, [fetchDreams]);

  useEffect(() => {
    if (dreamsHistory.length) {
      const dates = dreamsHistory.map(d =>
        new Date(d.date).toLocaleDateString('ru-RU')
      );
      setDreamDates(dates);
    }
  }, [dreamsHistory]);

  const selectedYear = selectedDate.getFullYear();

  const handleBackToMonth = () => {
    setSelectedDreamDate(null);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Button
        variant="outlined"
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
        disabled={loading}
      >
        Назад
      </Button>

      {!selectedDreamDate && !showYearView && (
        <Typography
          variant="h6"
          align="center"
          sx={{ mb: 2, cursor: 'pointer', userSelect: 'none', color: 'primary.main' }}
          onClick={() => setShowYearView(true)}
          title="Перейти к годовому обзору"
        >
          {selectedYear}
        </Typography>
      )}

      {selectedDreamDate ? (
        <>
          <DreamsByDateScreen
            date={selectedDreamDate}
            onBack={handleBackToMonth}
            usePaper={false}
            dreams={dreamsHistory.filter(d => {
              const dDate = new Date(d.date).toLocaleDateString('ru-RU');
              return dDate === selectedDreamDate;
            })}
          />
          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={handleBackToMonth}>
              Назад к месяцу
            </Button>
          </Box>
        </>
      ) : showYearView ? (
        <>
          <YearView
            dreamDates={dreamDates}
            selectedYear={selectedYear}
            onMonthClick={(monthDate) => {
              setSelectedDate(monthDate);
              setShowYearView(false);
            }}
            onBackToWeek={() => setShowYearView(false)}
          />
          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => setShowYearView(false)}>
              Назад к месяцу
            </Button>
          </Box>
        </>
      ) : (
        <>
          <MonthView
            dreamDates={dreamDates}
            selectedDate={selectedDate}
            onDateClick={(dateStr) => {
              setSelectedDreamDate(dateStr);
            }}
            onWeekClick={() => {}}
            onYearClick={() => setShowYearView(true)}
            onDateChange={setSelectedDate}
            onBackToWeek={() => {}}
            hideMonthYearTitle={true}
          />
          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Дашборд статистики
            </Typography>
            <Typography>Количество записанных снов: {dreamDates.length}</Typography>
            <Typography>Толкования снов: 0</Typography>
            <Typography>Завершённые сны: 0</Typography>
            <Typography>Настроение: —</Typography>
          </Paper>
        </>
      )}
    </Box>
  );
}