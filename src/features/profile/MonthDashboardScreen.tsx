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
  Tabs,
  Tab,
  Divider,
  Avatar,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import ChatIcon from '@mui/icons-material/Chat';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import PaletteIcon from '@mui/icons-material/Palette';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FlagIcon from '@mui/icons-material/Flag';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { MonthView } from './calendar/MonthView';
import { YearView } from './calendar/YearView';
import { DreamsByDateScreen } from '../dreams/DreamsByDateScreen';
import { useNavigate } from 'react-router-dom';
import { useDreams } from '../dreams/useDreams';
import { request } from 'src/utils/api';
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

// Mood icons/constants (user-provided)
import MOODS from 'src/features/profile/mood/MoodIcons';
import type { DashboardDataFromServer, ProgressPoint } from 'src/features/dashboard/types';
type DashboardPayload = DashboardDataFromServer & Record<string, any>;

// ===== Dark glass palette (reverted) =====
const bgGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const glassBg = 'rgba(255, 255, 255, 0.06)';
const glassBorder = 'rgba(255, 255, 255, 0.10)';
const accentGradient = 'linear-gradient(135deg, rgba(88,120,255,0.95), rgba(139,92,246,0.95))';
const subtleGlow = '0 8px 30px rgba(139,92,246,0.08)';
const cardShadow = '0 8px 24px rgba(11,8,36,0.16)';
// ===========================================

const sumValues = (obj?: Record<string, any>): number => {
  if (!obj) return 0;
  return Object.values(obj).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
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
  const weights = { A: 0.20, B: 0.25, C: 0.18, D: 0.12, E: 0.10, F: 0.15 };
  const targetActivity = 20;
  const targetInsights = 8;
  const targetArtworkInteractions = 12;
  const targetDialogs = 10;
  const targetStreak = 14;

  const A_norm = Math.min(100, Math.round((d.activityCount / targetActivity) * 100));
  const B = Math.max(0, Math.min(100, Math.round(d.interpretedPct)));
  const C_norm = Math.min(100, Math.round((d.insightsCount / targetInsights) * 100));
  const D_norm = Math.min(100, Math.round((d.artworkInteractions / targetArtworkInteractions) * 100));
  const E_norm = Math.min(100, Math.round((d.dialogCount / targetDialogs) * 100));
  const F_norm = Math.min(100, Math.round((d.streakDays / targetStreak) * 100));

  const score = Math.round(
    weights.A * A_norm +
    weights.B * B +
    weights.C * C_norm +
    weights.D * D_norm +
    weights.E * E_norm +
    weights.F * F_norm
  );

  return {
    score,
    breakdown: {
      activity: { value: d.activityCount, normalized: A_norm, weight: weights.A },
      interpreted: { value: d.interpretedPct, normalized: B, weight: weights.B },
      insights: { value: d.insightsCount, normalized: C_norm, weight: weights.C },
      artwork: { value: d.artworkInteractions, normalized: D_norm, weight: weights.D },
      dialogs: { value: d.dialogCount, normalized: E_norm, weight: weights.E },
      streak: { value: d.streakDays, normalized: F_norm, weight: weights.F },
    }
  };
};

