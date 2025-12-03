import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { alpha } from '@mui/material/styles';
import type { CalendarStyles } from './MonthView'; // убедитесь, что путь корректен

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface DayViewProps {
  dreamDates: string[]; // формат: "dd.MM.yyyy"
  selectedDate: Date;
  onDateClick?: (date: string) => void;
  onDateChange?: (date: Date) => void;
  onBackToWeek?: () => void;
  // для единообразия стилей
  calendarStyles?: CalendarStyles;
}

const MotionBox = motion.create(Box);

export function DayView({
  dreamDates,
  selectedDate,
  onDateClick,
  onDateChange,
  onBackToWeek,
  calendarStyles = {},
}: DayViewProps) {
  const theme = useTheme();
  const [currentDay, setCurrentDay] = useState<Date>(selectedDate);

  useEffect(() => {
    setCurrentDay(selectedDate);
  }, [selectedDate]);

  const swiperRef = useRef<SwiperType | null>(null);
  const isProgrammaticSlideRef = useRef(false);

  // merge styles (по аналогии с остальными компонентами)
  const mergedStyles: CalendarStyles = {
    containerBg: alpha('#ffffff', 0.06),
    tileBg: 'transparent',
    dayColor: '#ffffff',
    dayMutedColor: alpha('#ffffff', 0.6),
    borderColor: alpha('#ffffff', 0.12),
    selectedGradient: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.32)}, ${alpha(
      theme.palette.primary.main,
      0.18
    )})`,
    hoverShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.16)}`,
    ...calendarStyles,
  };

  const slides = useMemo(() => {
    return [-2, -1, 0, 1, 2].map((offset) => addDays(currentDay, offset));
  }, [currentDay]);

  const hasDream = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}.${month}.${year}`;
    return dreamDates.includes(dateStr);
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  const onSlideChange = (swiper: any) => {
    if (isProgrammaticSlideRef.current) {
      isProgrammaticSlideRef.current = false;
      return;
    }

    const offset = swiper.activeIndex - 2;
    if (offset === 0) return;

    const newDay = addDays(currentDay, offset);
    setCurrentDay(newDay);
    onDateChange && onDateChange(newDay);

    // плавно возвращаемся к центральному слайду (чтобы создать эффект "скользящей бесконечной полосы")
    if (swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
      isProgrammaticSlideRef.current = true;
      swiperRef.current.slideTo(2, 320);
    }
  };

  const circleSize = 110;

  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.36, ease: 'easeInOut' }}
      sx={{
        userSelect: 'none',
        maxWidth: 360,
        width: '100%',
        mx: 'auto',
        py: 2,
        px: 2,
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        // glass container
        background: mergedStyles.containerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${mergedStyles.borderColor}`,
        boxShadow: '0 10px 30px rgba(8,12,20,0.32)',
        color: mergedStyles.dayColor,
      }}
    >
      <Typography
        variant="subtitle1"
        align="center"
        sx={{
          mb: 0,
          userSelect: 'none',
          cursor: onBackToWeek ? 'pointer' : 'default',
          color: '#fff',
          fontWeight: 600,
          textTransform: 'capitalize',
        }}
        onClick={() => onBackToWeek && onBackToWeek()}
        title={onBackToWeek ? 'Вернуться к неделе' : undefined}
      >
        {currentDay.toLocaleDateString('ru-RU', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </Typography>

      <Swiper
        onSwiper={(s) => (swiperRef.current = s)}
        slidesPerView={1}
        centeredSlides
        loop={false}
        initialSlide={2}
        onSlideChange={onSlideChange}
        speed={320}
        resistanceRatio={0}
        style={{ width: '100%', padding: '12px 0' }}
      >
        {slides.map((date) => {
          const dreamExists = hasDream(date);
          const today = isToday(date);
          const isSelected = date.toDateString() === selectedDate.toDateString();

          const primaryMain = theme.palette.primary.main;
          const bgForDay = isSelected
            ? mergedStyles.selectedGradient
            : dreamExists
            ? primaryMain
            : 'transparent';
          const colorForDay = isSelected || dreamExists ? '#fff' : mergedStyles.dayColor;

          return (
            <SwiperSlide key={date.toISOString()}>
              <Box
                onClick={() => onDateClick && onDateClick(date.toLocaleDateString('ru-RU'))}
                role={onDateClick ? 'button' : 'presentation'}
                aria-label={`День ${date.getDate()}`}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  sx={{
                    width: circleSize,
                    height: circleSize,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    boxSizing: 'border-box',
                    fontSize: '1.6rem',
                    fontWeight: isSelected || dreamExists ? 700 : 600,
                    color: colorForDay,
                    background: bgForDay,
                    border: today
                      ? `2px solid ${alpha(primaryMain, 0.95)}`
                      : isSelected
                      ? `2px solid ${alpha('#ffffff', 0.9)}`
                      : `1px solid ${alpha('#ffffff', 0.10)}`,
                    boxShadow: isSelected
                      ? `0 10px 30px ${alpha(primaryMain, 0.22)}`
                      : '0 6px 18px rgba(2,6,23,0.14)',
                    transition: 'transform 200ms ease, box-shadow 200ms ease, background 200ms ease',
                    '&:hover': onDateClick
                      ? {
                          transform: 'translateY(-6px)',
                          boxShadow: `0 18px 40px ${alpha(primaryMain, 0.18)}`,
                        }
                      : {},
                    cursor: onDateClick ? 'pointer' : 'default',
                  }}
                >
                  {date.getDate()}

                  {/* Индикатор сна */}
                  {dreamExists && !isSelected && (
                    <Box
                      component="span"
                      sx={{
                        position: 'absolute',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#fff',
                        bottom: 10,
                        boxShadow: `0 0 6px ${alpha('#000', 0.24)}`,
                      }}
                    />
                  )}
                </Box>
              </Box>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </MotionBox>
  );
}