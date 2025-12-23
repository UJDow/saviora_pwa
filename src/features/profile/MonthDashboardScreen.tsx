import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  LinearProgress,
  Card,
  CardContent,
  IconButton,
  Skeleton,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Collapse,
  Modal,
} from '@mui/material';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import ChatIcon from '@mui/icons-material/Chat';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import PaletteIcon from '@mui/icons-material/Palette';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlagIcon from '@mui/icons-material/Flag';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LockIcon from '@mui/icons-material/Lock';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';


import { useNavigate } from 'react-router-dom';
import { useDreams } from '../dreams/useDreams';

import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';


import {
  request,
  getGoals,
  getGoalsTimeline,
  createGoal,
  addGoalEvent,
  deleteGoal,
  markBadgesAsSeen,
  setCurrentGoal,
} from 'src/utils/api';
import type {
  GoalFromServer,
  TimelinePointFromServer,
  Badge,
  GoalsTimelineRange,
  Level,
} from 'src/utils/api';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Swiper imports
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

// Dayjs
import dayjs, {  } from 'dayjs';
import 'dayjs/locale/ru';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// Mood icons/constants
import MOODS from 'src/features/profile/mood/MoodIcons';
import type {
  DashboardDataFromServer,
  ProgressPoint,
} from 'src/features/dashboard/types';

type DashboardPayload = DashboardDataFromServer & Record<string, any>;

// Тип для диапазонов времени, которые переключают 7/30/60/90/год/всё
type TimeRangeKey = 'week' | '30days' | '60days' | '90days' | 'year' | 'all';



const mapTimeRangeToApiRange = (
  range: TimeRangeKey,
): '7d' | '30d' | '60d' | '90d' | '365d' | 'all' => {
  switch (range) {
    case 'week':
      return '7d';
    case '30days':
      return '30d';
    case '60days':
      return '60d';
    case '90days':
      return '90d';
    case 'year':
      return '365d';
    case 'all':
    default:
      return 'all';
  }
};

const metricIconStyles: Record<
  string,
  { bg: string; color: string }
> = {
  activity:      { bg: 'rgba(129,140,248,0.25)', color: '#e0e7ff' },
  interpreted:   { bg: 'rgba(52,211,153,0.22)',  color: '#bbf7d0' },
  insights:      { bg: 'rgba(96,165,250,0.25)',  color: '#bfdbfe' },
  artwork:       { bg: 'rgba(251,191,36,0.25)',  color: '#fef3c7' },
  dialogs:       { bg: 'rgba(244,114,182,0.26)', color: '#fbcfe8' },
  streak:        { bg: 'rgba(56,189,248,0.26)',  color: '#bae6fd' },
};

const metricBarColors: Record<string, string> = {
  activity:    '#c4b5fd',
  interpreted: '#6ee7b7',
  insights:    '#a855f7',
  artwork:     '#fbbf24',
  dialogs:     '#fb7185',
  streak:      '#38bdf8',
};

// ===== Dark glass palette =====
const bgGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const glassBg = 'rgba(255, 255, 255, 0.06)';
const glassBorder = 'rgba(255, 255, 255, 0.10)';
const accentGradient =
  'linear-gradient(135deg, rgba(88,120,255,0.95), rgba(139,92,246,0.95))';
const subtleGlow = '0 8px 30px rgba(139,92,246,0.08)';
const cardShadow = '0 8px 24px rgba(11,8,36,0.16)';
const HEADER_BASE = 56;
const FOOTER_HEIGHT = 64;

const goalTrafficLightColors = {
  green: 'rgba(120, 220, 170, 0.85)',
  yellow: 'rgba(255, 230, 140, 0.85)',
  red: 'rgba(255, 140, 140, 0.85)',
  gray: 'rgba(220,220,220,0.5)',
};

type MicroGoal = {
  id: string;
  title: string;
  description?: string | null;
  progress?: number;
  targetLabel?: string;
  dueDate?: string | null;
  isCompleted?: boolean;
  targetCount?: number;
  unit?: string;
};

function getGoalProgressColor(goal: MicroGoal): string {
  if (goal.isCompleted) return goalTrafficLightColors.green;

  if (goal.dueDate) {
    const due = new Date(goal.dueDate);
    if (due < new Date() && (goal.progress ?? 0) < 100) {
      return goalTrafficLightColors.red;
    }
  }

  if ((goal.progress ?? 0) >= 80) return goalTrafficLightColors.green;
  if ((goal.progress ?? 0) >= 30) return goalTrafficLightColors.yellow;
  return goalTrafficLightColors.red;
}

const sumValues = (obj?: Record<string, any>): number => {
  if (!obj) return 0;
  return Object.values(obj).reduce(
    (s: number, v: any) => s + (Number(v) || 0),
    0,
  );
};

// Engagement card
type EngagementDetails = {
  activityCount: number;
  interpretedPct: number;
  insightsCount: number;
  artworkInteractions: number;
  dialogCount: number;
  streakDays: number;
};

const computeEngagement = (d: EngagementDetails) => {
  const weights = { A: 0.2, B: 0.25, C: 0.18, D: 0.12, E: 0.1, F: 0.15 };
  const targetActivity = 20;
  const targetInsights = 8;
  const targetArtworkInteractions = 12;
  const targetDialogs = 10;
  const targetStreak = 14;

  const A_norm = Math.min(
    100,
    Math.round((d.activityCount / targetActivity) * 100),
  );
  const B = Math.max(0, Math.min(100, Math.round(d.interpretedPct)));
  const C_norm = Math.min(
    100,
    Math.round((d.insightsCount / targetInsights) * 100),
  );
  const D_norm = Math.min(
    100,
    Math.round((d.artworkInteractions / targetArtworkInteractions) * 100),
  );
  const E_norm = Math.min(
    100,
    Math.round((d.dialogCount / targetDialogs) * 100),
  );
  const F_norm = Math.min(
    100,
    Math.round((d.streakDays / targetStreak) * 100),
  );

  const score = Math.round(
    weights.A * A_norm +
      weights.B * B +
      weights.C * C_norm +
      weights.D * D_norm +
      weights.E * E_norm +
      weights.F * F_norm,
  );

  return {
    score,
    breakdown: {
      activity: { value: d.activityCount, normalized: A_norm, weight: weights.A },
      interpreted: { value: d.interpretedPct, normalized: B, weight: weights.B },
      insights: { value: d.insightsCount, normalized: C_norm, weight: weights.C },
      artwork: {
        value: d.artworkInteractions,
        normalized: D_norm,
        weight: weights.D,
      },
      dialogs: { value: d.dialogCount, normalized: E_norm, weight: weights.E },
      streak: { value: d.streakDays, normalized: F_norm, weight: weights.F },
    },
  };
};

