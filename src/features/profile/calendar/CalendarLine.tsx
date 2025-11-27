import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';

import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';

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
  dreamDates: string[]; // формат: "dd.MM.yyyy"
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

  const swiperRef = useRef<SwiperType | null>(null);
  const isProgrammaticSlideRef = useRef(false);

  const slides = useMemo(() => {
    return [-2, -1, 0, 1, 2].map(offset => {
      const monday = addDays(currentMonday, offset * 7);
      return getWeekDates(monday);
    });
  }, [currentMonday]);

  const hasDream = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}.${month}.${year}`;
    return dreamDates.includes(dateStr);
  };

  const displayMonth = monthNames[currentMonday.getMonth()];
  // const displayYear = currentMonday.getFullYear(); // год не нужен по требованию

  const onSlideChange = (swiper: any) => {
    if (isProgrammaticSlideRef.current) {
      isProgrammaticSlideRef.current = false;
      return;
    }

    const offset = swiper.activeIndex - 2;
    if (offset === 0) return;

    const newMonday = addDays(currentMonday, offset * 7);

    setCurrentMonday(newMonday);
    onDateChange && onDateChange(newMonday);

    if (swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
      isProgrammaticSlideRef.current = true;
      swiperRef.current.slideTo(2, 320);
    }
  };

  return (
    <Box
      sx={{
        userSelect: 'none',
        maxWidth: 520,
        mx: 'auto',
        px: 2,
        py: 1,
        borderRadius: 3,
        // Убираем видимый glass контейнер — делаем прозрачным, без бордера/теней
        background: 'transparent',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        border: 'none',
        boxShadow: 'none',
        color: '#fff',
      }}
    >
      {!hideMonthYearTitle && (
        <Typography
          variant="subtitle1"
          align="center"
          sx={{
            mb: 1,
            userSelect: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 1px 6px rgba(0,0,0,0.25)',
            '&:hover': {
              transform: 'translateY(-2px)',
              transition: 'transform 160ms ease',
            },
          }}
          onClick={() => onMonthYearClick && onMonthYearClick()}
        >
          {displayMonth} {/* теперь только название месяца, без года */}
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        {daysShort.map(day => (
          <Typography
            key={day}
            variant="caption"
            sx={{
              width: 44,
              textAlign: 'center',
              color: alpha('#ffffff', 0.9),
              opacity: 0.9,
            }}
          >
            {day}
          </Typography>
        ))}
      </Box>

      <Swiper
        onSwiper={(s) => (swiperRef.current = s)}
        slidesPerView={1}
        centeredSlides
        loop={false}
        initialSlide={2}
        onSlideChange={onSlideChange}
        speed={320}
        resistanceRatio={0}
        allowTouchMove={true}
        style={{ padding: '4px 0' }}
      >
        {slides.map((weekDates, idx) => (
          <SwiperSlide key={idx}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
              {weekDates.map(date => {
                const dreamExists = hasDream(date);
                const isToday = date.toDateString() === new Date().toDateString();
                const isCurrentMonth = date.getMonth() === currentMonday.getMonth();
                const isSelected = date.toDateString() === selectedDate.toDateString();

                const mutedText = alpha('#ffffff', 0.75);

                // Новый визуал:
                // - круглая карточка (borderRadius: '50%')
                // - если есть сон -> мягкий светлый фон (не синий)
                // - если выбран -> яркий акцентный градиент + белая обводка
                const dreamBg = 'rgba(255, 255, 255, 0.08)'; // мягкий светлый тон для дат с сном
                const selectedBg = `linear-gradient(180deg, ${alpha('#5878FF', 0.20)}, ${alpha('#8A5CFF', 0.12)})`;

                return (
                  <Box
                    key={date.toISOString()}
                    onClick={() => onDateClick && onDateClick(date.toLocaleDateString('ru-RU'))}
                    sx={{
                      width: 44,
                      height: 44,
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: '50%', // круг
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      cursor: onDateClick ? 'pointer' : 'default',
                      userSelect: 'none',
                      boxSizing: 'border-box',
                      transition: 'transform 140ms ease, box-shadow 140ms ease, background-color 200ms ease',
                      background: isSelected
                        ? selectedBg
                        : dreamExists
                          ? dreamBg
                          : 'transparent',
                      color: isSelected || dreamExists ? '#fff' : (isCurrentMonth ? mutedText : alpha('#ffffff', 0.5)),
                      fontWeight: isSelected || dreamExists ? 700 : 500,
                      border: isToday
                        ? `2px solid ${alpha('#5878FF', 0.95)}`
                        : isSelected
                          ? `2px solid ${alpha('#ffffff', 0.9)}`
                          : '1px solid transparent',
                      boxShadow: isSelected
                        ? `0 8px 22px ${alpha('#5878FF', 0.18)}`
                        : 'none',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: isSelected
                          ? `0 12px 28px ${alpha('#5878FF', 0.18)}`
                          : `0 6px 14px ${alpha('#000', 0.06)}`,
                        background: isSelected
                          ? `linear-gradient(180deg, ${alpha('#5878FF', 0.28)}, ${alpha('#8A5CFF', 0.16)})`
                          : dreamExists
                            ? dreamBg
                            : alpha('#ffffff', 0.06),
                      },
                    }}
                    aria-label={`День ${date.getDate()}`}
                    role={onDateClick ? 'button' : 'presentation'}
                  >
                    <Box component="span" sx={{ lineHeight: 1, fontSize: 14 }}>
                      {date.getDate()}
                    </Box>

                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        mt: 0.5,
                        background: dreamExists && !isSelected ? alpha('#ffffff', 0.85) : 'transparent',
                        opacity: dreamExists && !isSelected ? 1 : 0,
                        transition: 'opacity 180ms ease, transform 180ms ease',
                        transform: dreamExists && !isSelected ? 'translateY(0)' : 'translateY(-2px)',
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
  );
}