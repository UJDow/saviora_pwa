import React, { useState, useMemo, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

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
}

const MotionBox = motion(Box);

export function MonthView({
  dreamDates,
  selectedDate,
  onDateClick,
  onMonthChange,
  onYearClick,
  onBackToWeek,
  onWeekClick,
  onDateChange,
}: MonthViewProps) {
  const theme = useTheme();
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());

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

  const isProgrammaticSlide = useRef(false);

  const onSlideChange = (swiper: any) => {
    if (isProgrammaticSlide.current) {
      isProgrammaticSlide.current = false;
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
    isProgrammaticSlide.current = true;
    swiper.slideTo(2, 0);
  };

  const circleSize = 36;
  const gapSize = 8;
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
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      sx={{ userSelect: 'none', maxWidth: totalWidth, width: '100%', mx: 'auto' }}
    >
      <Swiper
        slidesPerView={1}
        centeredSlides
        loop
        onSlideChange={onSlideChange}
        initialSlide={2}
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
                  mb: 1,
                  userSelect: 'none',
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ cursor: 'pointer', color: theme.palette.primary.main }}
                  onClick={() => {
                    if (onYearClick) onYearClick();
                    else if (onBackToWeek) onBackToWeek();
                    else if (onMonthChange) onMonthChange(new Date(year, 0, 1));
                  }}
                >
                  {year}
                </Typography>

                <Typography variant="h6" sx={{ flexGrow: 1, textAlign: 'center' }}>
                  {monthNames[month]}
                </Typography>

                <Box sx={{ width: '40px' }} />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, px: '4px' }}>
                {daysShort.map(day => (
                  <Typography
                    key={day}
                    variant="caption"
                    sx={{ width: circleSize, textAlign: 'center', minWidth: 0 }}
                  >
                    {day}
                  </Typography>
                ))}
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(7, ${circleSize}px)`,
                  gridAutoRows: `${circleSize}px`,
                  gap: `${gapSize}px`,
                  width: totalWidth,
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

                  return (
                    <Box
                      key={date.toISOString()}
                      sx={{
                        width: circleSize,
                        height: circleSize,
                        borderRadius: '50%',
                        border: isToday
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
                        cursor: onDateClick ? 'pointer' : 'default',
                        boxSizing: 'border-box',
                        transition: 'background-color 0.3s, color 0.3s, border-color 0.3s',
                        fontSize: '0.875rem',
                        lineHeight: `${circleSize}px`,
                      }}
                      onClick={() => onDateClick && onDateClick(date.toLocaleDateString('ru-RU'))}
                    >
                      {date.getDate()}
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