const EngagementCard: React.FC<{ details: EngagementDetails }> = ({ details }) => {
  const { score, breakdown } = useMemo(() => computeEngagement(details), [details]);

  return (
    <Card sx={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
      <CardContent sx={{ px: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff' }}>{score}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Оценка вовлечённости</Typography>
          </Box>
          <Box sx={{ width: 180 }}>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{
                height: 10,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #8b5cf6, #5b21b6)',
                }
              }}
            />
          </Box>
        </Box>

        <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          {[
            { key: 'activity', title: 'Активность', icon: <BedtimeIcon />, data: breakdown.activity, unit: 'снов' },
            { key: 'interpreted', title: 'Проанализировано', icon: <CheckCircleIcon />, data: breakdown.interpreted, unit: '%' },
            { key: 'insights', title: 'Инсайты', icon: <AutoGraphIcon />, data: breakdown.insights, unit: 'шт.' },
            { key: 'artwork', title: 'Арт-взаимодействия', icon: <PaletteIcon />, data: breakdown.artwork, unit: 'шт.' },
            { key: 'dialogs', title: 'Диалоги', icon: <ChatIcon />, data: breakdown.dialogs, unit: 'шт.' },
            { key: 'streak', title: 'Стрик', icon: <TrendingUpIcon />, data: breakdown.streak, unit: 'дн.' },
          ].map((m) => (
            <Box key={m.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}>{m.icon}</Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block' }}>{m.title}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
                      <Box sx={{ width: `${m.data.normalized}%`, height: '100%', background: 'linear-gradient(90deg,#8b5cf6,#5b21b6)' }} />
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ width: 36, textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>{m.data.value} {m.unit}</Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

// MicroGoalCard
type MicroGoal = {
  id: string;
  title: string;
  description?: string;
  progress: number;
  targetLabel?: string;
  dueDate?: string | null;
  isCompleted?: boolean;
};

const MicroGoalCard: React.FC<{
  goal: MicroGoal;
  onComplete?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onOpen?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}> = ({ goal, onComplete, onSnooze, onOpen, onEdit, onDelete }) => {
  const { id, title, description, progress = 0, targetLabel, dueDate, isCompleted } = goal;
  return (
    <Card
      sx={{
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        borderRadius: 12,
        boxShadow: cardShadow,
        overflow: 'hidden',
      }}
      variant="outlined"
    >
      <CardContent sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1 }}>
        <Box sx={{
          width: 52,
          height: 52,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isCompleted ? 'linear-gradient(90deg, #22c55e, #16a34a)' : accentGradient,
          boxShadow: subtleGlow,
          color: '#fff',
          flexShrink: 0
        }}>
          <CheckCircleIcon sx={{ fontSize: 20 }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{title}</Typography>
          {description && <Typography noWrap variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.7)' }}>{description}</Typography>}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={Math.max(0, Math.min(100, progress))}
                sx={{
                  height: 8,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  '& .MuiLinearProgress-bar': {
                    background: 'linear-gradient(90deg,#8b5cf6,#5b21b6)'
                  }
                }}
              />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5, display: 'block' }}>
                {targetLabel ? `${progress}% • ${targetLabel}` : `${progress}%`}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <IconButton size="small" onClick={() => onSnooze?.(id)} sx={{ color: 'rgba(255,255,255,0.9)' }} title="Отложить">
                <AccessTimeIcon fontSize="small" />
              </IconButton>

              <IconButton size="small" onClick={() => onOpen?.(id)} sx={{ color: 'rgba(255,255,255,0.9)' }} title="Открыть">
                <OpenInNewIcon fontSize="small" />
              </IconButton>

              <Button
                size="small"
                variant={isCompleted ? 'outlined' : 'contained'}
                onClick={() => onComplete?.(id)}
                sx={{
                  ml: 0.5,
                  textTransform: 'none',
                  bgcolor: isCompleted ? 'transparent' : accentGradient,
                  color: '#fff',
                  paddingX: 1.2,
                  paddingY: 0.6,
                  minWidth: 36,
                }}
              >
                {isCompleted ? 'Готово' : 'Сделать'}
              </Button>

              <IconButton size="small" onClick={() => onEdit?.(id)} sx={{ color: 'rgba(255,255,255,0.85)' }} title="Редактировать">
                <EditIcon fontSize="small" />
              </IconButton>

              <IconButton size="small" onClick={() => onDelete?.(id)} sx={{ color: 'rgba(220,38,38,0.85)' }} title="Удалить">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {dueDate && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5, display: 'block' }}>
              До: {new Date(dueDate).toLocaleDateString('ru-RU')}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const MetricTileCentered: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string | number;
  onClick?: () => void;
  highlighted?: boolean;
}> = ({ icon, title, value, onClick, highlighted = false }) => (
  <Card
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    sx={{
      cursor: onClick ? 'pointer' : 'default',
      minWidth: 100,
      maxWidth: 180,
      height: 76,
      background: highlighted ? accentGradient : 'rgba(255,255,255,0.04)',
      border: `1px solid rgba(255,255,255,0.08)`,
      backdropFilter: 'blur(12px)',
      boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 1
    }}
  >
    <CardContent sx={{ px: 1, py: 0.75, display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{
        width: 32,
        height: 32,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: highlighted ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'
      }}>
        <Box sx={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          {icon}
        </Box>
      </Box>

      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{value}</Typography>
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', lineHeight: 1.2 }}>{title}</Typography>
    </CardContent>
  </Card>
);

// Moods panel used only in Goals view
const MoodsPanelCompact: React.FC<{ moodCounts?: Record<string, number>, moodTotal?: number }> = ({ moodCounts = {}, moodTotal = 0 }) => {
  const counts = (moodCounts || {}) as Record<string, number>;
  const total = moodTotal || sumValues(counts) || 0;
  const moodList = MOODS.map(m => ({ ...m, cnt: counts[m.id] ?? 0, pct: total > 0 ? Math.round(((counts[m.id] ?? 0) / total) * 100) : 0 }))
    .filter(m => m.cnt > 0)
    .sort((a,b)=>b.cnt-a.cnt)
    .slice(0, 6);

  const renderMoodIcon = (icon: any) => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon as React.ReactElement, {
        style: { ...( (icon as any).props?.style || {} ), color: '#fff', fontSize: 18 },
        ...( (icon as any).props || {} )
      });
    }
    if (typeof icon === 'function' || typeof icon === 'object') {
      const IconComp = icon as React.ComponentType<any>;
      try {
        return <IconComp style={{ color: '#fff', fontSize: 18 }} />;
      } catch { return null; }
    }
    return icon;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="subtitle2" sx={{ color: '#fff' }}>Настроения</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {moodList.length === 0 ? <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>Нет данных</Typography> :
          moodList.map(m => (
            <Box key={m.id} sx={{ minWidth: 120, maxWidth: 220 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: m.color }}>{renderMoodIcon(m.icon)}</Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ color: '#fff', fontWeight: 700 }}>{m.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{m.cnt} • {m.pct}%</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 0.5 }}>
                <Box sx={{ height: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6, overflow: 'hidden' }}>
                  <Box sx={{ width: `${m.pct}%`, height: '100%', background: m.color }} />
                </Box>
              </Box>
            </Box>
          ))
        }
      </Box>
    </Box>
  );
};

