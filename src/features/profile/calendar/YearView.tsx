import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { alpha } from '@mui/material/styles';
import type { CalendarStyles } from './MonthView'; // убедитесь, что путь корректен

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
  dreamDates: string[]; // формат: "dd.MM.yyyy"
  selectedYear: number;
  selectedMonth?: number;
  onMonthClick?: (monthDate: Date) => void;
  onBackToWeek?: () => void;
  onYearChange?: (year: number) => void;
  calendarStyles?: CalendarStyles;
}

const MotionBox = motion.create(Box);

export function YearView({
  dreamDates,
  selectedYear,
  selectedMonth,
  onMonthClick,
  onBackToWeek,
  onYearChange,
  calendarStyles = {},
}: YearViewProps) {
  const theme = useTheme();

  const mergedStyles: CalendarStyles = {
    containerBg: alpha('#ffffff', 0.06),
    tileBg: alpha('#ffffff', 0.02),
    dayColor: '#ffffff',
    dayMutedColor: alpha('#ffffff', 0.5),
    borderColor: alpha('#ffffff', 0.12),
    selectedGradient: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.32)}, ${alpha(theme.palette.primary.main, 0.18)})`,
    hoverShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.18)}`,
    ...calendarStyles,
  };

  const circleSize = 18; // размер маленькой ячейки
  const gapSize = 6;
  const monthTileWidth = circleSize * 7 + gapSize * 6;

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.36, ease: 'easeInOut' }}
      sx={{
        maxWidth: monthTileWidth * 3 + 48,
        mx: 'auto',
        userSelect: 'none',
        p: 2,
        borderRadius: 3,
        // glass container
        background: mergedStyles.containerBg,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid ${mergedStyles.borderColor}`,
        boxShadow: '0 10px 30px rgba(8,12,20,0.32)',
      }}
    >
      <Typography
        variant="h5"
        align="center"
        sx={{
          mb: 2,
          cursor: onBackToWeek ? 'pointer' : 'default',
          color: onBackToWeek ? theme.palette.primary.main : mergedStyles.dayColor,
          fontWeight: 700,
        }}
        onClick={() => onBackToWeek && onBackToWeek()}
        title={onBackToWeek ? 'Вернуться к неделе' : undefined}
      >
        {selectedYear}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          justifyContent: 'center',
        }}
      >
        {Array.from({ length: 12 }).map((_, month) => {
          const calendarDays = generateCalendarDays(selectedYear, month);
          const isSelectedMonth = selectedMonth === month;

          return (
            <Box
              key={month}
              onClick={() => onMonthClick && onMonthClick(new Date(selectedYear, month, 1))}
              role={onMonthClick ? 'button' : 'presentation'}
              aria-label={`Открыть месяц ${monthNamesShort[month]}`}
              sx={{
                cursor: onMonthClick ? 'pointer' : 'default',
                userSelect: 'none',
                width: '100%',
                minWidth: monthTileWidth,
                borderRadius: 2,
                p: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                // glass tile
                background: isSelectedMonth ? mergedStyles.selectedGradient : mergedStyles.tileBg,
                border: `1px solid ${mergedStyles.borderColor}`,
                transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
                '&:hover': onMonthClick
                  ? {
                      transform: 'translateY(-4px)',
                      boxShadow: mergedStyles.hoverShadow,
                    }
                  : {},
              }}
            >
              <Typography
                variant="subtitle2"
                align="center"
                sx={{
                  mb: 0.4,
                  color: isSelectedMonth ? '#fff' : mergedStyles.dayColor,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
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
                    return <Box key={`empty-${month}-${idx}`} sx={{ width: circleSize, height: circleSize }} />;
                  }
                  const dreamExists = hasDream(date);
                  const today = isToday(date);
                  const isCurrentMonth = date.getMonth() === month;
                  const daySelected =
                    isSelectedMonth && date.getDate() === 1; // мелкий маркер для выбранного месяца (пример)

                  return (
                    <Box
                      key={date.toISOString()}
                      sx={{
                        width: circleSize,
                        height: circleSize,
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: dreamExists ? 700 : 500,
                        userSelect: 'none',
                        cursor: 'default',
                        boxSizing: 'border-box',
                        fontSize: '0.65rem',
                        lineHeight: `${circleSize}px`,
                        transition: 'background 140ms ease, transform 140ms ease',
                        background: daySelected ? mergedStyles.selectedGradient : 'transparent',
                        color: daySelected ? '#fff' : isCurrentMonth ? mergedStyles.dayColor : mergedStyles.dayMutedColor,
                        border: today
                          ? `1.5px solid ${theme.palette.primary.main}`
                          : dreamExists
                          ? `1.5px solid ${alpha(theme.palette.primary.main, 0.9)}`
                          : `1px solid transparent`,
                      }}
                    >
                      {date.getDate()}
                      {/* маленькая точка-индикатор сна */}
                      {dreamExists && !daySelected && (
                        <Box
                          component="span"
                          sx={{
                            position: 'absolute',
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: '#fff',
                            bottom: 4,
                            boxShadow: `0 0 4px ${alpha('#000', 0.2)}`,
                          }}
                        />
                      )}
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