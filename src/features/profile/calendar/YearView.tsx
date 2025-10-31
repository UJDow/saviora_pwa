import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

const monthNamesShort = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthStartDay(year: number, month: number) {
  const d = new Date(year, month, 1);
  let day = d.getDay();
  if (day === 0) day = 7; // Воскресенье - 7
  return day;
}

function generateCalendarDays(year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month);
  const monthStartDay = getMonthStartDay(year, month);

  const daysArray: (Date | null)[] = [];
  for (let i = 1; i < monthStartDay; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(new Date(year, month, d));
  }
  return daysArray;
}

interface YearViewProps {
  dreamDates: string[];
  selectedYear: number;
  selectedMonth?: number;
  onMonthClick?: (monthDate: Date) => void;
  onBackToWeek?: () => void;

  onYearChange?: (year: number) => void;
}

const MotionBox = motion(Box);

export function YearView({ dreamDates, selectedYear, selectedMonth, onMonthClick, onBackToWeek, onYearChange }: YearViewProps) {
  const theme = useTheme();

  const circleSize = 18;
  const gapSize = 2;
  const totalWidth = circleSize * 7 + gapSize * 6;

  const hasDream = (d: Date | null) => {
    if (!d) return false;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}.${month}.${year}`;
    return dreamDates.includes(dateStr);
  };

  const isToday = (d: Date | null) => {
    if (!d) return false;
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  return (
    <MotionBox
      key={`yearview-${selectedYear}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      sx={{ maxWidth: totalWidth * 3 + 12, mx: 'auto', userSelect: 'none' }}
    >
      <Typography
        variant="h5"
        align="center"
        sx={{ mb: 3, cursor: onBackToWeek ? 'pointer' : 'default', color: onBackToWeek ? theme.palette.primary.main : undefined }}
        onClick={() => onBackToWeek && onBackToWeek()}
        title={onBackToWeek ? 'Вернуться к неделе' : undefined}
      >
        {selectedYear}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.5,
          justifyContent: 'center',
        }}
      >
        {Array.from({ length: 12 }).map((_, month) => {
          const calendarDays = generateCalendarDays(selectedYear, month);
          const isSelectedMonth = selectedMonth === month;

          return (
            <Box
              key={month}
              sx={{
                cursor: 'pointer',
                userSelect: 'none',
                width: totalWidth,
                backgroundColor: isSelectedMonth ? theme.palette.action.selected : 'transparent',
                borderRadius: 1,
                p: 0.3,
              }}
              onClick={() => onMonthClick && onMonthClick(new Date(selectedYear, month, 1))}
            >
              <Typography
                variant="subtitle2"
                align="center"
                sx={{ mb: 0.4, color: theme.palette.text.primary, userSelect: 'none' }}
              >
                {monthNamesShort[month]}
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(7, ${circleSize}px)`,
                  gridAutoRows: `${circleSize}px`,
                  gap: `${gapSize}px`,
                  justifyContent: 'center',
                }}
              >
                {calendarDays.map((date, idx) => {
                  if (!date) {
                    return <Box key={`empty-${idx}`} sx={{ width: circleSize, height: circleSize }} />;
                  }
                  const dreamExists = hasDream(date);
                  const today = isToday(date);
                  const isCurrentMonth = date.getMonth() === month;

                  return (
                    <Box
                      key={date.toISOString()}
                      sx={{
                        width: circleSize,
                        height: circleSize,
                        borderRadius: '50%',
                        border: today
                          ? `2px solid ${theme.palette.primary.main}`
                          : dreamExists
                          ? `2px solid ${theme.palette.primary.main}`
                          : 'none',
                        backgroundColor: dreamExists ? theme.palette.primary.main : 'transparent',
                        color: isCurrentMonth ? (dreamExists ? '#fff' : theme.palette.text.primary) : theme.palette.text.disabled,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: dreamExists ? 'bold' : 'normal',
                        userSelect: 'none',
                        cursor: 'default',
                        boxSizing: 'border-box',
                        fontSize: '0.7rem',
                        lineHeight: `${circleSize}px`,
                        transition: 'background-color 0.3s, color 0.3s, border-color 0.3s',
                      }}
                    >
                      {date.getDate()}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </MotionBox>
  );
}