// Helper: build ideal history (linear from first real point to target)
const buildIdealHistory = (real: ProgressPoint[], target = 100) => {
  if (!Array.isArray(real) || real.length === 0) return [];
  const start = typeof real[0].score === 'number' ? real[0].score : 0;
  const n = real.length;
  const step = (target - start) / Math.max(1, n - 1);
  return real.map((_, i) => Math.round(start + step * i));
};

// MAIN COMPONENT
export const MonthDashboardScreen: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { dreamsHistory = [], fetchDreams, loading } = useDreams();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dreamDates, setDreamDates] = useState<string[]>([]);
  const [showYearView, setShowYearView] = useState(false);
  const [selectedDreamDate, setSelectedDreamDate] = useState<string | null>(null);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressPoint[]>([]);

  const [viewTab, setViewTab] = useState<'dashboard' | 'goals'>('dashboard');

  const [goals, setGoals] = useState<MicroGoal[]>([
    { id: 'g-1', title: 'Записывать сны 5 дней подряд', description: 'Записывай каждый день', progress: 40, targetLabel: '2/5', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), isCompleted: false },
    { id: 'g-2', title: 'Добавить 10 тегов', description: 'Теги для лучшего поиска', progress: 10, targetLabel: '1/10', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), isCompleted: false },
    { id: 'g-3', title: 'Раз в неделю просматривать инсайты', progress: 60, targetLabel: '3/4', dueDate: null, isCompleted: false },
  ]);

  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<number>(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const periods = [
    { label: 'Month', days: null },
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: '1y', days: 365 },
    { label: 'All', days: 0 }
  ];

  const formatDateShort = (date: Date) =>
    date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

  const generateProgressHistory = useCallback((currentScore: number): ProgressPoint[] => {
    const history: ProgressPoint[] = [];
    const today = new Date();
    let prevScore = Math.round(currentScore);

    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      let score: number;

      if (offset === 0) {
        score = Math.round(currentScore);
      } else {
        const variation = Math.round((Math.random() * 10) - 5);
        score = Math.max(0, Math.min(100, prevScore + variation));
      }

      history.push({ date: formatDateShort(date), score });
      prevScore = score;
    }

    history[history.length - 1].score = Math.round(currentScore);
    return history;
  }, []);

  // helpers
  const toDate = (d: any) => {
    try {
      const raw = (d as any)?.date;
      if (typeof raw === 'number') return new Date(raw);
      const n = Number(raw);
      if (!Number.isNaN(n)) return new Date(n);
      return new Date(raw);
    } catch {
      return null;
    }
  };
  const hasBlocks = (d: any) => Array.isArray(d.blocks) && d.blocks.length > 0;
  const hasSimilarArtworks = (d: any) => Array.isArray(d.similarArtworks) && d.similarArtworks.length > 0;
  const hasInterpretation = (d: any) => Boolean(d.globalFinalInterpretation) || (Array.isArray(d.blocks) && d.blocks.some((b: any) => b.interpretation || b.interpretations));
  const probablyHasDialog = (d: any) => {
    if (Array.isArray(d.blocks) && d.blocks.some((b: any) => b.messages || b.lastTurns || b.role || b.chat || b.meta)) return true;
    if ((d as any).hasDialog === true) return true;
    if (typeof d.dreamText === 'string' && /assistant|bot|user|:/i.test(d.dreamText)) return true;
    return false;
  };

  const extractMoodId = (d: any): string | null => {
    if (!d) return null;
    if (typeof d.mood === 'string') return d.mood;
    if (typeof d.moodId === 'string') return d.moodId;
    if (typeof d.dayMood === 'string') return d.dayMood;
    if (d.mood && typeof d.mood === 'object' && typeof d.mood.id === 'string') return d.mood.id;
    if (d.meta && d.meta.mood && typeof d.meta.mood === 'string') return d.meta.mood;
    return null;
  };

  const extractInsightCounts = (d: any) => {
    let dreamInsights = 0;
    let artworkInsights = 0;

    if (!d) return { dreamInsights, artworkInsights };

    if (Array.isArray(d.insights)) {
      dreamInsights += d.insights.length;
    } else if (typeof d.insightsCount === 'number') {
      dreamInsights += d.insightsCount;
    } else if (typeof d.insights_count === 'number') {
      dreamInsights += d.insights_count;
    } else if (typeof d.insightsTotal === 'number') {
      dreamInsights += d.insightsTotal;
    } else if (typeof d.insights === 'string') {
      try {
        const parsed = JSON.parse(d.insights);
        if (Array.isArray(parsed)) dreamInsights += parsed.length;
      } catch {}
    }

    if (Array.isArray(d.similarArtworks)) {
      for (const art of d.similarArtworks) {
        if (!art) continue;
        if (Array.isArray(art.insights)) {
          artworkInsights += art.insights.length;
        } else if (typeof art.insightsCount === 'number') {
          artworkInsights += art.insightsCount;
        } else if (typeof art.insights_count === 'number') {
          artworkInsights += art.insights_count;
        } else if (typeof art === 'string') {
          try {
            const parsed = JSON.parse(art);
            if (Array.isArray(parsed?.insights)) artworkInsights += parsed.insights.length;
          } catch {}
        }
      }
    } else if (typeof d.similarArtworks === 'string') {
      try {
        const parsed = JSON.parse(d.similarArtworks);
        if (Array.isArray(parsed)) {
          for (const art of parsed) {
            if (Array.isArray(art?.insights)) artworkInsights += art.insights.length;
            else if (typeof art?.insightsCount === 'number') artworkInsights += art.insightsCount;
          }
        }
      } catch {}
    } else if (typeof d.artworkInsightsCount === 'number') {
      artworkInsights += d.artworkInsightsCount;
    } else if (typeof d.artwork_insights_count === 'number') {
      artworkInsights += d.artwork_insights_count;
    }

    return { dreamInsights, artworkInsights };
  };

  const normalizeDashboardServerPayload = (data: any): DashboardPayload => {
    if (!data || typeof data !== 'object') return data;

    const insightsDreamsCount = Number(
      data.insightsDreamsCount ??
      data.insights_dreams_count ??
      data.insights_count ??
      data.insightsTotal ??
      data.insights_total ??
      0
    ) || 0;

    const insightsArtworksCount = Number(
      data.insightsArtworksCount ??
      data.insights_artworks_count ??
      data.artworkInsightsCount ??
      data.artwork_insights_count ??
      data.artworks_insights_count ??
      0
    ) || 0;

    let moodCounts = data.moodCounts;
    if (typeof moodCounts === 'string') {
      try { moodCounts = JSON.parse(moodCounts); } catch { moodCounts = undefined; }
    }

    return {
      ...data,
      insightsDreamsCount,
      insightsArtworksCount,
      moodCounts,
      moodTotal: Number(data.moodTotal ?? sumValues(moodCounts) ?? 0) || 0
    };
  };

  const fetchDashboard = useCallback(async (days?: number | null) => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      let q = '';
      if (typeof days === 'number') {
        q = `?days=${days}`;
      } else if (days === null) {
        q = '?days=0';
      }

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
          date: (() => {
            try {
              return new Date(h.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
            } catch {
              return String(h.date);
            }
          })(),
          score: Math.round(h.score)
        }));
        setProgressHistory(hist);
      } else {
        const fallbackScore = Math.round((data.score ?? data.improvementScore ?? 0));
        setProgressHistory(generateProgressHistory(fallbackScore));
      }
    } catch (e: any) {
      const msg = e && typeof e === 'object' ? (e.message ?? String(e)) : String(e);
      setDashboardError(msg || 'Ошибка загрузки данных');
      setDashboardData(null);
      setProgressHistory([]);
    } finally {
      setDashboardLoading(false);
    }
  }, [generateProgressHistory]);

  useEffect(() => { fetchDreams(); }, [fetchDreams]);

  useEffect(() => {
    if (!Array.isArray(dreamsHistory) || dreamsHistory.length === 0) {
      setDreamDates([]);
      return;
    }
    const dates = dreamsHistory
      .map(d => {
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
    const sel = periods[selectedPeriodIdx];
    fetchDashboard(sel.days === null ? null : sel.days);
  }, [fetchDashboard, selectedPeriodIdx]);

  const selectedYear = selectedDate.getFullYear();
  const handleBackToMonth = () => setSelectedDreamDate(null);

  const displayDashboardData = useMemo(() => {
    if (!dashboardData) return null;

    const sel = periods[selectedPeriodIdx];
    if (sel.days !== null) {
      return { dashboardData, progressHistory };
    }

    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();

    const filtered = Array.isArray(dreamsHistory) ? dreamsHistory.filter((d: any) => {
      const dt = toDate(d);
      if (!dt) return false;
      return dt.getFullYear() === year && dt.getMonth() === month;
    }) : [];

    const totalDreams = filtered.length;
    const interpretedCount = filtered.filter(hasInterpretation).length;
    const artworksCount = filtered.filter(hasSimilarArtworks).length;
    const dialogDreamsCount = filtered.filter(probablyHasDialog).length;
    const monthlyBlocks = filtered.filter(hasBlocks).length;
    const interpretedPercent = totalDreams > 0 ? Math.round((interpretedCount / totalDreams) * 100) : 0;

    const fallbackScore = interpretedPercent;
    const monthHistory = generateProgressHistory(fallbackScore);

    const recentDreams = filtered
      .slice()
      .sort((a: any, b: any) => {
        const da = toDate(a)?.getTime() || 0;
        const db = toDate(b)?.getTime() || 0;
        return db - da;
      })
      .slice(0, 12)
      .map((d: any) => ({
        id: d.id,
        title: d.title ?? null,
        date: toDate(d)?.toISOString() ?? (d.date ? String(d.date) : '')
      }));

    // moods aggregated for month (used only in goals view)
    const moodCounts: Record<string, number> = {};
    let moodTotal = 0;
    filtered.forEach((d: any) => {
      const mid = extractMoodId(d);
      if (mid) {
        moodCounts[mid] = (moodCounts[mid] || 0) + 1;
        moodTotal++;
      }
    });

    // insights fallback
    let insightsDreamsCount = 0;
    let insightsArtworksCount = 0;
    filtered.forEach((d: any) => {
      const { dreamInsights, artworkInsights } = extractInsightCounts(d);
      insightsDreamsCount += dreamInsights;
      insightsArtworksCount += artworkInsights;
    });

    const merged: DashboardPayload = {
      ...dashboardData,
      totalDreams,
      interpretedCount,
      interpretedPercent,
      artworksCount,
      dialogDreamsCount,
      monthlyBlocks,
      recentDreams,
      moodCounts: dashboardData.moodCounts ?? moodCounts,
      moodTotal: dashboardData.moodTotal ?? moodTotal,
      insightsDreamsCount: dashboardData.insightsDreamsCount ?? insightsDreamsCount,
      insightsArtworksCount: dashboardData.insightsArtworksCount ?? insightsArtworksCount,
      score: dashboardData.score ?? dashboardData.improvementScore ?? fallbackScore,
      lastUpdated: dashboardData.lastUpdated
    };

    return { dashboardData: merged, progressHistory: monthHistory };
  }, [dashboardData, progressHistory, selectedPeriodIdx, selectedDate, dreamsHistory, generateProgressHistory]);

  const usedDashboard = displayDashboardData?.dashboardData ?? dashboardData;
  const usedHistory = displayDashboardData?.progressHistory ?? progressHistory;

  const buildStatsState = (metricKey: string) => {
    const sel = periods[selectedPeriodIdx];
    if (sel.days === null) {
      return {
        from: '/calendar/month',
        selectedDate: selectedDate.toISOString(),
        period: 'month',
        month: selectedDate.getMonth(),
        year: selectedDate.getFullYear(),
        metric: metricKey
      };
    } else {
      return {
        from: '/calendar/month',
        selectedDate: selectedDate.toISOString(),
        period: sel.label,
        days: sel.days,
        metric: metricKey
      };
    }
  };

  // goal handlers
  const handleCompleteGoal = (id: string) => setGoals(prev => prev.map(g => g.id === id ? { ...g, isCompleted: true, progress: 100 } : g));
  const handleSnoozeGoal = (id: string) => setGoals(prev => prev.map(g => {
    if (g.id !== id) return g;
    const nextDate = g.dueDate ? new Date(g.dueDate) : new Date();
    nextDate.setDate(nextDate.getDate() + 1);
    return { ...g, dueDate: nextDate.toISOString() };
  }));
  const handleOpenGoal = (id: string) => navigate(`/goals/${id}`);
  const handleEditGoal = (id: string) => navigate('/goals/edit', { state: { id } });
  const handleDeleteGoal = (id: string) => setConfirmDeleteId(id);
  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    setGoals(prev => prev.filter(g => g.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  };
  const cancelDelete = () => setConfirmDeleteId(null);

  const handleAddGoal = () => {
    const id = `g-${Date.now()}`;
    const newGoal: MicroGoal = {
      id,
      title: 'Новая цель',
      description: 'Опишите цель',
      progress: 0,
      targetLabel: '',
      dueDate: null,
      isCompleted: false
    };
    setGoals(prev => [newGoal, ...prev]);
  };

  // --- RENDER ---
  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: '100vh',
      background: bgGradient,
      color: '#fff',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <Box sx={{ width: '100%', maxWidth: 980 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button
            variant="text"
            onClick={() => navigate('/')}
            startIcon={<AccessTimeIcon />}
            sx={{ color: 'rgba(255,255,255,0.9)', textTransform: 'none' }}
            disabled={loading}
          >
            Назад
          </Button>

          {!selectedDreamDate && !showYearView && (
            <Typography
              variant="h6"
              align="center"
              sx={{ cursor: 'pointer', userSelect: 'none', color: '#fff', fontWeight: 700 }}
              onClick={() => setShowYearView(true)}
              title="Перейти к годовому обзору"
            >
              {selectedDate.getFullYear()}
            </Typography>
          )}

          <Box />
        </Box>

        {selectedDreamDate ? (
          <>
            <DreamsByDateScreen
              date={selectedDreamDate}
              onBack={handleBackToMonth}
              usePaper={false}
              dreams={dreamsHistory
                .filter(d => {
                  try {
                    return new Date((d as any).date).toLocaleDateString('ru-RU') === selectedDreamDate;
                  } catch {
                    return false;
                  }
                })
                .map(d => ({ ...(d as any), title: (d as any).title ?? undefined }))}
            />
            <Box sx={{ mt: 2 }}>
              <Button fullWidth variant="outlined" onClick={handleBackToMonth} startIcon={<AccessTimeIcon />} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}>
                Назад к месяцу
              </Button>
            </Box>
          </>
        ) : showYearView ? (
          <>
            <YearView
              dreamDates={dreamDates}
              selectedYear={selectedYear}
              onMonthClick={(monthDate: Date) => {
                setSelectedDate(monthDate);
                setShowYearView(false);
                setSelectedPeriodIdx(0);
              }}
              onBackToWeek={() => setShowYearView(false)}
              calendarStyles={{
                containerBg: 'rgba(245, 243, 255, 0.95)',
                tileBg: 'rgba(255,255,255,0.95)',
                dayColor: '#0b1220',
                dayMutedColor: 'rgba(11,18,32,0.35)',
                borderColor: 'rgba(11,18,32,0.06)',
                selectedGradient: 'linear-gradient(135deg,#C9B6FF,#9FB8FF)',
                hoverShadow: '0 8px 24px rgba(95,120,255,0.12)'
              }}
            />
            <Box sx={{ mt: 2 }}>
              <Button fullWidth variant="outlined" onClick={() => setShowYearView(false)} startIcon={<AccessTimeIcon />} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}>
                Назад к месяцу
              </Button>
            </Box>
          </>
        ) : (
          <>
            {periods[selectedPeriodIdx].days === null && (
              <MonthView
                dreamDates={dreamDates}
                selectedDate={selectedDate}
                onDateClick={(dateStr: string) => setSelectedDreamDate(dateStr)}
                onWeekClick={() => {}}
                onYearClick={() => setShowYearView(true)}
                onDateChange={setSelectedDate}
                onBackToWeek={() => {}}
                calendarStyles={{
                  containerBg: 'rgba(245, 243, 255, 0.95)',
                  tileBg: 'rgba(255,255,255,0.95)',
                  dayColor: '#0b1220',
                  dayMutedColor: 'rgba(11,18,32,0.35)',
                  borderColor: 'rgba(11,18,32,0.06)',
                  selectedGradient: 'linear-gradient(135deg,#C9B6FF,#9FB8FF)',
                  hoverShadow: '0 8px 24px rgba(95,120,255,0.12)'
                }}
              />
            )}

            <Paper sx={{
              p: 2,
              mt: 3,
              borderRadius: 14,
              background: glassBg,
              backdropFilter: 'blur(12px)',
              border: `1px solid ${glassBorder}`,
              boxShadow: cardShadow
            }}>
              {/* Top controls */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    aria-label="dashboard"
                    title="Дашборд"
                    onClick={() => setViewTab('dashboard')}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: viewTab === 'dashboard' ? accentGradient : 'transparent',
                      color: '#fff',
                      boxShadow: viewTab === 'dashboard' ? subtleGlow : 'none',
                      border: viewTab === 'dashboard' ? 'none' : '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <AutoGraphIcon />
                  </IconButton>

                  <IconButton
                    aria-label="goals"
                    title="Цели"
                    onClick={() => setViewTab('goals')}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: viewTab === 'goals' ? accentGradient : 'transparent',
                      color: '#fff',
                      boxShadow: viewTab === 'goals' ? subtleGlow : 'none',
                      border: viewTab === 'goals' ? 'none' : '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <FlagIcon />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tabs
                    value={selectedPeriodIdx}
                    onChange={(_, v) => setSelectedPeriodIdx(Number(v))}
                    textColor="inherit"
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ mr: 1, '& .MuiTab-root': { minWidth: 52, px: 1 } }}
                  >
                    {periods.map((p, i) => (
                      <Tab
                        key={p.label}
                        value={i}
                        label={i === 0 ? selectedDate.toLocaleString('ru-RU', { month: 'short', year: 'numeric' }) : p.label}
                        sx={{ color: 'rgba(255,255,255,0.9)', textTransform: 'none', fontWeight: 600 }}
                      />
                    ))}
                  </Tabs>

                  <IconButton
                    onClick={() => {
                      const sel = periods[selectedPeriodIdx];
                      fetchDashboard(sel.days === null ? null : sel.days);
                    }}
                    disabled={dashboardLoading}
                    sx={{ color: 'rgba(255,255,255,0.9)', display: { xs: 'none', sm: 'inline-flex' } }}
                  >
                    {dashboardLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <RefreshIcon />}
                  </IconButton>
                </Box>
              </Box>

              {/* Content */}
              {dashboardLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Skeleton variant="rounded" height={140} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 10 }} />
                  <Skeleton variant="rounded" height={110} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 10 }} />
                  <Skeleton variant="rounded" height={120} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 10 }} />
                </Box>
              ) : dashboardError ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography color="error" gutterBottom>Ошибка загрузки данных</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>{dashboardError}</Typography>
                  <Button variant="contained" onClick={() => {
                    const sel = periods[selectedPeriodIdx];
                    fetchDashboard(sel.days === null ? null : sel.days);
                  }} startIcon={<RefreshIcon />} sx={{ mt: 2 }}>
                    Повторить
                  </Button>
                </Box>
              ) : viewTab === 'dashboard' ? (
                // DASHBOARD: restored "Инсайты" tile; removed lastUpdated + recent dreams earlier
                usedDashboard ? (
                  <>
                    <Box sx={{ width: '100%', pb: 1 }}>
                      <Swiper
                        spaceBetween={10}
                        slidesPerView={2.2}
                        centeredSlides={false}
                        breakpoints={{
                          360: { slidesPerView: 2.4 },
                          420: { slidesPerView: 2.8 },
                          600: { slidesPerView: 3.4 },
                          900: { slidesPerView: 4.4 }
                        }}
                        style={{ padding: '8px 6px' }}
                      >
                        <SwiperSlide>
                          <MetricTileCentered
                            icon={<BedtimeIcon />}
                            title="Всего снов"
                            value={usedDashboard.totalDreams ?? 0}
                            onClick={() => navigate('/stats/totalDreams', { state: buildStatsState('total') })}
                          />
                        </SwiperSlide>

                        <SwiperSlide>
                          <MetricTileCentered
                            icon={<ChatIcon />}
                            title="Диалогов"
                            value={usedDashboard.dialogDreamsCount ?? 0}
                            onClick={() => navigate('/stats/dialogDreams', { state: buildStatsState('dialog') })}
                          />
                        </SwiperSlide>

                        <SwiperSlide>
                          <MetricTileCentered
                            icon={<CheckCircleIcon />}
                            title="Проанализировано"
                            value={`${usedDashboard.interpretedPercent ?? 0}%`}
                            onClick={() => navigate('/stats/interpreted', { state: buildStatsState('interpreted') })}
                          />
                        </SwiperSlide>

                        <SwiperSlide>
                          <MetricTileCentered
                            icon={<AutoGraphIcon />}
                            title="Инсайты"
                            value={( (usedDashboard.insightsDreamsCount ?? 0) + (usedDashboard.insightsArtworksCount ?? 0) )}
                            onClick={() => navigate('/stats/insights', { state: buildStatsState('insights') })}
                          />
                        </SwiperSlide>

                        <SwiperSlide>
                          <MetricTileCentered
                            icon={<PaletteIcon />}
                            title="Арт-работ"
                            value={usedDashboard.artworksCount ?? 0}
                            onClick={() => navigate('/stats/artworks', { state: buildStatsState('artworks') })}
                          />
                        </SwiperSlide>

                        <SwiperSlide>
                          <MetricTileCentered
                            icon={<CalendarTodayIcon />}
                            title="Стрик"
                            value={`${usedDashboard.streak ?? 0} дн.`}
                            onClick={() => navigate('/stats/streak', { state: buildStatsState('streak') })}
                          />
                        </SwiperSlide>

                        <SwiperSlide>
                          <MetricTileCentered
                            icon={<TrendingUpIcon />}
                            title="Блоков (30d)"
                            value={usedDashboard.monthlyBlocks ?? 0}
                            onClick={() => navigate('/stats/monthlyBlocks', { state: buildStatsState('monthlyBlocks') })}
                          />
                        </SwiperSlide>
                      </Swiper>
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr' }, gap: 2, mt: 2 }}>
                      <Card sx={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
                        <CardContent sx={{ px: 0 }}>
                          <EngagementCard
                            details={{
                              activityCount: usedDashboard.totalDreams ?? 0,
                              interpretedPct: usedDashboard.interpretedPercent ?? 0,
                              insightsCount: (usedDashboard.insightsDreamsCount ?? 0) + (usedDashboard.insightsArtworksCount ?? 0),
                              artworkInteractions: usedDashboard.artworksCount ?? 0,
                              dialogCount: usedDashboard.dialogDreamsCount ?? 0,
                              streakDays: usedDashboard.streak ?? 0,
                            }}
                          />
                        </CardContent>
                      </Card>
                    </Box>
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Нет данных для отображения</Typography>
                    <Button fullWidth variant="outlined" onClick={() => {
                      const sel = periods[selectedPeriodIdx];
                      fetchDashboard(sel.days === null ? null : sel.days);
                    }} sx={{ mt: 2, color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }} startIcon={<RefreshIcon />}>Загрузить данные</Button>
                  </Box>
                )
              ) : (
                // GOALS VIEW: graph + moods + goals list. No "Краткая разбивка".
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 360px' }, gap: 2 }}>
                  <Paper sx={{ p: 2, borderRadius: 12, background: 'transparent' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>Персональные цели</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Реальный прогресс vs идеальный</Typography>
                      </Box>

                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddGoal}
                        sx={{ bgcolor: accentGradient, color: '#fff', textTransform: 'none' }}
                      >
                        +1
                      </Button>
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mb: 1 }} />

                    <Box sx={{ height: 240 }}>
                      {Array.isArray(usedHistory) && usedHistory.length > 0 ? (
                        (() => {
                          const ideal = buildIdealHistory(usedHistory, 100);
                          const merged = usedHistory.map((d, i) => ({ ...d, ideal: ideal[i] ?? null }));
                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={merged} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
                                <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.6)" />
                                <RechartsTooltip wrapperStyle={{ background: 'rgba(10,10,20,0.9)', border: 'none', color: '#fff' }} />
                                <Legend verticalAlign="top" align="right" wrapperStyle={{ color: '#fff' }} />
                                <Line type="monotone" dataKey="score" name="Реал." stroke="#8b5cf6" activeDot={{ r: 6 }} strokeWidth={2} />
                                <Line type="monotone" dataKey="ideal" name="Идеал" stroke="#34d399" strokeDasharray="6 6" dot={false} strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          );
                        })()
                      ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Нет данных прогресса</Typography>
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>Цели</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 400, overflowY: 'auto', pr: 1 }}>
                        {goals.map(g => (
                          <MicroGoalCard
                            key={g.id}
                            goal={g}
                            onComplete={handleCompleteGoal}
                            onSnooze={handleSnoozeGoal}
                            onOpen={handleOpenGoal}
                            onEdit={handleEditGoal}
                            onDelete={handleDeleteGoal}
                          />
                        ))}
                        {goals.length === 0 && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>Целей пока нет — добавьте «+1»</Typography>}
                      </Box>
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      <Button variant="outlined" fullWidth onClick={() => navigate('/goals')} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}>
                        Все цели
                      </Button>
                    </Box>
                  </Paper>

                  <Box>
                    <Paper sx={{ p: 2, borderRadius: 12, background: glassBg, border: `1px solid ${glassBorder}` }}>
                      <MoodsPanelCompact moodCounts={usedDashboard?.moodCounts} moodTotal={usedDashboard?.moodTotal} />
                    </Paper>

                    <Box sx={{ mt: 2 }} />
                  </Box>
                </Box>
              )}
            </Paper>

            {/* floating refresh for mobile */}
            <Box sx={{
              position: { xs: 'fixed', md: 'fixed' },
              bottom: 18,
              right: 18,
              display: { xs: 'flex', md: 'none' },
              zIndex: 1400
            }}>
              <IconButton
                onClick={() => {
                  const sel = periods[selectedPeriodIdx];
                  fetchDashboard(sel.days === null ? null : sel.days);
                }}
                disabled={dashboardLoading}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: accentGradient,
                  color: '#fff',
                  boxShadow: subtleGlow,
                  '&:hover': { transform: 'translateY(-4px)' }
                }}
              >
                {dashboardLoading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : <RefreshIcon />}
              </IconButton>
            </Box>
          </>
        )}
      </Box>

      <Dialog open={Boolean(confirmDeleteId)} onClose={cancelDelete}>
        <DialogTitle>Удалить цель?</DialogTitle>
        <DialogContent>
          <Typography>Вы уверены, что хотите удалить эту цель? Действие нельзя отменить.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete}>Отмена</Button>
          <Button color="error" onClick={confirmDelete}>Удалить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MonthDashboardScreen;