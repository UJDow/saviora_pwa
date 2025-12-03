import React, { useState, useMemo, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import { Box, Typography, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { alpha } from '@mui/material/styles';

// --- Добавлено ---
export interface CalendarStyles {
  containerBg?: string;
  tileBg?: string;
  dayColor?: string;
  dayMutedColor?: string;
  borderColor?: string;
  selectedGradient?: string;
  hoverShadow?: string;
}
// -----------------

const daysShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

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

interface MonthViewProps {
  dreamDates: string[];
  selectedDate: Date;
  onDateClick?: (date: string) => void;
  onMonthChange?: (date: Date) => void;
  onYearClick?: () => void;
  onBackToWeek?: () => void;
  onWeekClick?: (weekStartDate: Date) => void;
  onDateChange?: React.Dispatch<React.SetStateAction<Date>>;
  // --- Добавлено ---
  calendarStyles?: CalendarStyles;
  // -----------------
}

const MotionBox = motion.create(Box);

export function MonthView({
  dreamDates,
  selectedDate,
  onDateClick,
  onMonthChange,
  onYearClick,
  onBackToWeek,
  onWeekClick,
  onDateChange,
  // --- Добавлено ---
  calendarStyles = {},
  // -----------------
}: MonthViewProps) {
  const theme = useTheme();
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const swiperRef = useRef<SwiperType | null>(null);
  const isProgrammaticSlideRef = useRef(false);

  // --- Добавлено: merge стилей ---
  const mergedStyles: CalendarStyles = {
    containerBg: alpha('#ffffff', 0.08),
    tileBg: 'transparent',
    dayColor: '#ffffff',
    dayMutedColor: alpha('#ffffff', 0.5),
    borderColor: alpha('#ffffff', 0.15),
    selectedGradient: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.3)}, ${alpha(theme.palette.primary.main, 0.2)})`,
    hoverShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
    ...calendarStyles,
  };
  // ------------------------------

  const slides = useMemo(() => {
    const months = [];
    for (let offset = -2; offset <= 2; offset++) {
      let year = currentYear;
      let month = currentMonth + offset;
      if (month < 0) {
        month += 12;
        year -= 1;
      } else if (month > 11) {
        month -= 12;
        year += 1;
      }
      months.push({ year, month });
    }
    return months;
  }, [currentYear, currentMonth]);

  const onSlideChange = (swiper: any) => {
    if (isProgrammaticSlideRef.current) {
      isProgrammaticSlideRef.current = false;
      return;
    }
    
    const offset = swiper.activeIndex - 2;
    let newMonth = currentMonth + offset;
    let newYear = currentYear;
    
    if (newMonth < 0) {
      newMonth += 12;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth -= 12;
      newYear += 1;
    }
    
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    onMonthChange && onMonthChange(new Date(newYear, newMonth, 1));
    
    // Программно возвращаем к центральному слайду
    if (swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
      isProgrammaticSlideRef.current = true;
      swiperRef.current.slideTo(2, 300);
    }
  };

  const circleSize = 40;
  const gapSize = 6;
  const totalWidth = circleSize * 7 + gapSize * 6;

  const hasDream = (d: Date | null) => {
    if (!d) return false;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}.${month}.${year}`;
    return dreamDates.includes(dateStr);
  };

  return (
    <MotionBox
      key={`monthview-${currentYear}-${currentMonth}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      sx={{
        userSelect: 'none',
        maxWidth: 520,
        width: '100%',
        mx: 'auto',
        p: 2,
        borderRadius: 3,
        // Glassmorphism container
        background: alpha('#ffffff', 0.08),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${alpha('#ffffff', 0.15)}`,
        boxShadow: '0 8px 32px rgba(8, 12, 20, 0.35)',
      }}
    >
      <Swiper
        onSwiper={(s) => (swiperRef.current = s)}
        slidesPerView={1}
        centeredSlides
        loop={false}
        onSlideChange={onSlideChange}
        initialSlide={2}
        speed={300}
        resistanceRatio={0}
        style={{ padding: '8px 0' }}
      >
        {slides.map(({ year, month }, idx) => {
          const calendarDays = generateCalendarDays(year, month);
          return (
            <SwiperSlide key={`${year}-${month}`}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                  userSelect: 'none',
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ 
                    cursor: 'pointer', 
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      transition: 'transform 0.2s ease',
                    }
                  }}
                  onClick={() => {
                    if (onYearClick) onYearClick();
                    else if (onBackToWeek) onBackToWeek();
                    else if (onMonthChange) onMonthChange(new Date(year, 0, 1));
                  }}
                >
                  {year}
                </Typography>

                <Typography 
                  variant="h6" 
                  sx={{ 
                    flexGrow: 1, 
                    textAlign: 'center',
                    fontWeight: 700,
                    color: '#fff',
                    textShadow: '0 1px 6px rgba(0,0,0,0.25)',
                  }}
                >
                  {monthNames[month]}
                </Typography>

                <Box sx={{ width: '40px' }} />
              </Box>

              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                mb: 1, 
                px: 1,
                pb: 1
              }}>
                {daysShort.map(day => (
                  <Typography
                    key={day}
                    variant="caption"
                    sx={{ 
                      width: circleSize, 
                      textAlign: 'center', 
                      minWidth: circleSize,
                      color: alpha('#ffffff', 0.85),
                      fontWeight: 600,
                    }}
                  >
                    {day}
                  </Typography>
                ))}
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(7, 1fr)`,
                  gap: `${gapSize}px`,
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                {calendarDays.map((date, idx) => {
                  if (!date) {
                    return <Box key={`empty-${idx}`} sx={{ width: circleSize, height: circleSize }} />;
                  }
                  
                  const dreamExists = hasDream(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isCurrentMonth = date.getMonth() === month;
                  const isSelected =
                    selectedDate &&
                    date.getDate() === selectedDate.getDate() &&
                    date.getMonth() === selectedDate.getMonth() &&
                    date.getFullYear() === selectedDate.getFullYear();

                  // Определяем цвета и стили
                  const primaryMain = theme.palette.primary.main;
                  const dayBg = dreamExists 
                    ? primaryMain 
                    : isSelected 
                      ? mergedStyles.selectedGradient 
                      : 'transparent';
                  
                  const dayColor = isSelected || dreamExists 
                    ? '#fff' 
                    : isCurrentMonth 
                      ? mergedStyles.dayColor 
                      : mergedStyles.dayMutedColor;

                  return (
                    <Box
                      key={date.toISOString()}
                      sx={{
                        width: circleSize,
                        height: circleSize,
                        minWidth: circleSize,
                        minHeight: circleSize,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: isSelected || dreamExists ? 700 : 500,
                        userSelect: 'none',
                        cursor: onDateClick ? 'pointer' : 'default',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        fontSize: '0.95rem',
                        background: dayBg,
                        color: dayColor,
                        border: isToday
                          ? `2px solid ${alpha(primaryMain, 0.95)}`
                          : isSelected
                          ? `2px solid ${alpha('#ffffff', 0.9)}`
                          : `1px solid ${alpha('#ffffff', 0.15)}`,
                        boxShadow: isSelected
                          ? `0 6px 18px ${alpha(primaryMain, 0.25)}`
                          : '0 4px 10px rgba(2, 6, 23, 0.16)',
                        '&:hover': onDateClick
                          ? {
                              transform: 'translateY(-3px)',
                              boxShadow: `0 10px 24px ${alpha(primaryMain, 0.3)}`,
                              background: isSelected
                                ? `linear-gradient(180deg, ${alpha(primaryMain, 0.35)}, ${alpha(primaryMain, 0.25)})`
                                : dreamExists
                                ? primaryMain
                                : alpha('#ffffff', 0.12),
                            }
                          : {},
                      }}
                      onClick={() => onDateClick && onDateClick(date.toLocaleDateString('ru-RU'))}
                    >
                      {date.getDate()}
                      
                      {/* Индикатор сна */}
                      {dreamExists && !isSelected && (
                        <Box
                          sx={{
                            position: 'absolute',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#fff',
                            bottom: 4,
                            boxShadow: `0 0 4px ${alpha('#000', 0.3)}`,
                          }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </MotionBox>
  );
}