const EngagementCard: React.FC<{
  score: number;
  details: EngagementDetails;
}> = ({ details }) => {
  const { breakdown } = useMemo(
    () => computeEngagement(details),
    [details],
  );

  return (

    <Card sx={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
      <CardContent sx={{ px: 0 }}>
        {/* УБРАЛИ блок с процентом "Ваша активность" */}
        
        {/* Блок полосок метрик */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1,
            minWidth: 0,
          }}
        >
          {[
            {
              key: 'activity',
              title: 'Активность',
              icon: <BedtimeIcon />,
              data: breakdown.activity,
              unit: 'снов',
            },
            {
              key: 'interpreted',
              title: 'Проанализировано',
              icon: <CheckCircleIcon />,
              data: breakdown.interpreted,
              unit: '%',
            },
            {
              key: 'insights',
              title: 'Инсайты',
              icon: <AutoGraphIcon />,
              data: breakdown.insights,
              unit: 'шт.',
            },
            {
              key: 'artwork',
              title: 'Арт-взаимодействия',
              icon: <PaletteIcon />,
              data: breakdown.artwork,
              unit: 'шт.',
            },
            {
              key: 'dialogs',
              title: 'Диалоги',
              icon: <ChatIcon />,
              data: breakdown.dialogs,
              unit: 'шт.',
            },
            {
              key: 'streak',
              title: 'Стрик',
              icon: <TrendingUpIcon />,
              data: breakdown.streak,
              unit: 'дн.',
            },
          ].map((m) => {
            const iconStyle = metricIconStyles[m.key];
            const barColor = metricBarColors[m.key];

            return (
              <Box
                key={m.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: iconStyle.bg,
                    color: iconStyle.color,
                  }}
                >
                  <Box
                    sx={{
                      fontSize: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {m.icon}
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255,255,255,0.75)', display: 'block' }}
                  >
                    {m.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          height: 6,
                          background: 'rgba(255,255,255,0.04)',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${m.data.normalized}%`,
                            height: '100%',
                            backgroundColor: barColor,
                          }}
                        />
                      </Box>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        width: 36,
                        textAlign: 'right',
                        color: 'rgba(255,255,255,0.8)',
                      }}
                    >
                      {m.data.value} {m.unit}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};

const MicroGoalCard: React.FC<{
  goal: MicroGoal;
  onPlusOne?: (id: string) => void;
  onOpen?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}> = ({ goal, onPlusOne, onEdit, onDelete }) => {
  const {
    id,
    title,
    description,
    progress = 0,
    targetLabel,
    dueDate,
    isCompleted,
  } = goal;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      sx={{
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        borderRadius: 12,
        boxShadow: cardShadow,
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 12px 32px rgba(139,92,246,0.2)',
          border: '1px solid rgba(139,92,246,0.3)',
        },
      }}
      variant="outlined"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isCompleted
                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                : accentGradient,
              boxShadow: subtleGlow,
              color: '#fff',
              flexShrink: 0,
              transition: 'transform 0.2s',
              cursor: 'pointer',
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPlusOne?.(id);
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 24 }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  noWrap={!isExpanded}
                  sx={{
                    fontWeight: 700,
                    color: '#fff',
                    fontSize: 15,
                    mb: 0.5,
                  }}
                >
                  {title}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  alignItems: 'center',
                  ml: 1,
                }}
                onClick={(e) => e.stopPropagation()}
              >

                <IconButton
                  size="small"
                  onClick={() => onEdit?.(id)}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    background: 'rgba(255,255,255,0.05)',
                    '&:hover': { background: 'rgba(255,255,255,0.1)' },
                  }}
                  title="Редактировать"
                >
                  <EditIcon fontSize="small" />
                </IconButton>

                <IconButton
                  size="small"
                  onClick={() => onDelete?.(id)}
                  sx={{
                    color: 'rgba(220,38,38,0.85)',
                    background: 'rgba(220,38,38,0.1)',
                    '&:hover': { background: 'rgba(220,38,38,0.2)' },
                  }}
                  title="Удалить"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            {description && (
              <Typography
                noWrap={!isExpanded}
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.4,
                  mt: 0.5,
                }}
              >
                {description}
              </Typography>
            )}
          </Box>
        </Box>

        <Box>
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, progress))}
            sx={{
              height: 10,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': {
                background: getGoalProgressColor(goal),
                transition: 'transform 0.4s ease',
              },
            }}
          />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 0.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.6)' }}
            >
              {targetLabel
                ? `${progress}% • ${targetLabel}`
                : `${progress}%`}
            </Typography>
            {dueDate && (
              <Typography
                variant="caption"
                sx={{ color: 'rgba(255,255,255,0.6)' }}
              >
                До: {new Date(dueDate).toLocaleDateString('ru-RU')}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Moods panel (dashboard)

// Более "человечная" идеальная траектория вовлечённости / прогресса
const buildIdealHistory = (
  real: { date: string; score: number }[],
) => {
  if (!Array.isArray(real) || real.length === 0) return [];

  const n = real.length;
  const scores = real
    .map((p) => (typeof p.score === 'number' ? p.score : 0))
    .filter((v) => !Number.isNaN(v));

  const avgScore =
    scores.length > 0
      ? scores.reduce((s, v) => s + v, 0) / scores.length
      : 40;

  const minScore = scores.length > 0 ? Math.min(...scores) : 30;

  // Цель: "здоровый коридор" 70–85%, не 100.
  const targetIdeal = Math.min(85, Math.max(70, avgScore + 10));

  const startIdeal = Math.max(
    20,
    Math.min(minScore, targetIdeal - 30),
  );

  if (n === 1) {
    const base = scores[0] ?? 40;
    const singleIdeal = Math.round(Math.min(targetIdeal, base + 15));
    return real.map((p) => ({ ...p, ideal: singleIdeal }));
  }

  return real.map((p, i) => {
    const t = i / (n - 1); // 0..1
    const eased =
      t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const ideal = startIdeal + (targetIdeal - startIdeal) * eased;

    return {
      ...p,
      ideal: Math.round(Math.max(0, Math.min(100, ideal))),
    };
  });
};



// Компонент переключателя диапазона дат в общем стеклянном стиле (без тени)
const TimeRangeSelector: React.FC<{
  value: TimeRangeKey;
  onChange: (value: TimeRangeKey) => void;
}> = ({ value, onChange }) => (
  <Box
    sx={{
      display: 'flex',
      overflowX: 'auto',
      gap: 0.5,
      borderRadius: 999,
      p: 0.5,
      background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${glassBorder}`,
      boxShadow: 'none',
      // Скрыть скроллбар
      '&::-webkit-scrollbar': { height: 0 },
      scrollbarWidth: 'none',
      minWidth: 0,
      maxWidth: { xs: '100vw', sm: 'none' },
    }}
  >
    {[
      { key: 'week', label: '7 д' },
      { key: '30days', label: '30 д' },
      { key: '60days', label: '60 д' },
      { key: '90days', label: '90 д' },
      { key: 'year', label: '1 год' },
      { key: 'all', label: 'Всё' },
    ].map((o) => (
      <Button
        key={o.key}
        size="small"
        onClick={() => onChange(o.key as TimeRangeKey)}
        sx={{
          minWidth: 56, // Не даём кнопкам сжиматься слишком сильно
          px: 1.4,
          py: 0.25,
          borderRadius: 999,
          fontSize: 11,
          textTransform: 'none',
          letterSpacing: 0.1,
          color: value === o.key ? '#020617' : 'rgba(248,250,252,0.84)',
          background: value === o.key
            ? 'linear-gradient(135deg, rgba(248,250,252,0.98), rgba(226,232,240,0.96))'
            : 'rgba(255,255,255,0.02)',
          boxShadow: 'none',
          border: value === o.key
            ? '1px solid rgba(15,23,42,0.12)'
            : '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.18s ease',
          '&:hover': {
            background: value === o.key
              ? 'linear-gradient(135deg, rgba(241,245,249,1), rgba(226,232,240,1))'
              : 'rgba(148,163,255,0.20)',
            borderColor: value === o.key
              ? 'rgba(15,23,42,0.18)'
              : 'rgba(255,255,255,0.22)',
          },
        }}
      >
        {o.label}
      </Button>
    ))}
  </Box>
);

// MAIN COMPONENT
export const MonthDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { dreamsHistory = [], fetchDreams } = useDreams();

  // Состояние для адаптивного хедера (как в ProfileEditForm)
  const [inputOpen, setInputOpen] = useState(false);
  const [headerExtra, setHeaderExtra] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [, setDreamDates] = useState<string[]>([]);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] =
    useState<DashboardPayload | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressPoint[]>([]);

  const [viewTab, setViewTab] = useState<'dashboard' | 'goals'>('dashboard');

  const [goals, setGoals] = useState<MicroGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  const [goalsTimeline, setGoalsTimeline] = useState<
    { date: string; score: number; ideal?: number }[]
  >([]);
  const [goalsTimelineLoading, setGoalsTimelineLoading] = useState(false);
  const [goalsTimelineError, setGoalsTimelineError] = useState<string | null>(
    null,
  );
  // Исправлено: синхронизированные начальные значения
  // Добавь состояние dashboardDays
const initialTimeRange: TimeRangeKey = '30days';
const [engagementTimeRange, setEngagementTimeRange] =
  useState<TimeRangeKey>(initialTimeRange);

const handleEngagementTimeRangeChange = (range: TimeRangeKey) => {
  setEngagementTimeRange(range);
};

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTargetCount, setEditTargetCount] = useState('');
  const [goalsTimeRange, setGoalsTimeRange] = useState<TimeRangeKey>('30days');

  // === GAMIFICATION STATES ===
  const [newBadgesModalOpen, setNewBadgesModalOpen] = useState(false);
  const [newLevelModalOpen, setNewLevelModalOpen] = React.useState(false);
const [newLevelData, setNewLevelData] = React.useState<Level | null>(null);
  const [allBadgesModalOpen, setAllBadgesModalOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const [goalSaving, setGoalSaving] = useState(false);

const handlePinGoal = async (badgeId: string) => {
  try {
    setGoalSaving(true);
    await setCurrentGoal(badgeId); // Передаем строку badgeId
    await fetchDashboard(engagementTimeRange);
  } catch (e) {
    console.error('Failed to set current goal', e);
  } finally {
    setGoalSaving(false);
  }
};

const handleUnpinGoal = async () => {
  try {
    setGoalSaving(true);

    // Снимаем цель (передаём null или recommendedBadgeId)
    await setCurrentGoal(null); // ✅ передаём null для снятия цели

    // ✅ ОБЯЗАТЕЛЬНО обновляем дашборд после снятия
    await fetchDashboard(engagementTimeRange);
  } catch (e) {
    console.error('Failed to unpin goal', e);
  } finally {
    setGoalSaving(false);
  }
};

const handleCloseNewBadges = async () => {
  const newBadges = dashboardData?.gamification?.badges?.new || [];
  
  if (newBadges.length > 0) {
    const badgeIds = newBadges.map(b => b.id);
    await markBadgesAsSeen(badgeIds);
    
    // Обновляем локально, чтобы модалка не появилась снова
    setDashboardData(prev => {
      if (!prev || !prev.gamification) return prev;
      
      return {
        ...prev,
        gamification: {
          ...prev.gamification,
          badges: {
            ...prev.gamification.badges,
            new: [], // ✅ очищаем новые бейджи
          },
        },
      };
    });
  }
  
  setNewBadgesModalOpen(false);
};

  const normalizeDashboardServerPayload = (
    data: any,
  ): DashboardPayload => {
    if (!data || typeof data !== 'object') return data;

    const insightsDreamsCount =
      Number(
        data.insightsDreamsCount ??
          data.insights_dreams_count ??
          data.insights_count ??
          data.insightsTotal ??
          data.insights_total ??
          0,
      ) || 0;

    const insightsArtworksCount =
      Number(
        data.insightsArtworksCount ??
          data.insights_artworks_count ??
          data.artworkInsightsCount ??
          data.artwork_insights_count ??
          data.artworks_insights_count ??
          0,
      ) || 0;

    let moodCounts = data.moodCounts;
    if (typeof moodCounts === 'string') {
      try {
        moodCounts = JSON.parse(moodCounts);
      } catch {
        moodCounts = undefined;
      }
    }

    return {
      ...data,
      insightsDreamsCount,
      insightsArtworksCount,
      moodCounts,
      moodTotal:
        Number(data.moodTotal ?? sumValues(moodCounts) ?? 0) || 0,
    };
  };

  const fetchDashboard = useCallback(
  async (range: TimeRangeKey = '30days') => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const apiRange = mapTimeRangeToApiRange(range);
      const q = `?range=${apiRange}`;
      const raw = await request<any>(`/dashboard${q}`, {}, true);

      if (raw?.error) {
        setDashboardError(raw.message || 'Ошибка сервера');
        setDashboardData(null);
        setProgressHistory([]);
        return;
      }

      const data = normalizeDashboardServerPayload(raw);
      setDashboardData(data);

      if (Array.isArray(data.history) && data.history.length > 0) {
        const hist = data.history.map((h: any) => ({
          date: new Date(h.date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'short',
          }),
          score: Math.round(h.score),
        }));
        setProgressHistory(hist);
      } else {
        setProgressHistory([]);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setDashboardError(msg || 'Ошибка загрузки данных');
      setDashboardData(null);
      setProgressHistory([]);
    } finally {
      setDashboardLoading(false);
    }
  },
  [],
);

  useEffect(() => {
    fetchDreams();
  }, [fetchDreams]);

  // visualViewport handling (как в ProfileEditForm)
  useEffect(() => {
    const vv = (window as any).visualViewport;
    const update = () => {
      if (vv && typeof vv.height === 'number') {
        const kb = Math.max(0, window.innerHeight - vv.height);
        setKeyboardHeight(kb);
      } else {
        setKeyboardHeight(0);
      }
    };

    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      update();
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    } else {
      const onResize = () => setKeyboardHeight(0);
      window.addEventListener('resize', onResize);
      update();
      return () => window.removeEventListener('resize', onResize);
    }
  }, []);

  useEffect(() => {
    if (!Array.isArray(dreamsHistory) || dreamsHistory.length === 0) {
      setDreamDates([]);
      return;
    }
    const dates = dreamsHistory
      .map((d) => {
        const raw = (d as any)?.date;
        if (!raw && raw !== 0) return null;
        const dt = new Date(raw);
        if (isNaN(dt.getTime())) return null;
        return dt.toLocaleDateString('ru-RU');
      })
      .filter(Boolean) as string[];
    setDreamDates(dates);
  }, [dreamsHistory]);

 useEffect(() => {
  if (viewTab === 'dashboard') {
    fetchDashboard(engagementTimeRange);
  }
}, [engagementTimeRange, viewTab, fetchDashboard]);

