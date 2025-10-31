import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';

import { Box, Typography, useTheme } from '@mui/material';

const daysShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

function getMonday(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekDates(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

interface CalendarLineProps {
  dreamDates: string[];
  selectedDate: Date;
  onDateClick?: (date: string) => void;
  onMonthYearClick?: () => void;
  onDateChange?: (date: Date) => void;
  hideMonthYearTitle?: boolean;
}

export function CalendarLine({
  dreamDates,
  selectedDate,
  onDateClick,
  onMonthYearClick,
  onDateChange,
  hideMonthYearTitle = false,
}: CalendarLineProps) {
  const theme = useTheme();
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(selectedDate));

  useEffect(() => {
    setCurrentMonday(getMonday(selectedDate));
  }, [selectedDate]);

  const isProgrammaticSlide = useRef(false);

  const slides = useMemo(() => {
    return [-2, -1, 0, 1, 2].map(offset => {
      const monday = addDays(currentMonday, offset * 7);
      return getWeekDates(monday);
    });
  }, [currentMonday]);

  const onSlideChange = (swiper: any) => {
    if (isProgrammaticSlide.current) {
      isProgrammaticSlide.current = false;
      return;
    }
    const offset = swiper.activeIndex - 2;
    const newMonday = addDays(currentMonday, offset * 7);
    setCurrentMonday(newMonday);
    onDateChange && onDateChange(newMonday);
    isProgrammaticSlide.current = true;
    swiper.slideTo(2, 0);
  };

  const hasDream = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}.${month}.${year}`;
    return dreamDates.includes(dateStr);
  };

  const displayMonth = monthNames[currentMonday.getMonth()];
  const displayYear = currentMonday.getFullYear();

  return (
    <Box sx={{ userSelect: 'none', maxWidth: 320, mx: 'auto' }}>
      {!hideMonthYearTitle && (
        <Typography
          variant="h6"
          align="center"
          sx={{ mb: 1, userSelect: 'none', cursor: 'pointer' }}
          onClick={() => onMonthYearClick && onMonthYearClick()}
        >
          {displayMonth} {displayYear}
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        {daysShort.map(day => (
          <Typography key={day} variant="caption" sx={{ width: 36, textAlign: 'center' }}>
            {day}
          </Typography>
        ))}
      </Box>

      <Swiper
        slidesPerView={1}
        centeredSlides
        loop
        onSlideChange={onSlideChange}
        initialSlide={2}
      >
        {slides.map((weekDates, idx) => (
          <SwiperSlide key={idx}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              {weekDates.map(date => {
                const dreamExists = hasDream(date);
                const isToday = date.toDateString() === new Date().toDateString();
                const isCurrentMonth = date.getMonth() === currentMonday.getMonth();

                return (
                  <Box
                    key={date.toISOString()}
                    sx={{
                      width: 36,
                      height: 36,
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
                    }}
                    onClick={() => onDateClick && onDateClick(date.toLocaleDateString('ru-RU'))}
                  >
                    {date.getDate()}
                  </Box>
                );
              })}
            </Box>
          </SwiperSlide>
        ))}
      </Swiper>
    </Box>
  );
}