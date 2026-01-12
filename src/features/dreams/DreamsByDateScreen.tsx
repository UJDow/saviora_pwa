// src/dreams/DreamsByDateScreen.tsx
import { useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  Paper,
  useTheme,
  Button,
  Stack,
  Chip,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import type { CalendarStyles } from 'src/features/profile/calendar/MonthView';
import type { Dream as ApiDream, DailyConvo as ApiDailyConvo } from 'src/utils/api';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';

type NormalizedDream = Omit<ApiDream, 'date'> & { date: number };
type NormalizedDailyConvo = Omit<ApiDailyConvo, 'date'> & { date: number };

interface DreamsByDateScreenProps {
  date?: string;
  onBack?: () => void;
  usePaper?: boolean;
  dreams?: NormalizedDream[];
  dailyConvos?: NormalizedDailyConvo[];
  calendarStyles?: CalendarStyles;
  // Добавляем эти два:
  onNotify?: (message: string, severity: 'success' | 'error') => void;
  onRequestAddDream?: (dateStr: string) => void;
}

type TimelineItem =
  | {
      kind: 'dream';
      id: string;
      timestamp: number;
      title?: string;
      description?: string;
    }
  | {
      kind: 'daily';
      id: string;
      timestamp: number;
      title?: string;
      description?: string;
    };

const pastelGlassTokens = {
  dream: {
    chipBg: 'linear-gradient(135deg, rgba(255, 243, 204, 0.25), rgba(255, 224, 230, 0.22))',
    chipBorder: 'rgba(255, 243, 204, 0.3)',
    chipColor: '#ffffff', // белый текст
    cardBg: 'rgba(255, 243, 204, 0.15)',
    cardBorder: 'rgba(255, 224, 230, 0.25)',
    cardHoverBg: 'rgba(255, 243, 204, 0.22)',
    cardShadow: 'none',
  },
  daily: {
    chipBg: 'linear-gradient(135deg, rgba(204, 229, 255, 0.25), rgba(204, 255, 229, 0.22))',
    chipBorder: 'rgba(204, 229, 255, 0.3)',
    chipColor: '#ffffff', // белый текст
    cardBg: 'rgba(204, 229, 255, 0.15)',
    cardBorder: 'rgba(204, 255, 229, 0.25)',
    cardHoverBg: 'rgba(204, 229, 255, 0.22)',
    cardShadow: 'none',
  },
} as const;

export function DreamsByDateScreen({
  date: propDate,
  onBack,
  usePaper = true,
  dreams = [],
  dailyConvos = [],
  calendarStyles = {},
  onNotify,
  onRequestAddDream,
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
      0.18,
    )})`,
    hoverShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.14)}`,
    ...calendarStyles,
  };

  const readableDate = useMemo(() => {
    if (!dateStr) return '';
    const parsed = dateStr.split('.');
    if (parsed.length !== 3) return '';
    const [day, month, year] = parsed;
    try {
      return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }, [dateStr]);

  const items = useMemo<TimelineItem[]>(() => {
    const asMs = (value: number | string): number => {
      if (typeof value === 'number') {
        return value < 1e12 ? value * 1000 : value;
      }
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        return numeric < 1e12 ? numeric * 1000 : numeric;
      }
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? Date.now() : parsed;
    };

    const mappedDreams: TimelineItem[] = (dreams ?? []).map((dream) => {
      const title = dream.title?.trim() ?? '';
      const body = dream.dreamText?.trim() ?? '';

      return {
        kind: 'dream',
        id: String(dream.id),
        timestamp: asMs(dream.date),
        title,
        description: body,
      };
    });

    const mappedDaily: TimelineItem[] = (dailyConvos ?? []).map((convo) => {
      const title = convo.title?.trim() ?? '';
      const notes = convo.notes?.trim() ?? '';

      return {
        kind: 'daily',
        id: String(convo.id),
        timestamp: asMs(convo.date),
        title,
        description: notes,
      };
    });

    return [...mappedDreams, ...mappedDaily].sort((a, b) => b.timestamp - a.timestamp);
  }, [dreams, dailyConvos]);

  const cardSx = useMemo(
    () =>
      usePaper
        ? {
            background: mergedStyles.containerBg,
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: `1px solid ${mergedStyles.borderColor}`,
            boxShadow: '0 10px 30px rgba(8,12,20,0.26)',
            color: mergedStyles.dayColor,
          }
        : {
            background: 'transparent',
            color: mergedStyles.dayColor,
          },
    [usePaper, mergedStyles],
  );

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
        ...cardSx,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: items.length ? 1.5 : 0.5 }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: alpha('#ffffff', 0.95),
            letterSpacing: 0.2,
          }}
        >
          Выбранные события
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          {readableDate && (
            <Chip
              label={readableDate}
              size="small"
              sx={{
                borderColor: alpha('#ffffff', 0.22),
                background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(200,220,255,0.16))',
                color: alpha('#ffffff', 0.88),
                backdropFilter: 'blur(10px)',
                '& .MuiChip-label': { px: 1.5, fontWeight: 500 },
              }}
              variant="outlined"
            />
          )}

          {onBack && (
            <Button
              onClick={onBack}
              variant="text"
              size="small"
              sx={{
                color: alpha('#ffffff', 0.9),
                textTransform: 'none',
                fontWeight: 500,
                backdropFilter: 'blur(6px)',
                borderRadius: 1.5,
                px: 1.5,
                py: 0.5,
                background: 'linear-gradient(135deg, rgba(120,140,255,0.08), rgba(150,110,250,0.08))',
                '&:hover': {
                  background: 'linear-gradient(135deg, rgba(120,140,255,0.14), rgba(150,110,250,0.14))',
                },
              }}
            >
              К календарю
            </Button>
          )}
        </Stack>
      </Stack>

      {!items.length ? (
  <Box
    sx={{
      py: 4,
      px: 2,
      borderRadius: 2,
      border: `1px dashed ${alpha('#ffffff', 0.18)}`,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(210,195,255,0.06))',
      backdropFilter: 'blur(12px)',
      textAlign: 'center',
    }}
  >
    <Typography variant="body1" sx={{ color: alpha('#ffffff', 0.82), fontWeight: 500 }}>
      В этот день ничего не записано.
    </Typography>

    <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.6), mt: 0.5, mb: 2 }}>
      Создайте сон или тему беседы, чтобы увидеть их здесь.
    </Typography>

    <Button
      variant="contained"
      startIcon={<NightlightRoundIcon />}
      onClick={() => {
        if (!dateStr) return;

        const [day, month, year] = dateStr.split('.').map(Number);
        const targetDate = new Date(year, month - 1, day);
        targetDate.setHours(0, 0, 0, 0);

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (targetDate.getTime() > now.getTime()) {
          // ✅ стеклянная нотификация от родителя
          onNotify?.('Будущее ещё не наступило… 🌌', 'error');
          return;
        }

        // ✅ просим родителя открыть инпут
        onRequestAddDream?.(dateStr);
      }}
      sx={{
        mt: 1,
        textTransform: 'none',
        fontWeight: 600,
        background: 'linear-gradient(135deg, rgba(120,140,255,0.85), rgba(150,110,250,0.85))',
        color: '#fff',
        px: 3,
        py: 1,
        borderRadius: 2,
        '&:hover': {
          background: 'linear-gradient(135deg, rgba(120,140,255,0.95), rgba(150,110,250,0.95))',
        },
      }}
    >
      Добавить сновидение
    </Button>
  </Box>
) : (
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {items.map((item) => {
            const tokens = pastelGlassTokens[item.kind];
            const targetRoute = item.kind === 'dream' ? `/dreams/${item.id}` : `/daily/${item.id}`;
            const label = item.kind === 'dream' ? 'Сновидение' : 'Беседа';

            return (
              <ListItem
  key={`${item.kind}-${item.id}`}
  onClick={() => navigate(targetRoute)}
  sx={{
    borderRadius: 3,
    px: { xs: 1.45, sm: 1.85 },
    py: { xs: 1.4, sm: 1.65 },
    background: tokens.cardBg,
    border: `1px solid ${tokens.cardBorder}`,
    // Добавляем мягкое свечение по краям плитки
    boxShadow: item.kind === 'dream'
      ? '0 0 20px 6px rgba(235, 165, 200, 0.10)'
      : '0 0 20px 6px rgba(160, 185, 230, 0.10)',
    cursor: 'pointer',
    transition: 'transform 180ms ease, background 160ms ease, box-shadow 180ms ease',
    display: 'block',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    '&:hover': {
      transform: 'translateY(-3px)',
      background: tokens.cardHoverBg,
      // Усиливаем свечение на hover
      boxShadow: item.kind === 'dream'
        ? '0 0 28px 10px rgba(235, 165, 200, 0.14)'
        : '0 0 28px 10px rgba(160, 185, 230, 0.14)',
    },
    '&:focus-visible': {
      outline: '2px solid rgba(255, 255, 255, 0.6)',
      outlineOffset: 2,
    },
  }}
>
                <Stack spacing={1.2}>
                  <Chip
  label={label}
  size="small"
  sx={{
    fontWeight: 600,
    letterSpacing: 0.3,
    border: `1px solid ${tokens.chipBorder}`,
    background: tokens.chipBg,
    color: '#ffffff', // белый текст
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    width: 'fit-content',
    borderRadius: 2.5,
    boxShadow: 'inset 0 -6px 18px rgba(0,0,0,0.06)',
    '& .MuiChip-label': {
      px: 2.2,
      py: 0.4,
      fontSize: 13,
    },
    '&:hover': {
      transform: 'translateY(-1px)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.095), rgba(255,255,255,0.045))',
    },
  }}
/>
                  {item.title && (
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        color: alpha('#ffffff', 0.94),
                        lineHeight: 1.42,
                      }}
                    >
                      {item.title}
                    </Typography>
                  )}

                  {item.description && item.description !== '—' && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: alpha('#ffffff', 0.88),
                        lineHeight: 1.55,
                        display: '-webkit-box',
                        WebkitLineClamp: { xs: 2, sm: 3 },
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.description}
                    </Typography>
                  )}
                </Stack>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
}