// Показываем модалку новых бейджей
// ✅ Используем ref для отслеживания показанных бейджей
const shownLevelRef = React.useRef<number | null>(null);

// ✅ Показываем модалку только если есть новые бейджи
React.useEffect(() => {
  if (dashboardData?.gamification?.badges?.new) {
    const newBadges = dashboardData.gamification.badges.new;
    if (newBadges.length > 0) {
      setNewBadgesModalOpen(true);
    }
  }
}, [dashboardData?.gamification?.badges?.new]);

useEffect(() => {
  const level = dashboardData?.gamification?.level;
  
  if (!level || !level.isNew) return;

  // Проверяем, показывали ли мы уже этот уровень
  if (shownLevelRef.current === level.level) return;

  // Показываем модалку нового уровня
  const timer = setTimeout(() => {
    setNewLevelData(level); // ✅ просто передаём level как есть
    setNewLevelModalOpen(true);
    shownLevelRef.current = level.level ?? null;
  }, 300);

  return () => clearTimeout(timer);
}, [dashboardData?.gamification?.level]);

// ✅ Обработчик "Сделать целью" в модалке
const handleSetGoalFromModal = async (badge: Badge) => {
  try {
    await setCurrentGoal(badge.id);
    
    // Закрываем модалку
    await handleCloseNewBadges();
    
    // Обновляем дашборд
    await fetchDashboard(engagementTimeRange);
    
    // Можно добавить уведомление (если есть система уведомлений)
    console.log(`"${badge.name}" теперь ваша текущая цель!`);
  } catch (error) {
    console.error('Failed to set goal from modal:', error);
  }
};

  const usedDashboard = dashboardData;
const usedHistory = progressHistory;

const depthScoreTotal = usedDashboard?.gamification?.depthScoreTotal ?? 0;
const level = usedDashboard?.gamification?.level ?? {
  name: 'Неизвестно',
  emoji: '❓',
  color: '#9CA3AF',
  min: 0,
  max: 100,
};

{/* Безопасный расчёт процента прогресса */}
const progressPercent = React.useMemo(() => {
  const range = level.max - level.min;
  if (range <= 0) return 0;
  const val = ((depthScoreTotal - level.min) / range) * 100;
  return Math.min(100, Math.max(0, val));
}, [depthScoreTotal, level]);

useEffect(() => {
    if (inputOpen || keyboardHeight > 0) {
      const computed = Math.min(48, Math.max(6, Math.round(keyboardHeight * 0.03) + 8));
      setHeaderExtra(computed);
    } else {
      setHeaderExtra(0);
    }
  }, [inputOpen, keyboardHeight]);

  const headerTopStr = `calc(env(safe-area-inset-top) + ${headerExtra}px)`;
  const headerHeightStr = `${HEADER_BASE}px`;
  const contentMarginTop = `calc(${HEADER_BASE}px + env(safe-area-inset-top) + ${headerExtra}px)`;
  const contentMarginBottom = `${FOOTER_HEIGHT + Math.ceil(Math.max(0, keyboardHeight)) + 18}px`;


const goalToShow =
  usedDashboard?.gamification?.currentGoal ??
  usedDashboard?.gamification?.recommendedGoal ??
  null;

const isPinnedGoal = Boolean(usedDashboard?.gamification?.currentGoal);
const currentGoalId = usedDashboard?.gamification?.currentGoal?.badgeId ?? null;


  // ===== GOALS HELPERS / API =====

const mapServerGoalToMicro = (g: GoalFromServer): MicroGoal => {
  const pct = g.progress_percent ?? 0;
  const due = g.due_date ? new Date(g.due_date * 1000) : null;

  let targetLabel = '';
  if (g.target_count && g.target_count > 0) {
    targetLabel = `${g.total_done}/${g.target_count}` + (g.unit ? ` ${g.unit}` : '');
  }

  const isCompleted = pct >= 100 || g.status === 'completed';

  return {
    id: g.goal_id,
    title: g.title,
    description: g.description ?? undefined,
    progress: Math.max(0, Math.min(100, Math.round(pct))),
    targetLabel,
    dueDate: due ? due.toISOString() : null,
    isCompleted,
    targetCount: g.target_count ?? undefined,
    unit: g.unit ?? undefined,
  };
};

const fetchGoalsData = useCallback(async () => {
  setGoalsError(null);
  try {
    const res = await getGoals();
    if (!res || !Array.isArray(res.goals)) {
      setGoals([]);
      return;
    }
    setGoals(res.goals.map(mapServerGoalToMicro));
  } catch (e: any) {
    const msg = e?.message || String(e);
    setGoalsError(msg || 'Не удалось загрузить цели');
  }
}, []);

