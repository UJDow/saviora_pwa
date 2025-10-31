import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';
import { Box, Typography, useTheme } from '@mui/material';

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface DayViewProps {
  dreamDates: string[];
  selectedDate: Date;
  onDateClick?: (date: string) => void;
  onDateChange?: (date: Date) => void;
  onBackToWeek?: () => void;
}

export function DayView({ dreamDates, selectedDate, onDateClick, onDateChange, onBackToWeek }: DayViewProps) {
  const theme = useTheme();
  const [currentDay, setCurrentDay] = useState(selectedDate);

  useEffect(() => {
    setCurrentDay(selectedDate);
  }, [selectedDate]);

  const isProgrammaticSlide = useRef(false);

  const slides = useMemo(() => {
    return [-2, -1, 0, 1, 2].map(offset => addDays(currentDay, offset));
  }, [currentDay]);

  const onSlideChange = (swiper: any) => {
    if (isProgrammaticSlide.current) {
      isProgrammaticSlide.current = false;
      return;
    }
    const offset = swiper.activeIndex - 2;
    const newDay = addDays(currentDay, offset);
    setCurrentDay(newDay);
    onDateChange && onDateChange(newDay);
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

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  return (
    <Box sx={{ userSelect: 'none', maxWidth: 120, mx: 'auto' }}>
      <Typography
        variant="h6"
        align="center"
        sx={{ mb: 1, userSelect: 'none', cursor: 'pointer' }}
        onClick={() => onBackToWeek && onBackToWeek()}
        title="Вернуться к неделе"
      >
        {currentDay.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Typography>

      <Swiper
        slidesPerView={1}
        centeredSlides
        loop
        onSlideChange={onSlideChange}
        initialSlide={2}
      >
        {slides.map((date) => {
          const dreamExists = hasDream(date);
          const today = isToday(date);

          return (
            <SwiperSlide key={date.toISOString()}>
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  border: today
                    ? `2px solid ${theme.palette.primary.main}`
                    : dreamExists
                    ? `2px solid ${theme.palette.primary.main}`
                    : 'none',
                  backgroundColor: dreamExists ? theme.palette.primary.main : 'transparent',
                  color: dreamExists ? '#fff' : theme.palette.text.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: dreamExists ? 'bold' : 'normal',
                  userSelect: 'none',
                  cursor: onDateClick ? 'pointer' : 'default',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.3s, color 0.3s, border-color 0.3s',
                  fontSize: '1.25rem',
                  lineHeight: '100px',
                }}
                onClick={() => onDateClick && onDateClick(date.toLocaleDateString('ru-RU'))}
              >
                {date.getDate()}
              </Box>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </Box>
  );
}