import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';

import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

const daysShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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
  eventDates: string[];
  selectedDate: Date;
  onDateClick?: (date: string) => void;
  onMonthYearClick?: () => void;
  onDateChange?: (date: Date) => void;
  hideMonthYearTitle?: boolean;
}

export function CalendarLine({
  eventDates,
  selectedDate,
  onDateClick,
  onMonthYearClick,
  onDateChange,
  hideMonthYearTitle = false,
}: CalendarLineProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const [currentMonday, setCurrentMonday] = useState(() => getMonday(selectedDate));
  useEffect(() => setCurrentMonday(getMonday(selectedDate)), [selectedDate]);

  const swiperRef = useRef<SwiperType | null>(null);
  const isProgrammaticSlideRef = useRef(false);
  const slideTimeoutRef = useRef<number | null>(null);

  // размеры
  const daySize = isMobile ? 36 : isTablet ? 40 : 44;
  const fontSize = isMobile ? 12 : isTablet ? 13 : 14;
  const dotSize = isMobile ? 4 : 6;
  const containerMaxWidth = isMobile ? 320 : isTablet ? 420 : 520;

  const slides = useMemo(() => {
    return [-2, -1, 0, 1, 2].map(offset => {
      const monday = addDays(currentMonday, offset * 7);
      return getWeekDates(monday);
    });
  }, [currentMonday]);

  const hasEvent = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}.${month}.${year}`;
    return eventDates.includes(dateStr);
  };

  const displayMonth = selectedDate.toLocaleString('ru-RU', { month: 'long' });
  const displayMonthCapitalized = displayMonth.charAt(0).toUpperCase() + displayMonth.slice(1);

  const onSlideChange = (swiper: any) => {
    if (isProgrammaticSlideRef.current) {
      isProgrammaticSlideRef.current = false;
      return;
    }

    const offset = swiper.activeIndex - 2;
    if (offset === 0) return;

    const newMonday = addDays(currentMonday, offset * 7);
    setCurrentMonday(newMonday);

    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
      slideTimeoutRef.current = null;
    }

    if (swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
      isProgrammaticSlideRef.current = true;
      swiperRef.current.slideTo(2, 320);

      slideTimeoutRef.current = window.setTimeout(() => {
        slideTimeoutRef.current = null;
        isProgrammaticSlideRef.current = false;
        onDateChange && onDateChange(newMonday);
      }, 320);
    } else {
      onDateChange && onDateChange(newMonday);
    }
  };

  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current);
        slideTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <Box
      sx={{
        userSelect: 'none',
        maxWidth: containerMaxWidth,
        mx: 'auto',
        px: isMobile ? 1 : 2,
        py: isMobile ? 0.5 : 1,
        borderRadius: isMobile ? 2 : 3,
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        color: '#fff',
      }}
    >
      {!hideMonthYearTitle && (
        <Typography
          variant={isMobile ? 'subtitle2' : 'subtitle1'}
          align="center"
          sx={{
            mb: isMobile ? 0.5 : 1,
            userSelect: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            color: alpha('#ffffff', 0.75),
            textShadow: '0 1px 6px rgba(0,0,0,0.25)',
          }}
          onClick={() => onMonthYearClick && onMonthYearClick()}
        >
          {displayMonthCapitalized}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, 1fr)`,
          gap: isMobile ? 0.5 : 1,
          mb: isMobile ? 1 : 2,
          px: isMobile ? 0.5 : 1,
        }}
      >
        {daysShort.map(day => (
          <Typography
            key={day}
            variant="caption"
            sx={{
              textAlign: 'center',
              color: alpha('#ffffff', 0.9),
              opacity: 0.9,
              fontSize: isMobile ? 11 : 12,
            }}
          >
            {day}
          </Typography>
        ))}
      </Box>

      <Box
        sx={{
          // небольшой safeguard: убираем визуальные артефакты у классов swiper
          '.swiper-slide, .swiper-slide-prev, .swiper-slide-next': {
            outline: 'none !important',
            boxShadow: 'none !important',
            border: 'none !important',
            background: 'transparent !important',
          },
        }}
      >
        <Swiper
          onSwiper={s => (swiperRef.current = s)}
          slidesPerView={1}
          centeredSlides
          loop={false}
          initialSlide={2}
          onSlideChange={onSlideChange}
          speed={320}
          resistanceRatio={0}
          allowTouchMove
          style={{ padding: isMobile ? '2px 0' : '4px 0' }}
        >
          {slides.map((weekDates, idx) => (
            <SwiperSlide key={idx} tabIndex={-1}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(7, 1fr)`,
                  gap: isMobile ? 0.5 : 1,
                  px: isMobile ? 0.5 : 1,
                }}
              >
                {weekDates.map(date => {
                  const eventExists = hasEvent(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isCurrentMonth = date.getMonth() === currentMonday.getMonth();
                  const isSelected = date.toDateString() === selectedDate.toDateString();

                  // ВАЖНО: показываем border только для центрального (idx === 2) слайда
                  const showBorder = idx === 2 && (isToday || isSelected);

                  const mutedText = alpha('#ffffff', 0.75);
                  const eventBg = 'rgba(255, 255, 255, 0.08)';
                  const selectedBg = `linear-gradient(180deg, ${alpha('#5878FF', 0.20)}, ${alpha('#8A5CFF', 0.12)})`;

                  return (
                    <Box
                      key={date.toISOString()}
                      onClick={() => onDateClick && onDateClick(date.toLocaleDateString('ru-RU'))}
                      sx={{
                        width: daySize,
                        height: daySize,
                        minWidth: daySize,
                        minHeight: daySize,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        cursor: onDateClick ? 'pointer' : 'default',
                        userSelect: 'none',
                        boxSizing: 'border-box',
                        transition: 'box-shadow 140ms ease, background-color 200ms ease, transform 140ms ease',
                        willChange: 'box-shadow, transform',
                        background: isSelected ? selectedBg : eventExists ? eventBg : 'transparent',
                        color: isSelected || eventExists ? '#fff' : (isCurrentMonth ? mutedText : alpha('#ffffff', 0.5)),
                        fontWeight: isSelected || eventExists ? 700 : 500,
                        border: showBorder
                          ? (isToday ? `1px solid ${alpha('#ffffff', 0.85)}` : `2px solid ${alpha('#ffffff', 0.9)}`)
                          : '1px solid transparent',
                        boxShadow: isSelected ? `0 8px 22px ${alpha('#5878FF', 0.18)}` : 'none',
                        '&:hover': {
                          // УБРАН translateY — чтобы кружок не залезал на строку с днями
                          transform: 'none',
                          boxShadow: isSelected ? `0 12px 28px ${alpha('#5878FF', 0.18)}` : `0 6px 14px ${alpha('#000', 0.06)}`,
                          background: isSelected ? `linear-gradient(180deg, ${alpha('#5878FF', 0.28)}, ${alpha('#8A5CFF', 0.16)})` : eventExists ? eventBg : alpha('#ffffff', 0.06),
                        },
                        margin: '0 auto',
                      }}
                      aria-label={`День ${date.getDate()}`}
                      role={onDateClick ? 'button' : 'presentation'}
                    >
                      <Box component="span" sx={{ lineHeight: 1, fontSize: fontSize }}>
                        {date.getDate()}
                      </Box>

                      <Box
                        sx={{
                          width: dotSize,
                          height: dotSize,
                          borderRadius: '50%',
                          mt: 0.5,
                          background: eventExists && !isSelected ? alpha('#ffffff', 0.85) : 'transparent',
                          opacity: eventExists && !isSelected ? 1 : 0,
                          transition: 'opacity 180ms ease, transform 180ms ease',
                          transform: eventExists && !isSelected ? 'translateY(0)' : 'translateY(-2px)',
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </SwiperSlide>
          ))}
        </Swiper>
      </Box>
    </Box>
  );
}