const fetchGoalsTimelineData = useCallback(
  async (range: TimeRangeKey = '30days') => {
    setGoalsTimelineLoading(true);
    setGoalsTimelineError(null);

    try {
      const apiRange: GoalsTimelineRange = mapTimeRangeToApiRange(range); // 👈 явный тип
      const res = await getGoalsTimeline(apiRange);
      const pts = Array.isArray(res?.points) ? res.points : [];

      const mapped = pts.map((p: TimelinePointFromServer) => {
  let dateLabel: string;
  try {
    dateLabel = new Date(p.date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    dateLabel = String(p.date);
  }

  let score = 0;
  if (typeof p.percent === 'number') {
    score = Math.max(0, Math.min(100, Math.round(p.percent)));
  } else if (typeof p.cumulative_amount === 'number') {
    score = Math.max(
      0,
      Math.min(100, Math.round(p.cumulative_amount)),
    );
  }

  return {
    date: dateLabel,
    score,
  };
});

      setGoalsTimeline(mapped);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setGoalsTimelineError(
        msg || 'Не удалось загрузить таймлайн целей',
      );
      setGoalsTimeline([]);
    } finally {
      setGoalsTimelineLoading(false);
    }
  },
  [],
);

const createGoalOnServer = async () => {
  const body = {
    title: 'Новая цель',
    description: 'Опишите цель',
    goalType: 'count',
    targetCount: 5,
    unit: 'шагов',
    period: '7d',
    startDate: Math.floor(Date.now() / 1000),
    dueDate: null,
  };
  const res = await createGoal(body);

  if (res && typeof res === 'object') {
    return (
      (res as any).id ||
      (res as any).goal_id ||
      (res as any)._id ||
      null
    );
  }

  return null;
};

const addGoalEventOnServer = async (goalId: string) => {
  await addGoalEvent(goalId, 1);
};

const updateGoalOnServer = async (goalId: string, updates: any) => {
  await request(
    `/goals/${goalId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
      headers: { 'Content-Type': 'application/json' },
    },
    true,
  );
};

useEffect(() => {
  if (viewTab === 'goals') {
    setGoalsLoading(true);
    Promise.all([
      fetchGoalsData(),
      fetchGoalsTimelineData(goalsTimeRange),
    ]).finally(() => {
      setGoalsLoading(false);
    });
  }
}, [viewTab, fetchGoalsData, fetchGoalsTimelineData, goalsTimeRange]);

const handlePlusOne = async (id: string) => {
  let shouldCallServer = true;

  setGoals((prev) =>
    prev.map((g) => {
      if (g.id !== id) return g;

      const progress = g.progress ?? 0;

      if (progress >= 100) {
        shouldCallServer = false;
        return g;
      }

      if (!g.targetCount || g.targetCount <= 0) {
        const newProgress = Math.min(100, progress + 1);
        return {
          ...g,
          progress: newProgress,
          isCompleted: newProgress >= 100,
        };
      }

      const targetCount = g.targetCount;
      const approxDone = Math.round(
        (progress / 100) * targetCount,
      );
      const currentDone = Math.min(approxDone, targetCount);

      if (currentDone >= targetCount) {
        shouldCallServer = false;
        return {
          ...g,
          progress: 100,
          isCompleted: true,
          targetLabel: `${targetCount}/${targetCount}${
            g.unit ? ` ${g.unit}` : ''
          }`,
        };
      }

      const newTotalDone = currentDone + 1;
      const newProgress = Math.min(
        100,
        Math.round((newTotalDone / targetCount) * 100),
      );

      return {
        ...g,
        progress: newProgress,
        isCompleted:
          newTotalDone >= targetCount || newProgress >= 100,
        targetLabel: `${newTotalDone}/${targetCount}${
          g.unit ? ` ${g.unit}` : ''
        }`,
      };
    }),
  );

  if (!shouldCallServer) {
    return;
  }

  try {
    await addGoalEventOnServer(id);
    fetchGoalsData();
    fetchGoalsTimelineData(goalsTimeRange);
  } catch (e) {
    console.error('handlePlusOne error', e);
    fetchGoalsData();
  }
};

const handleOpenGoal = (id: string) =>
  navigate(`/goals/${id}`);

const handleEditGoal = (id: string) => {
  const goal = goals.find((g) => g.id === id);
  if (!goal) return;

  setEditGoalId(id);
  setEditTitle(goal.title);
  setEditDescription(goal.description || '');
  setEditTargetCount(String(goal.targetCount || 5));
  setEditModalOpen(true);
};

const handleSaveEdit = async () => {
  if (!editGoalId) return;

  try {
    const updates = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      targetCount: Number(editTargetCount) || 0,
    };

    await updateGoalOnServer(editGoalId, updates);

    await fetchGoalsData();
    await fetchGoalsTimelineData(goalsTimeRange);

    setEditModalOpen(false);
  } catch (e) {
    console.error('handleSaveEdit error', e);
  }
};

const handleDeleteGoal = (id: string) =>
  setConfirmDeleteId(id);

const confirmDeleteGoalAction = async () => {
  if (!confirmDeleteId) return;
  try {
    await deleteGoal(confirmDeleteId);
    fetchGoalsData();
    fetchGoalsTimelineData(goalsTimeRange);
  } catch (e) {
    console.error('confirmDelete error', e);
  } finally {
    setConfirmDeleteId(null);
  }
};

const cancelDelete = () => setConfirmDeleteId(null);

const handleAddGoal = async () => {
  try {
    const newId = await createGoalOnServer();
    fetchGoalsData();
    fetchGoalsTimelineData(goalsTimeRange);

    if (newId) {
      setGoals((prev) => {
        const existing = prev.find((g) => g.id === newId);
        if (existing) return prev;
        const newGoal: MicroGoal = {
          id: newId,
          title: 'Новая цель',
          description: 'Опишите цель',
          progress: 0,
          targetLabel: '',
          dueDate: null,
          isCompleted: false,
          targetCount: 5,
          unit: 'шагов',
        };
        return [newGoal, ...prev];
      });
    }
  } catch (e) {
    console.error('handleAddGoal error', e);
  }
};

// === GAMIFICATION HANDLERS ===
const toggleCategory = (category: string) => {
  setExpandedCategories((prev) => ({
    ...prev,
    [category]: !prev[category],
  }));
};

  dayjs.locale('ru');

 return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="ru"
    >
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: bgGradient,
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Фиксированный header в стиле ProfileEditForm */}
        <Box
          sx={{
            position: 'fixed',
            top: headerTopStr,
            left: 0,
            right: 0,
            height: headerHeightStr,
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 28px rgba(41, 52, 98, 0.12)',
            userSelect: 'none',
            px: 2,
            transition: 'top 0.28s ease, height 0.18s ease',
          }}
        >
          {/* Назад слева */}
          <IconButton
            aria-label="Назад"
            onClick={() => navigate(-1)}
            sx={{
              position: 'absolute',
              left: 12,
              color: '#fff',
              bgcolor: 'transparent',
              borderRadius: '50%',
              p: 1,
              zIndex: 1500,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
            }}
            size="large"
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>

          {/* Центр хедера */}
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '1.05rem',
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: 0.4,
              userSelect: 'none',
            }}
          >
            Дашборд
          </Typography>

          {/* Переключатели вкладок справа */}
          <Box
            sx={{
              position: 'absolute',
              right: 12,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <IconButton
              aria-label="dashboard"
              title="Дашборд"
              onClick={() => setViewTab('dashboard')}
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                color: '#fff',
                transition: 'all 0.18s ease',
                ...(viewTab !== 'dashboard' && {
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(209,213,219,0.45)',
                }),
                ...(viewTab === 'dashboard' && {
                  backgroundColor: 'rgba(37,99,235,0.25)',
                  border: '1px solid rgba(96,165,250,0.95)',
                }),
                '&:hover': {
                  backgroundColor:
                    viewTab === 'dashboard'
                      ? 'rgba(37,99,235,0.32)'
                      : 'rgba(209,213,219,0.12)',
                },
              }}
            >
              <AutoGraphIcon sx={{ fontSize: 20 }} />
            </IconButton>

            <IconButton
              aria-label="goals"
              title="Цели"
              onClick={() => setViewTab('goals')}
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                color: '#fff',
                transition: 'all 0.18s ease',
                ...(viewTab !== 'goals' && {
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(209,213,219,0.45)',
                }),
                ...(viewTab === 'goals' && {
                  backgroundColor: 'rgba(37,99,235,0.25)',
                  border: '1px solid rgba(96,165,250,0.95)',
                }),
                '&:hover': {
                  backgroundColor:
                    viewTab === 'goals'
                      ? 'rgba(37,99,235,0.32)'
                      : 'rgba(209,213,219,0.12)',
                },
              }}
            >
              <FlagIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Скроллируемый контент под хедером */}
        <Box
          sx={{
            flexGrow: 1,
            marginTop: contentMarginTop,
            marginBottom: contentMarginBottom,
            overflowY: 'auto',
            display: 'flex',
            justifyContent: 'center',
            px: { xs: 1, sm: 3 },
          }}
        >
          <Box
  sx={{
    width: '100%',
    maxWidth: 980,
    minWidth: 0,
    px: { xs: 0, sm: 0 },
    py: { xs: 1, sm: 2 },
  }}
>
  {/* Контент без общего Paper */}
  {dashboardLoading ? (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Skeleton
        variant="rounded"
        height={140}
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          borderRadius: 2,
        }}
      />
      <Skeleton
        variant="rounded"
        height={110}
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          borderRadius: 2,
        }}
      />
      <Skeleton
        variant="rounded"
        height={120}
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          borderRadius: 2,
        }}
      />
    </Box>
  ) : dashboardError ? (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <Typography color="error" gutterBottom>
        Ошибка загрузки данных
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        {dashboardError}
      </Typography>
      <Button
        variant="contained"
        onClick={() => {
          fetchDashboard(engagementTimeRange);
        }}
        startIcon={<RefreshIcon />}
        sx={{ mt: 2 }}
      >
        Повторить
      </Button>
    </Box>
  ) : viewTab === 'dashboard' ? (
    usedDashboard ? (
      <>
        {/* 1. 🎯 УРОВЕНЬ — легкая секция без тяжелого Card */}
        {usedDashboard.gamification && (
          <>
            <Box
              sx={{
                mb: 2,
                px: { xs: 0.5, sm: 0 },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 3,
                    background: usedDashboard.gamification.level.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                  }}
                >
                  {usedDashboard.gamification.level.emoji}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: '#fff', mb: 0.3 }}
                  >
                    {usedDashboard.gamification.level.name}
                  </Typography>
                 <Typography
  variant="body2"
  sx={{ color: 'rgba(255,255,255,0.8)' }}
>
  Глубина практики:{' '}
  {Math.round(usedDashboard.gamification.depthScoreTotal)} /{' '}
  {usedDashboard.gamification.level.max}
</Typography>
                </Box>
              </Box>

              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 10,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  '& .MuiLinearProgress-bar': {
                    background: usedDashboard.gamification.level.color,
                    boxShadow: `0 0 10px ${usedDashboard.gamification.level.color}`,
                  },
                }}
              />

              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  display: 'block',
                  mt: 0.75,
                }}
              >
                До следующего уровня:{' '}
                {usedDashboard.gamification.level.max -
                  Math.round(depthScoreTotal)}{' '}
                очков
              </Typography>
            </Box>

            <Divider
              sx={{
                my: { xs: 1.5, sm: 2 },
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            />
          </>
        )}

        {/* 2. 📌 ТЕКУЩАЯ ЦЕЛЬ — тоже без тяжелого Card */}
        {goalToShow && (
          <>
            <Box
              sx={{
                mb: 2,
                px: { xs: 0.5, sm: 0 },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.10)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                  }}
                >
                  {goalToShow.emoji}
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 600, color: '#fff' }}
                    >
                      {goalToShow.name}
                    </Typography>

                    <Chip
                      size="small"
                      label={isPinnedGoal ? 'Текущая цель' : 'Рекомендуемая'}
                      sx={{
                        height: 20,
                        fontSize: 11,
                        background: isPinnedGoal
                          ? 'rgba(59,130,246,0.20)'
                          : 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        color: '#fff',
                      }}
                    />
                  </Box>

                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255,255,255,0.75)',
                      mt: 0.5,
                    }}
                  >
                    {goalToShow.description}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 1.25 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    (goalToShow.progress.current /
                      Math.max(1, goalToShow.progress.target)) *
                      100,
                  )}
                  sx={{
                    height: 8,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.10)',
                    '& .MuiLinearProgress-bar': {
                      background: '#22c55e',
                    },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.6)',
                    display: 'block',
                    mt: 0.5,
                  }}
                >
                  {goalToShow.progress.current} / {goalToShow.progress.target}
                </Typography>
              </Box>

              {goalToShow.advice && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255,255,255,0.9)',
                    fontStyle: 'italic',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 2,
                    p: 1.25,
                    border: '1px solid rgba(255,255,255,0.05)',
                    mb: 1.25,
                  }}
                >
                  💡 {goalToShow.advice}
                </Typography>
              )}

              {/* Кнопки пина/снятия цели */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!isPinnedGoal && (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={goalSaving}
                    onClick={() => handlePinGoal(goalToShow.badgeId)}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 999,
                      background: accentGradient,
                      fontWeight: 600,
                    }}
                  >
                    Сделать целью
                  </Button>
                )}

                {isPinnedGoal && (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={goalSaving}
                    onClick={handleUnpinGoal}
                    startIcon={
                      goalSaving ? (
                        <CircularProgress size={16} sx={{ color: 'white' }} />
                      ) : null
                    }
                    sx={{
                      textTransform: 'none',
                      borderRadius: 999,
                      color: '#fff',
                      borderColor: 'rgba(255,255,255,0.24)',
                      '&.Mui-disabled': {
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.3)',
                      },
                    }}
                  >
                    {goalSaving ? 'Снятие...' : 'Снять цель'}
                  </Button>
                )}
              </Box>
            </Box>

            <Divider
              sx={{
                my: { xs: 1.5, sm: 2 },
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            />
          </>
        )}

                    {/* дальше остаётся твой существующий контент */}

                  {/* 3. 📈 АКТИВНОСТЬ (метрики) */}
                

                  <EngagementCard
                    score={usedDashboard.gamification?.engagementScorePeriod ?? 0}
                    details={{
                      activityCount: usedDashboard.totalDreamsInPeriod ?? 0,
                      interpretedPct: usedDashboard.breakdownPercent?.interpreted ?? 0,
                      insightsCount: 0,
                      artworkInteractions: usedDashboard.breakdownCounts?.artworks ?? 0,
                      dialogCount: usedDashboard.breakdownCounts?.dialogs ?? 0,
                      streakDays: usedDashboard.streak ?? 0,
                    }}
                  />

                  <Divider
                    sx={{
                      my: { xs: 1.5, sm: 2 },
                      borderColor: 'rgba(255,255,255,0.06)',
                    }}
                  />

                  {/* 4. 😊 НАСТРОЕНИЯ */}
                  <Box sx={{ mb: 2 }}>
                    

                    {(() => {
                      const counts = (usedDashboard.moodCounts || {}) as Record<string, number>;

                      const rawMoodList = MOODS.map((m) => ({
                        ...m,
                        cnt: counts[m.id] ?? 0,
                      }))
                        .filter((m) => m.cnt > 0)
                        .sort((a, b) => b.cnt - a.cnt);

                      const total = rawMoodList.reduce((acc, m) => acc + m.cnt, 0);

                      const moodList = rawMoodList.map((m) => ({
                        ...m,
                        pct: total > 0 ? Math.round((m.cnt / total) * 100) : 0,
                      }));

                      if (moodList.length === 0) {
                        return (
                          <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255,255,255,0.65)' }}
                          >
                            Нет данных
                          </Typography>
                        );
                      }

                      const renderMoodIcon = (icon: any) => {
                        if (!icon) return null;
                        if (React.isValidElement(icon)) {
                          return React.cloneElement(icon as React.ReactElement, {
                            style: {
                              ...((icon as any).props?.style || {}),
                              color: '#fff',
                              fontSize: 20,
                            },
                            ...((icon as any).props || {}),
                          });
                        }
                        if (typeof icon === 'function' || typeof icon === 'object') {
                          const IconComp = icon as React.ComponentType<any>;
                          try {
                            return <IconComp style={{ color: '#fff', fontSize: 20 }} />;
                          } catch {
                            return null;
                          }
                        }
                        return icon;
                      };

                      return (
                        <Swiper
                          spaceBetween={10}
                          slidesPerView={2.2}
                          centeredSlides={false}
                          breakpoints={{
                            360: { slidesPerView: 2.4 },
                            420: { slidesPerView: 2.8 },
                            600: { slidesPerView: 3.4 },
                            900: { slidesPerView: 4.4 },
                          }}
                          style={{ padding: '4px 2px' }}
                        >
                          {moodList.map((m) => (
                            <SwiperSlide key={m.id}>
                              <Card
                                sx={{
                                  minWidth: { xs: 110, sm: 140 },
                                  maxWidth: { xs: 140, sm: 220 },
                                  background: 'rgba(255,255,255,0.08)',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  borderRadius: 3,
                                  p: 1,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 1,
                                  height: '100%',
                                }}
                              >
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                  }}
                                >
                                  <Avatar
                                    sx={{
                                      width: 28,
                                      height: 28,
                                      bgcolor: m.color || 'rgba(148,163,255,0.6)',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {renderMoodIcon(m.icon)}
                                  </Avatar>

                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography
                                      variant="subtitle2"
                                      noWrap
                                      sx={{
                                        fontWeight: 600,
                                        fontSize: '0.75rem',
                                        lineHeight: 1.1,
                                        color: '#fff',
                                      }}
                                    >
                                      {m.label}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      {m.cnt} раз • {m.pct}%
                                    </Typography>
                                  </Box>
                                </Box>

                                <Box
                                  sx={{
                                    height: 6,
                                    background: 'rgba(255,255,255,0.12)',
                                    borderRadius: 999,
                                    overflow: 'hidden',
                                    mt: 'auto',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: `${m.pct}%`,
                                      height: '100%',
                                      background: m.color || 'rgba(148,163,255,0.9)',
                                      borderRadius: 999,
                                      transition: 'width 0.4s ease',
                                    }}
                                  />
                                </Box>
                              </Card>
                            </SwiperSlide>
                          ))}
                        </Swiper>
                      );
                    })()}
                  </Box>

                  <Divider
                    sx={{
                      my: { xs: 1.5, sm: 2 },
                      borderColor: 'rgba(255,255,255,0.06)',
                    }}
                  />

                  {/* 5. 📊 ДИНАМИКА ВОВЛЕЧЁННОСТИ */}
                  <Box sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 1.5,
                      }}
                    >
                    

                      <Box
                        sx={{
                          overflowX: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          px: 0.5,
                          '&::-webkit-scrollbar': { height: 0 },
                          scrollbarWidth: 'none',
                          maxWidth: { xs: '100vw', sm: 'none' },
                        }}
                      >
                        <TimeRangeSelector
                          value={engagementTimeRange}
                          onChange={handleEngagementTimeRangeChange}
                        />
                      </Box>
                    </Box>

                    <ResponsiveContainer
                      width="100%"
                      height={window.innerWidth < 600 ? 140 : 200}
                    >
                      <LineChart
                        data={usedHistory}
                        margin={{ top: 16, right: 16, left: 0, bottom: 32 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.12)"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="rgba(255,255,255,0.8)"
                          style={{ fontSize: 11 }}
                        />
                        <YAxis
                          stroke="rgba(255,255,255,0.8)"
                          style={{ fontSize: 11 }}
                          domain={[0, 100]}
                        />

                        <RechartsTooltip
  contentStyle={{
    background: 'rgba(15,23,42,0.96)',
    border: '1px solid rgba(148,163,184,0.65)',
    borderRadius: 10,
    color: '#fff',
    padding: '6px 10px',
    fontSize: 12,
  }}
  labelStyle={{
    color: 'rgba(226,232,240,0.9)',
    fontWeight: 500,
    marginBottom: 2,
  }}
  formatter={(value: any, name: string) => {
    if (name === 'Актуальный темп') {
      return [`${value}%`, 'Актуальный темп'];
    }
    if (name === 'Идеальный темп') {
      return [`${value}%`, 'Идеальный темп'];
    }
    // Все прочие серии (если вдруг есть) не показываем
    return null;
  }}
/>

<Legend
  wrapperStyle={{
    color: '#fff',
    fontSize: 12,
  }}
/>

<Line
  type="monotone"
  data={buildIdealHistory(usedHistory)}
  dataKey={(v: any) => v.ideal}
  stroke="rgba(248,250,252,0.7)"
  strokeWidth={2}
  strokeDasharray="6 4"
  name="Идеальный темп"
  dot={false}
  isAnimationActive={false}
  legendType="plainline"
/>

<Line
  type="monotone"
  dataKey="score"
  stroke="#22c55e"
  strokeWidth={4}
  name="Актуальный темп"
  dot={{
    r: 7,
    fill: '#22c55e',
    stroke: '#020617',
    strokeWidth: 1,
  }}
  activeDot={{
    r: 9,
    stroke: '#e5e7eb',
    strokeWidth: 2,
  }}
  isAnimationActive={false}
/>

                  
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>

                  <Divider
                    sx={{
                      my: { xs: 1.5, sm: 2 },
                      borderColor: 'rgba(255,255,255,0.06)',
                    }}
                  />

                  {/* 6. 🏆 ДОСТИЖЕНИЯ */}
                  {usedDashboard.gamification && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            color: '#fff',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          🏆 Достижения ({usedDashboard.gamification.badges.unlocked.length})
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => setAllBadgesModalOpen(true)}
                          sx={{
                            textTransform: 'none',
                            color: 'rgba(255,255,255,0.85)',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Все бейджи
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {usedDashboard.gamification.badges.unlocked.slice(0, 6).map((badge: Badge) => (
                          <Chip
                            key={badge.id}
                            label={`${badge.emoji} ${badge.name}`}
                            sx={{
                              background: 'rgba(34,197,94,0.15)',
                              border: '1px solid rgba(34,197,94,0.3)',
                              color: '#fff',
                              fontWeight: 600,
                            }}
                          />
                        ))}
                        {usedDashboard.gamification.badges.unlocked.length > 6 && (
                          <Chip
                            label={`+${usedDashboard.gamification.badges.unlocked.length - 6}`}
                            onClick={() => setAllBadgesModalOpen(true)}
                            sx={{
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}
                </>
              ) : (
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.7)',
                    textAlign: 'center',
                    py: 3,
                  }}
                >
                  Нет данных для отображения
                </Typography>
              )
            ) : (
              /* === Вкладка ЦЕЛИ === */
              <>
                {goalsLoading ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <Skeleton
                      variant="rounded"
                      height={120}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderRadius: 10,
                      }}
                    />
                    <Skeleton
                      variant="rounded"
                      height={120}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderRadius: 10,
                      }}
                    />
                  </Box>
                ) : goalsError ? (
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 3,
                    }}
                  >
                    <Typography color="error" gutterBottom>
                      Ошибка загрузки целей
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {goalsError}
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={fetchGoalsData}
                      startIcon={<RefreshIcon />}
                      sx={{ mt: 2 }}
                    >
                      Повторить
                    </Button>
                  </Box>
                ) : (
                  <>
                    {goalsTimelineLoading ? (
                      <Skeleton
                        variant="rounded"
                        height={200}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.04)',
                          borderRadius: 10,
                          mb: 2,
                        }}
                      />
                    ) : goalsTimelineError ? (
                      <Box
                        sx={{
                          textAlign: 'center',
                          py: 2,
                          mb: 2,
                        }}
                      >
                        <Typography variant="caption" color="error">
                          {goalsTimelineError}
                        </Typography>
                      </Box>
                    ) : goalsTimeline.length > 0 ? (
                      <Box sx={{ mb: 2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mt: 3,
                            mb: 1,
                          }}
                        >
                        

                          <Box
                            sx={{
                              overflowX: 'auto',
                              WebkitOverflowScrolling: 'touch',
                              px: 0.5,
                              '&::-webkit-scrollbar': { height: 0 },
                              scrollbarWidth: 'none',
                            }}
                          >
                            <TimeRangeSelector
                              value={goalsTimeRange}
                              onChange={setGoalsTimeRange}
                            />
                          </Box>
                        </Box>

                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={goalsTimeline}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(255,255,255,0.12)"
                            />
                            <XAxis
                              dataKey="date"
                              stroke="rgba(255,255,255,0.8)"
                              style={{ fontSize: 11 }}
                            />
                            <YAxis
                              stroke="rgba(255,255,255,0.8)"
                              style={{ fontSize: 11 }}
                              domain={[0, 100]}
                            />

                           <RechartsTooltip
  contentStyle={{
    background: 'rgba(15,23,42,0.96)',
    border: '1px solid rgba(148,163,184,0.65)',
    borderRadius: 10,
    color: '#fff',
    padding: '6px 10px',
    fontSize: 12,
  }}
  labelStyle={{
    color: 'rgba(226,232,240,0.9)',
    fontWeight: 500,
    marginBottom: 2,
  }}
  formatter={(value: any, name: string) => {
    if (name === 'Прогресс по цели') {
      return [`${value}%`, 'Прогресс по цели'];
    }
    if (name === 'Идеальный темп') {
      return [`${value}%`, 'Идеальный темп'];
    }
    return [value, name];
  }}
/>

<Legend
  wrapperStyle={{
    color: '#fff',
    fontSize: 12,
  }}
/>

<Line
  type="monotone"
  data={buildIdealHistory(goalsTimeline)}
  dataKey={(v: any) => v.ideal}
  stroke="rgba(248,250,252,0.7)"
  strokeWidth={2}
  strokeDasharray="6 4"
  name="Идеальный темп"
  dot={false}
  isAnimationActive={false}
  legendType="plainline"
/>

<Line
  type="monotone"
  dataKey="score"
  stroke="#22c55e"
  strokeWidth={4}
  name="Прогресс по цели"
  dot={{
    r: 7,
    fill: '#22c55e',
    stroke: '#020617',
    strokeWidth: 1,
  }}
  activeDot={{
    r: 9,
    stroke: '#e5e7eb',
    strokeWidth: 2,
  }}
  isAnimationActive={false}
/>
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    ) : null}

                    <Divider
                      sx={{
                        my: { xs: 1, sm: 2 },
                        borderColor: 'rgba(255,255,255,0.06)',
                      }}
                    />

                    <Box sx={{ mb: 2 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddGoal}
                        sx={{
                          background: accentGradient,
                          color: '#fff',
                          textTransform: 'none',
                          fontWeight: 600,
                          py: 1.5,
                          borderRadius: 10,
                          boxShadow: subtleGlow,
                          '&:hover': {
                            background:
                              'linear-gradient(135deg, rgba(88,120,255,1), rgba(139,92,246,1))',
                          },
                        }}
                      >
                        Добавить цель
                      </Button>
                    </Box>

                    {goals.length === 0 ? (
                      <Box
                        sx={{
                          textAlign: 'center',
                          py: 4,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'rgba(255,255,255,0.7)',
                          }}
                        >
                          У вас пока нет целей. Создайте первую!
                        </Typography>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        {goals.map((goal) => (
  <MicroGoalCard
    key={goal.id}
    goal={goal}
    onPlusOne={handlePlusOne}
    onOpen={handleOpenGoal}
    onEdit={handleEditGoal}
    onDelete={handleDeleteGoal}
  />
))}
                      </Box>
                    )}
                  </>
                )}
              </>
            )}
        </Box>
        </Box>

        {/* Все диалоги остаются без изменений */}
        <Dialog
          open={!!confirmDeleteId}
          onClose={cancelDelete}
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${glassBorder}`,
              color: '#fff',
              borderRadius: 3,
            },
          }}
        >
          <DialogTitle>Удалить цель?</DialogTitle>
          <DialogContent>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              Вы уверены, что хотите удалить эту цель? Это действие нельзя отменить.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={cancelDelete} sx={{ color: '#fff' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={confirmDeleteGoalAction}
              sx={{
                bgcolor: 'rgba(255, 100, 100, 0.95)',
                '&:hover': {
                  bgcolor: 'rgba(255, 100, 100, 0.85)',
                },
              }}
            >
              Удалить
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${glassBorder}`,
              color: '#fff',
              borderRadius: 3,
              minWidth: 380,
            },
          }}
        >
          <DialogContent
            sx={{
              pt: 2.5,
              pb: 1.5,
              px: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <TextField
  fullWidth
  label="Название"
  value={editTitle}
  onChange={(e) => setEditTitle(e.target.value)}
  onFocus={(e) => {
    const def = 'Новая цель';
    const val = (editTitle ?? '').trim();
    if (val === def) {
      setEditTitle('');
    } else {
      try {
        (e.target as HTMLInputElement).select();
      } catch {}
    }
  }}
  placeholder="Введите название цели"
  variant="outlined"
  InputLabelProps={{ shrink: Boolean(editTitle) }}
  sx={{
    mb: 1.5,
    '& .MuiInputLabel-root': {
      color: '#fff',
      opacity: 0.95,
      '&.Mui-focused': { color: '#fff' },
    },
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 1.5,
      '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.32)' },
      // Тонкая линия 1px при фокусе
      '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.9)', borderWidth: '1px' },
    },
    '& .MuiOutlinedInput-input': {
      whiteSpace: 'nowrap',
      overflowX: 'auto',
      textOverflow: 'ellipsis',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-x',
      '&:focus::placeholder': { opacity: 0 },
    },
    '& .MuiInputBase-root::-webkit-scrollbar': {
      height: 8,
      width: 8,
      background: 'transparent',
    },
    '& .MuiInputBase-root::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 8,
    },
    '& .MuiInputBase-root': {
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255,255,255,0.06) transparent',
    },
  }}
  inputProps={{ 'aria-label': 'title' }}
/>
            <TextField
  fullWidth
  label="Описание"
  value={editDescription}
  onChange={(e) => setEditDescription(e.target.value)}
  onFocus={() => {
    const def = 'Опишите цель';
    const val = (editDescription ?? '').trim();
    if (val === def) setEditDescription('');
  }}
  multiline
  minRows={3}
  placeholder="Короткое описание цели"
  variant="outlined"
  InputLabelProps={{ shrink: Boolean(editDescription) }}
  sx={{
    mb: 1.5,
    '& .MuiInputLabel-root': {
      color: '#fff',
      opacity: 0.95,
      '&.Mui-focused': { color: '#fff' },
    },
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 1.5,
      '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.32)' },
      // Тонкая линия 1px при фокусе
      '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.9)', borderWidth: '1px' },
    },
    '& .MuiOutlinedInput-multiline': {
      maxHeight: { xs: 120, sm: 180 },
      overflow: 'hidden',
      overscrollBehavior: 'contain',
    },
    '& textarea': {
      maxHeight: { xs: 120, sm: 180 },
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      overscrollBehavior: 'contain',
    },
    '& textarea:focus::placeholder': { opacity: 0 },
    '& .MuiInputBase-root::-webkit-scrollbar': {
      height: 8,
      width: 8,
      background: 'transparent',
    },
    '& .MuiInputBase-root::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 8,
    },
    '& .MuiInputBase-root': {
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255,255,255,0.06) transparent',
    },
  }}
/>

            <TextField
  fullWidth
  label="Количество шагов"
  // оставляем type="number" (спиннеры спрятаны через CSS), можно поменять на "text" при желании
  type="number"
  value={editTargetCount}
  onChange={(e) => {
    // Оставляем только цифры
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw === '') {
      setEditTargetCount('');
      return;
    }
    // Ограничиваем максимум 30
    const num = Math.min(30, Number(raw));
    setEditTargetCount(String(num));
  }}
  onKeyDown={(e) => {
    // Блокируем стрелки вверх/вниз
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  }}
  onWheel={(e) => {
    // Предотвращаем изменение значения колесом, когда фокус в поле
    if ((e.target as HTMLElement)?.matches('input')) {
      (e.target as HTMLElement).blur();
      e.preventDefault();
    }
  }}
  onFocus={(e) => {
    const def = '5';
    const val = (editTargetCount ?? '').trim();
    if (val === def || val === '0') {
      setEditTargetCount('');
    } else {
      try {
        (e.target as HTMLInputElement).select();
      } catch {}
    }
  }}
  onBlur={() => {
    // Нормализуем пустое значение в 1 (или оставляем пустым — здесь кладу 1)
    if (editTargetCount === '' || Number(editTargetCount) < 1) {
      setEditTargetCount('1');
    } else if (Number(editTargetCount) > 30) {
      setEditTargetCount('30');
    }
  }}
  placeholder="Например: 10"
  variant="outlined"
  InputLabelProps={{ shrink: Boolean(editTargetCount) }}
  inputProps={{
    min: 1,
    max: 30,
    inputMode: 'numeric',
    pattern: '[0-9]*',
    'aria-label': 'targetCount',
  }}
  sx={{
    mb: 1.5,
    '& .MuiInputLabel-root': {
      color: '#fff',
      opacity: 0.95,
      '&.Mui-focused': { color: '#fff' },
    },
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 1.5,
      '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.32)' },
      // Тонкая линия 1px при фокусе
      '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.9)', borderWidth: '1px' },

      // Скрываем визуальные спиннеры в WebKit
      '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
        WebkitAppearance: 'none',
        margin: 0,
      },
      // Для Firefox
      '& input[type=number]': {
        MozAppearance: 'textfield',
      },
    },
    '& .MuiOutlinedInput-input': {
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-x',
      '&:focus::placeholder': { opacity: 0 },
    },
    '& .MuiInputBase-root::-webkit-scrollbar': {
      height: 8,
      width: 8,
      background: 'transparent',
    },
    '& .MuiInputBase-root::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 8,
    },
    '& .MuiInputBase-root': {
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255,255,255,0.06) transparent',
    },
  }}
/>
          </DialogContent>

          <DialogActions
            sx={{
              px: 3,
              pb: 2,
              pt: 1,
              gap: 1,
            }}
          >
            <Button
              onClick={() => setEditModalOpen(false)}
              sx={{
                color: '#fff',
                textTransform: 'none',
                px: 2.2,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.24)',
                '&:hover': {
                  background: 'rgba(255,255,255,0.08)',
                },
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim()}
              variant="contained"
              sx={{
                textTransform: 'none',
                px: 2.6,
                borderRadius: 999,
                background: accentGradient,
                boxShadow: subtleGlow,
                '&:hover': {
                  background:
                    'linear-gradient(135deg, rgba(88,120,255,1), rgba(139,92,246,1))',
                },
                '&.Mui-disabled': {
                  background: 'rgba(255,255,255,0.14)',
                  color: 'rgba(255,255,255,0.6)',
                  boxShadow: 'none',
                },
              }}
            >
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>

        {/* Модалка нового уровня */}

{/* Модалка новых бейджей */}
<Dialog
  open={newBadgesModalOpen}
  onClose={handleCloseNewBadges}
  PaperProps={{
    sx: {
      background:
        'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${glassBorder}`,
      color: '#fff',
      borderRadius: 3,
      minWidth: { xs: '90vw', sm: 400 },
    },
  }}
