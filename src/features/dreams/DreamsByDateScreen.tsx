// src/features/daily/DreamsByDateScreen.tsx
import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Paper,
  useTheme,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { useParams, useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import type { CalendarStyles } from 'src/features/profile/calendar/MonthView';
import type { Dream as ApiDream } from 'src/utils/api'; // <-- импорт типа из API

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const dayNames = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
  'Четверг', 'Пятница', 'Суббота'
];

interface DreamsByDateScreenProps {
  date?: string; // формат "dd.MM.yyyy"
  onBack?: () => void;
  usePaper?: boolean;
  dreams?: ApiDream[]; // <-- используем тип из API
  calendarStyles?: CalendarStyles;
}

function DateHeader({ date, onBack }: { date: Date; onBack?: () => void }) {
  const navigate = useNavigate();
  const theme = useTheme();

  const monthName = monthNames[date.getMonth()];
  const dayName = dayNames[date.getDay()];
  const dayNumber = date.getDate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <Box
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        width: 'fit-content',
        color: theme.palette.primary.main,
        display: 'inline-block',
        mb: 2,
        '&:hover': { opacity: 0.9, transform: 'translateY(-2px)' },
        transition: 'transform 160ms ease, opacity 160ms ease',
      }}
      onClick={handleBack}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleBack();
      }}
      aria-label="Назад"
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <ArrowBackIosNewIcon fontSize="small" sx={{ mr: 0.5 }} />
        <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: 'inherit' }}>
          {monthName}
        </Typography>
      </Box>
      <Typography variant="subtitle1" sx={{ ml: 3, color: alpha('#ffffff', 0.95) }}>
        {dayName} — {dayNumber}
      </Typography>
    </Box>
  );
}

export function DreamsByDateScreen({
  date: propDate,
  onBack,
  usePaper = true,
  dreams = [],
  calendarStyles = {},
}: DreamsByDateScreenProps) {
  const params = useParams<{ date: string }>();
  const dateStr = propDate || params.date;
  const navigate = useNavigate();
  const theme = useTheme();

  const mergedStyles: CalendarStyles = {
    containerBg: alpha('#ffffff', 0.06),
    tileBg: alpha('#ffffff', 0.02),
    dayColor: '#ffffff',
    dayMutedColor: alpha('#ffffff', 0.6),
    borderColor: alpha('#ffffff', 0.12),
    selectedGradient: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.32)}, ${alpha(
      theme.palette.primary.main,
      0.18
    )})`,
    hoverShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.14)}`,
    ...calendarStyles,
  };

  const dateObj = useMemo(() => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('.');
    if (parts.length !== 3) return new Date();
    const [day, month, year] = parts;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }, [dateStr]);

  return (
    <Box
      component={usePaper ? Paper : 'div'}
      elevation={usePaper ? 6 : undefined}
      sx={{
        p: { xs: 2, sm: 3 },
        mt: usePaper ? 2 : 0,
        maxWidth: 840,
        width: '100%',
        mx: 'auto',
        borderRadius: 3,
        ...(usePaper
          ? {
              background: mergedStyles.containerBg,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: `1px solid ${mergedStyles.borderColor}`,
              boxShadow: '0 10px 30px rgba(8,12,20,0.32)',
              color: mergedStyles.dayColor,
            }
          : {
              background: 'transparent',
              color: mergedStyles.dayColor,
            }),
      }}
    >
      <DateHeader date={dateObj} onBack={onBack} />

      {dreams.length === 0 ? (
        <Typography sx={{ color: alpha('#ffffff', 0.9) }}>Снов за эту дату нет.</Typography>
      ) : (
        <List disablePadding>
          {dreams.map((dream) => {
            const titleToShow =
              typeof dream.title === 'string' && dream.title.trim() !== ''
                ? dream.title
                : dream.dreamText;

            return (
              <ListItem
                key={dream.id}
                onClick={() => navigate(`/dreams/${dream.id}`)}
                role="button"
                aria-label={`Открыть сон ${dream.title ?? dream.dreamText}`}
                sx={{
                  textAlign: 'left',
                  borderRadius: 2,
                  mb: 1.5,
                  p: { xs: 1.25, sm: 1.75 },
                  position: 'relative',
                  cursor: 'pointer',
                  background: usePaper ? alpha('#ffffff', 0.03) : alpha('#ffffff', 0.02),
                  border: `1px solid ${alpha('#ffffff', 0.04)}`,
                  boxShadow: '0 4px 10px rgba(2,6,23,0.12)',
                  transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 12px 36px rgba(2,6,23,0.18)',
                    background: usePaper ? alpha('#ffffff', 0.06) : alpha('#ffffff', 0.04),
                  },
                  minHeight: 56,
                }}
              >
                <ListItemText
                  primary={
                    <Typography
                      variant="body1"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: { xs: 1, sm: 2 },
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'normal',
                        fontWeight: dream.title ? 700 : 500,
                        color: alpha('#ffffff', 0.98),
                      }}
                    >
                      {titleToShow}
                    </Typography>
                  }
                  secondary={
                    <Typography
                      variant="caption"
                      sx={{ color: alpha('#ffffff', 0.7), mt: 0.5, display: 'block' }}
                    >
                      {new Date(dream.date).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
}