>
  <DialogTitle
    sx={{
      fontSize: 20,
      fontWeight: 700,
      pb: 1,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    }}
  >
    <EmojiEventsIcon sx={{ color: '#fbbf24' }} />
    Новые достижения!
  </DialogTitle>
  <DialogContent sx={{ pt: 2 }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {dashboardData?.gamification?.badges?.new?.map((badge: Badge) => (
        <Card
          key={badge.id}
          sx={{
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 2,
            p: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              {badge.emoji}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                {badge.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {badge.description}
              </Typography>
            </Box>
          </Box>

          {/* ✅ Кнопка "Сделать целью" */}
          <Box sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant="contained"
              fullWidth
              disabled={goalSaving}
              onClick={() => handleSetGoalFromModal(badge)}
              sx={{
                textTransform: 'none',
                borderRadius: 999,
                // ✅ Если это УЖЕ текущая цель → бледная
                ...(currentGoalId === badge.id && {
                  background: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.18)',
                  },
                }),
                // ✅ Иначе → ЯРКАЯ
                ...(currentGoalId !== badge.id && {
                  background: accentGradient,
                  color: '#fff',
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(88,120,255,1), rgba(139,92,246,1))',
                  },
                }),
              }}
            >
              {currentGoalId === badge.id ? 'Уже цель' : 'Сделать целью'}
            </Button>
          </Box>
        </Card>
      ))}
    </Box>
  </DialogContent>
  <DialogActions sx={{ px: 3, pb: 2 }}>
    <Button
      onClick={handleCloseNewBadges}
      variant="contained"
      fullWidth
      sx={{
        textTransform: 'none',
        borderRadius: 999,
        background: accentGradient,
        boxShadow: subtleGlow,
        '&:hover': {
          background:
            'linear-gradient(135deg, rgba(88,120,255,1), rgba(139,92,246,1))',
        },
      }}
    >
      Отлично!
    </Button>
  </DialogActions>
</Dialog>

{/* Модалка всех бейджей */}
<Dialog
  open={allBadgesModalOpen}
  onClose={() => setAllBadgesModalOpen(false)}
  PaperProps={{
    sx: {
      background:
        'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${glassBorder}`,
      color: '#fff',
      borderRadius: 3,
      minWidth: { xs: '90vw', sm: 500 },
      maxHeight: '80vh',
    },
  }}
>
  <DialogTitle
    sx={{
      fontSize: 20,
      fontWeight: 700,
      pb: 1,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    Все достижения
  </DialogTitle>
  <DialogContent sx={{ pt: 2 }}>
    {(() => {
      const allBadges = dashboardData?.gamification?.badges?.all || [];
      const grouped = allBadges.reduce((acc, badge) => {
        if (!acc[badge.category]) acc[badge.category] = [];
        acc[badge.category].push(badge);
        return acc;
      }, {} as Record<string, Badge[]>);

      const categoryNames: Record<string, string> = {
        first_steps: 'Первые шаги',
        consistency: 'Постоянство',
        depth: 'Глубина',
        mastery: 'Мастерство',
      };

      return Object.entries(grouped).map(([category, badges]) => (
        <Box key={category} sx={{ mb: 2 }}>
          <Button
            fullWidth
            onClick={() => toggleCategory(category)}
            sx={{
              justifyContent: 'space-between',
              textTransform: 'none',
              color: '#fff',
              fontWeight: 600,
              mb: 1,
            }}
          >
            {categoryNames[category] || category}
            {expandedCategories[category] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Button>
          <Collapse in={expandedCategories[category]}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {badges.map((badge: Badge) => (
                <Card
                  key={badge.id}
                  sx={{
                    background: badge.unlocked
                      ? 'rgba(34,197,94,0.15)'
                      : 'rgba(255,255,255,0.04)',
                    border: badge.unlocked
                      ? '1px solid rgba(34,197,94,0.3)'
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    p: 1.5,
                    opacity: badge.unlocked ? 1 : 0.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        position: 'relative',
                      }}
                    >
                      {badge.unlocked ? (
                        badge.emoji
                      ) : (
                        <LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, color: '#fff' }}
                      >
                        {badge.name}
                      </Typography>

                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.7)' }}
                      >
                        {badge.description}
                      </Typography>

                      {/* unlockedAt */}
                      {badge.unlocked && badge.unlockedAt && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mt: 0.5 }}>
                          Открыто: {new Date(badge.unlockedAt).toLocaleDateString('ru-RU')}
                        </Typography>
                      )}

                      {/* Пин цели */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        {currentGoalId === badge.id ? (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={goalSaving}
                            onClick={handleUnpinGoal}
                            sx={{
                              textTransform: 'none',
                              borderRadius: 999,
                              color: '#fff',
                              borderColor: 'rgba(255,255,255,0.24)',
                            }}
                          >
                            Снять цель
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={goalSaving}
                            onClick={() => handlePinGoal(badge.id)}
                            sx={{
                              textTransform: 'none',
                              borderRadius: 999,
                              fontWeight: 600,
                              // ✅ ЗАКРЫТЫЙ (🔒) → ЯРКАЯ КНОПКА
                              ...(!badge.unlocked && {
                                background: 'linear-gradient(135deg, #5A78FF, #8B5CF6)',
                                color: '#fff',
                                boxShadow: '0 4px 12px rgba(90,120,255,0.4)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, rgba(88,120,255,1), rgba(139,92,246,1))',
                                },
                              }),
                              // ✅ ОТКРЫТЫЙ (✅) → СЕРАЯ КНОПКА
                              ...(badge.unlocked && {
                                background: 'rgba(255,255,255,0.12)',
                                color: 'rgba(255,255,255,0.6)',
                                border: '1px solid rgba(255,255,255,0.18)',
                                '&:hover': {
                                  background: 'rgba(255,255,255,0.18)',
                                },
                              }),
                            }}
                          >
                            Сделать целью
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Box>
          </Collapse>
        </Box>
      ));
    })()}
  </DialogContent>
  <DialogActions sx={{ px: 3, pb: 2 }}>
    <Button
      onClick={() => setAllBadgesModalOpen(false)}
      variant="contained"
      fullWidth
      sx={{
        textTransform: 'none',
        borderRadius: 999,
        background: accentGradient,
        boxShadow: subtleGlow,
        '&:hover': {
          background:
            'linear-gradient(135deg, rgba(88,120,255,1), rgba(139,92,246,1))',
        },
      }}
    >
      Закрыть
    </Button>
  </DialogActions>
</Dialog>

        <Modal
          open={newLevelModalOpen}
          onClose={() => {}}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              background:
                'linear-gradient(135deg, rgba(30,30,60,0.98), rgba(20,20,40,0.98))',
              backdropFilter: 'blur(20px)',
              borderRadius: 4,
              p: 4,
              maxWidth: 400,
              width: '90%',
              border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                fontSize: 80,
                mb: 2,
                animation: 'bounce 1s ease-in-out',
                '@keyframes bounce': {
                  '0%, 100%': { transform: 'translateY(0)' },
                  '50%': { transform: 'translateY(-20px)' },
                },
              }}
            >
              {newLevelData?.icon || '🎯'}
            </Box>

            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                mb: 1,
                background: accentGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Новый уровень!
            </Typography>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                mb: 1,
                color: '#fff',
              }}
            >
              {newLevelData?.name || 'Уровень'}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                mb: 3,
              }}
            >
              {newLevelData?.description || 'Вы достигли нового уровня!'}
            </Typography>

            <Button
              fullWidth
              variant="contained"
              onClick={async () => {
                setNewLevelModalOpen(false);

                try {
                  await fetch('/api/gamification/mark-level-seen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ level: newLevelData?.level }),
                  });
                } catch (err) {
                  console.error('Failed to mark level as seen:', err);
                }
              }}
              sx={{
                background: accentGradient,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                py: 1.5,
                borderRadius: 999,
                boxShadow: subtleGlow,
                '&:hover': {
                  background:
                    'linear-gradient(135deg, rgba(88,120,255,1), rgba(139,92,246,1))',
                },
              }}
            >
              Продолжить
            </Button>
          </Box>
        </Modal>
      </Box>
    </LocalizationProvider>
  );
}