// MonthDashboardScreen.tsx
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
  Tooltip as MuiTooltip,
  IconButton,
  Chip,
  Skeleton,
  Tabs,
  Tab,
  Divider,
  TextField
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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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
  ResponsiveContainer
} from 'recharts';

// Типы
import type { DashboardDataFromServer, ProgressPoint } from 'src/features/dashboard/types';
type DashboardPayload = DashboardDataFromServer & Record<string, any>;

// Визуальные токены
const bgGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const glassBg = 'rgba(255, 255, 255, 0.10)';
const glassBorder = 'rgba(255, 255, 255, 0.20)';
const accentGradient = 'linear-gradient(135deg, rgba(88,120,255,0.95), rgba(139,92,246,0.95))';
const subtleGlow = '0 8px 30px rgba(139,92,246,0.12)';
const cardShadow = '0 8px 24px rgba(11,8,36,0.28)';

// ProgressSection
const ProgressSection: React.FC<{ score: number }> = ({ score }) => (
  <Box sx={{ width: '100%' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)' }}>Уровень вовлеченности</Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)' }}>{score}%</Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={score}
      sx={{
        height: 10,
        borderRadius: 6,
        bgcolor: 'rgba(255,255,255,0.04)',
        '& .MuiLinearProgress-bar': {
          borderRadius: 6,
          background: 'linear-gradient(90deg, rgba(88,120,255,0.95), rgba(139,92,246,0.95))'
        }
      }}
    />
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
      <Chip
        label={score > 70 ? 'Высокий' : score > 40 ? 'Средний' : 'Низкий'}
        size="small"
        sx={{
          fontWeight: 700,
          color: '#0b1020',
          background: score > 70 ? 'rgba(93, 255, 183, 0.95)' : score > 40 ? 'rgba(255, 205, 69, 0.95)' : 'rgba(255, 99, 132, 0.95)'
        }}
      />
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Последние данные</Typography>
    </Box>
  </Box>
);

// MonthDashboardScreen
export const MonthDashboardScreen: React.FC = () => {
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

  // periods: первый таб — Месяц (days: null -> сформируем month-дату на клиенте)
  const periods = [
    { label: 'Month', days: null },
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: '1y', days: 365 },
    { label: 'All', days: 0 }
  ];
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<number>(0); // default: Month

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

  // MetricCard
  const MetricCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    value: string | number;
    tooltip?: string;
    onClick?: () => void;
  }> = ({ icon, title, value, tooltip, onClick }) => (
    <Card
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ' || e.code === 'Space')) {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(12px) saturate(120%)',
        boxShadow: cardShadow,
        transition: 'transform .18s cubic-bezier(.16,.84,.38,1), box-shadow .18s',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': onClick ? {
          transform: 'translateY(-6px)',
          boxShadow: '0 14px 40px rgba(11,8,36,0.22)'
        } : {}
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2,
              color: '#fff',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              border: `1px solid rgba(255,255,255,0.03)`,
              boxShadow: 'inset 0 -6px 18px rgba(139,92,246,0.06)'
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: accentGradient,
                boxShadow: subtleGlow
              }}
            >
              {icon}
            </Box>
          </Box>

          <Typography variant="h6" component="div" sx={{ color: '#fff' }}>
            {value}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)' }}>
            {title}
          </Typography>
          {tooltip && (
            <MuiTooltip title={tooltip}>
              <IconButton size="small" aria-label={`${title}-help`} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                <TrendingUpIcon fontSize="small" />
              </IconButton>
            </MuiTooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  // BreakdownBar
  const BreakdownBar: React.FC<{ counts?: Record<string, number>, percents?: Record<string, number> }> = ({ counts = {}, percents = {} }) => {
    const order = ['interpreted', 'summarized', 'artworks'];
    const colors: Record<string, string> = {
      interpreted: 'rgba(93, 255, 183, 0.95)',
      summarized: 'rgba(255, 205, 69, 0.95)',
      artworks: 'rgba(139,92,246,0.95)'
    };
    const total = Object.values(counts).reduce((s, v) => s + (v || 0), 0) || 1;

    return (
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', height: 14, width: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: 8, overflow: 'hidden' }}>
          {order.map(k => {
            const value = counts[k] || 0;
            const pct = (typeof percents?.[k] === 'number') ? Math.round(percents[k]) : Math.round((value / total) * 100);
            return (
              <Box key={k} sx={{
                width: `${pct}%`,
                background: colors[k],
                display: pct > 0 ? 'block' : 'none'
              }} />
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          {order.map(k => (
            <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box sx={{ width: 10, height: 10, background: colors[k], borderRadius: 1 }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {k === 'interpreted' ? 'Проанализировано' : k === 'summarized' ? 'Резюме' : 'Арт-работы'}: <strong>{counts[k] ?? 0}</strong>
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  // helpers для анализа сна (клиентская фильтрация)
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

  // Fetch dashboard with period support
  const fetchDashboard = useCallback(async (days?: number | null) => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      // days === null -> request all => ?days=0 (worker treats days<=0 as all)
      let q = '';
      if (typeof days === 'number') {
        q = `?days=${days}`;
      } else if (days === null) {
        q = '?days=0';
      }

      const data = await request<DashboardPayload>(`/dashboard${q}`, {}, true);
      if ((data as any)?.error) {
        setDashboardError((data as any).message || 'Ошибка сервера');
        setDashboardData(null);
        setProgressHistory([]);
        return;
      }

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
      console.error('fetchDashboard error:', e);
      const msg = e && typeof e === 'object' ? (e.message ?? String(e)) : String(e);
      setDashboardError(msg || 'Ошибка загрузки данных');
      setDashboardData(null);
      setProgressHistory([]);
    } finally {
      setDashboardLoading(false);
    }
  }, [generateProgressHistory]);

  // load dreams list
  useEffect(() => {
    fetchDreams();
  }, [fetchDreams]);

  // dreamDates
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

  // initial load & on period change
  useEffect(() => {
    const sel = periods[selectedPeriodIdx];
    // For Month (days === null) request all data (so server history is available) but UI will compute month stats from dreamsHistory
    fetchDashboard(sel.days === null ? null : sel.days);
  }, [fetchDashboard, selectedPeriodIdx]);

  const selectedYear = selectedDate.getFullYear();

  const handleBackToMonth = () => setSelectedDreamDate(null);

  const computeDelta = (data?: DashboardPayload, hist?: ProgressPoint[]) => {
    if (!data) return undefined;
    if (typeof data.scoreDelta === 'number') return data.scoreDelta;
    if (hist && hist.length >= 2) {
      const last = hist[hist.length - 1].score;
      const prev = hist[hist.length - 2].score;
      return last - prev;
    }
    return 0;
  };

  const computeHighest = (data?: DashboardPayload, hist?: ProgressPoint[]) => {
    if (!data) return undefined;
    if (data.highestScore) return data.highestScore;
    if (data.highestRating) return data.highestRating;
    if (hist && hist.length > 0) {
      const best = hist.reduce((acc, p) => {
        const score = typeof p.score === 'number' ? p.score : -Infinity;
        if (acc.value === undefined || score > acc.value) {
          return { value: score, date: p.date };
        }
        return acc;
      }, { value: undefined as number | undefined, date: undefined as string | undefined } as any);
      return (best.value !== undefined && best.value !== -Infinity) ? best : undefined;
    }
    return undefined;
  };

  // ---------- Compute displayData: if Month tab selected, compute metrics from dreamsHistory filtered by selectedDate month ----------
  const displayDashboardData = useMemo(() => {
    if (!dashboardData) return null;

    const sel = periods[selectedPeriodIdx];
    if (sel.days !== null) {
      // period mode — show server data as-is
      return { dashboardData, progressHistory };
    }

    // month mode — compute month-specific metrics from dreamsHistory
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
    const monthlyBlocks = filtered.filter(hasBlocks).length; // blocks in selected month
    const interpretedPercent = totalDreams > 0 ? Math.round((interpretedCount / totalDreams) * 100) : 0;

    // derive a fallback score for month: use interpretedPercent as proxy (0-100)
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

    const breakdownCounts = {
      interpreted: interpretedCount,
      summarized: filtered.filter((d: any) => Boolean(d.dreamSummary)).length,
      artworks: artworksCount,
      dialogs: dialogDreamsCount
    };
    const totalForPct = Math.max(1, totalDreams);
    const breakdownPercent = {
      interpreted: Math.round((breakdownCounts.interpreted / totalForPct) * 100),
      summarized: Math.round((breakdownCounts.summarized / totalForPct) * 100),
      artworks: Math.round((breakdownCounts.artworks / totalForPct) * 100),
      dialogs: Math.round((breakdownCounts.dialogs / totalForPct) * 100)
    };

    // Merge into a copy of server's dashboardData but override month-specific fields
    const merged: DashboardPayload = {
      ...dashboardData,
      totalDreams,
      interpretedCount,
      interpretedPercent,
      artworksCount,
      dialogDreamsCount,
      monthlyBlocks,
      recentDreams,
      breakdownCounts,
      breakdownPercent,
      // prefer server improvementScore if present, else fallback to interpretedPercent
      score: dashboardData.score ?? dashboardData.improvementScore ?? fallbackScore,
      lastUpdated: dashboardData.lastUpdated
    };

    return { dashboardData: merged, progressHistory: monthHistory };
  }, [dashboardData, progressHistory, selectedPeriodIdx, selectedDate, dreamsHistory, generateProgressHistory]);

  const usedDashboard = displayDashboardData?.dashboardData ?? dashboardData;
  const usedHistory = displayDashboardData?.progressHistory ?? progressHistory;
  const fallbackScore = usedDashboard ? Math.round(usedDashboard.score ?? usedDashboard.improvementScore ?? 0) : 0;

  // helper to build navigation state for stats screens
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

  // render
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3, md: 4 },
        minHeight: '100vh',
        background: bgGradient,
        color: '#fff',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 1200 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/')}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.06)',
              background: 'transparent',
              '&:hover': { background: 'rgba(255,255,255,0.02)' }
            }}
            startIcon={<AccessTimeIcon />}
            disabled={loading}
          >
            Назад
          </Button>

          {!selectedDreamDate && !showYearView && (
            <Typography
              variant="h5"
              align="center"
              sx={{ cursor: 'pointer', userSelect: 'none', color: 'rgba(255,255,255,0.95)' }}
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
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Button
                variant="outlined"
                onClick={handleBackToMonth}
                startIcon={<AccessTimeIcon />}
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.06)' }}
              >
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
                // ensure Month tab is selected
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
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Button variant="outlined" onClick={() => setShowYearView(false)} startIcon={<AccessTimeIcon />} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.06)' }}>
                Назад к месяцу
              </Button>
            </Box>
          </>
        ) : (
          <>
            {/* Show calendar only when Month tab selected */}
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

            <Paper
              sx={{
                p: 3,
                mt: 4,
                borderRadius: 3,
                background: glassBg,
                backdropFilter: 'blur(14px) saturate(120%)',
                border: `1px solid ${glassBorder}`,
                boxShadow: cardShadow
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AutoGraphIcon />
                  <Typography variant="h6" sx={{ color: '#fff' }}>Дашборд статистики</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Tabs
                    value={selectedPeriodIdx}
                    onChange={(_, v) => setSelectedPeriodIdx(Number(v))}
                    textColor="inherit"
                    indicatorColor="primary"
                    sx={{ '.MuiTabs-flexContainer': { gap: 1 } }}
                  >
                    {periods.map((p, i) => (
                      <Tab
                        key={p.label}
                        value={i}
                        label={i === 0 ? selectedDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }) : p.label}
                        sx={{ color: 'rgba(255,255,255,0.9)' }}
                      />
                    ))}
                  </Tabs>

                  <Button
                    variant="outlined"
                    onClick={() => {
                      const sel = periods[selectedPeriodIdx];
                      fetchDashboard(sel.days === null ? null : sel.days);
                    }}
                    disabled={dashboardLoading}
                    startIcon={dashboardLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <RefreshIcon />}
                    sx={{
                      color: '#fff',
                      borderColor: 'rgba(255,255,255,0.06)',
                      background: 'transparent',
                      '&:hover': { background: 'rgba(255,255,255,0.02)' }
                    }}
                  >
                    Обновить
                  </Button>
                </Box>
              </Box>

              {dashboardLoading ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 320px' }, gap: 2, mb: 2 }}>
                  <Skeleton variant="rounded" height={180} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                  <Skeleton variant="rounded" height={180} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                  <Skeleton variant="rounded" height={100} sx={{ gridColumn: '1/-1', bgcolor: 'rgba(255,255,255,0.04)' }} />
                </Box>
              ) : dashboardError ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="error" gutterBottom>Ошибка загрузки данных</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }} gutterBottom>{dashboardError}</Typography>
                  <Button variant="contained" onClick={() => {
                    const sel = periods[selectedPeriodIdx];
                    fetchDashboard(sel.days === null ? null : sel.days);
                  }} startIcon={<RefreshIcon />} sx={{ mt: 2 }}>
                    Повторить
                  </Button>
                </Box>
              ) : usedDashboard ? (
                <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 320px' }, gap: 2, mb: 4 }}>
                    <Card sx={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box>
                              <Typography variant="h3" sx={{ fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
                                {fallbackScore}
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', ml: 1 }}>
                                  {(() => {
                                    const delta = computeDelta(usedDashboard, usedHistory);
                                    const positive = (delta ?? 0) > 0;
                                    const negative = (delta ?? 0) < 0;
                                    return delta !== undefined ? (
                                      <Chip
                                        icon={positive ? <ArrowUpwardIcon fontSize="small" /> : negative ? <ArrowDownwardIcon fontSize="small" /> : undefined}
                                        label={`${delta > 0 ? '+' : ''}${delta}`}
                                        size="small"
                                        sx={{
                                          ml: 1,
                                          background: positive ? 'rgba(93, 255, 183, 0.95)' : negative ? 'rgba(255, 99, 132, 0.95)' : 'rgba(255,255,255,0.06)',
                                          color: positive ? '#042012' : negative ? '#3b0000' : '#fff',
                                          fontWeight: 700
                                        }}
                                      />
                                    ) : null;
                                  })()}
                                  </Box>
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Оценка прогресса</Typography>
                            </Box>
                          </Box>

                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Last updated</Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                              {usedDashboard.lastUpdated ? (() => {
                                const d = new Date(usedDashboard.lastUpdated);
                                return isNaN(d.getTime()) ? String(usedDashboard.lastUpdated) : d.toLocaleString('ru-RU');
                              })() : ''}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3,1fr)' }, gap: 2, mt: 3 }}>
                          <MetricCard icon={<BedtimeIcon />} title="Всего снов" value={usedDashboard.totalDreams ?? 0}
                            onClick={() => navigate('/stats/totalDreams', { state: buildStatsState('total') })}
                          />
                          <MetricCard icon={<ChatIcon />} title="Диалогов с ботом" value={usedDashboard.dialogDreamsCount ?? 0}
                            onClick={() => navigate('/stats/dialogDreams', { state: buildStatsState('dialog') })}
                          />
                          <MetricCard icon={<CheckCircleIcon />} title="Проанализировано" value={`${usedDashboard.interpretedPercent ?? 0}%`}
                            onClick={() => navigate('/stats/interpreted', { state: buildStatsState('interpreted') })}
                          />
                          <MetricCard icon={<PaletteIcon />} title="Арт-работы" value={usedDashboard.artworksCount ?? 0}
                            onClick={() => navigate('/stats/artworks', { state: buildStatsState('artworks') })}
                          />
                          <MetricCard icon={<CalendarTodayIcon />} title="Ежедневная серия" value={`${usedDashboard.streak ?? 0} дней`}
                            onClick={() => navigate('/stats/streak', { state: buildStatsState('streak') })}
                          />
                          <MetricCard icon={<TrendingUpIcon />} title="Блоков за месяц" value={usedDashboard.monthlyBlocks ?? 0}
                            onClick={() => navigate('/stats/monthlyBlocks', { state: buildStatsState('monthlyBlocks') })}
                          />
                        </Box>
                      </CardContent>
                    </Card>

                    <Card
                      variant="outlined"
                      sx={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
                        backdropFilter: 'blur(12px) saturate(120%)',
                        border: `1px solid ${glassBorder}`,
                        boxShadow: cardShadow,
                        height: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Box sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mr: 2,
                            background: accentGradient,
                            boxShadow: subtleGlow,
                            color: '#fff'
                          }}>
                            <TrendingUpIcon />
                          </Box>
                          <Box>
                            <Typography variant="h6" sx={{ color: '#fff' }}>Оценка прогресса</Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                              {usedDashboard.interpretedCount ?? 0} проанализированных / {usedDashboard.totalDreams ?? 0} всего
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: { xs: 'block', md: 'flex' }, gap: 3 }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)' }}>Уровень вовлеченности</Typography>
                              <Typography variant="h5" sx={{ color: '#fff', mt: 1 }}>{fallbackScore} / 100</Typography>
                            </Box>

                            <Box sx={{ maxWidth: 420 }}>
                              <ProgressSection score={fallbackScore} />
                              <BreakdownBar counts={usedDashboard.breakdownCounts} percents={usedDashboard.breakdownPercent} />
                            </Box>
                          </Box>

                          <Box sx={{ width: { xs: '100%', md: 320 }, height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={usedHistory} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
                                <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.6)" />
                                <RechartsTooltip wrapperStyle={{ background: 'rgba(10,10,20,0.9)', border: 'none', color: '#fff' }} />
                                <Line type="monotone" dataKey="score" stroke="#8b5cf6" activeDot={{ r: 6 }} strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>

                            <Box sx={{ mt: 2 }}>
                              <Card sx={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
                                <CardContent>
                                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                                    Highest: {computeHighest(usedDashboard, usedHistory)?.value ?? (usedDashboard.highestScore?.value ?? usedDashboard.highestRating?.value ?? '-')}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                    {computeHighest(usedDashboard, usedHistory)?.date ?? (usedDashboard.highestScore?.date ?? usedDashboard.highestRating?.date ?? '')}
                                  </Typography>
                                </CardContent>
                              </Card>
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Нижняя часть: подсказка слева и Разбивка справа */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 360px' }, gap: 2 }}>
                    <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.02)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Box>
                          <Typography variant="h6">Списки снов</Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            Нажмите карточку выше, чтобы перейти на отдельный экран со списком снов. Передаются параметры периода/месяца для корректной фильтрации.
                          </Typography>
                        </Box>
                        <TextField placeholder="Поиск..." size="small" sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, width: 220 }} disabled />
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mb: 1 }} />

                      <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Для режима "Месяц" данные собираются по выбранному месяцу (локально). Для периодов (7/30/90/1y/All) — загружаются агрегированные данные с сервера.
                      </Typography>
                    </Paper>

                    <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.02)' }}>
                      <Typography variant="h6" sx={{ mb: 1 }}>Разбивка</Typography>
                      <BreakdownBar counts={usedDashboard.breakdownCounts} percents={usedDashboard.breakdownPercent} />
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2">Дополнительно</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Диалогов: {usedDashboard.dialogDreamsCount ?? 0} • Блоков (30d): {usedDashboard.monthlyBlocks ?? 0}
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Нет данных для отображения</Typography>
                  <Button variant="outlined" onClick={() => {
                    const sel = periods[selectedPeriodIdx];
                    fetchDashboard(sel.days === null ? null : sel.days);
                  }} sx={{ mt: 2, color: '#fff', borderColor: 'rgba(255,255,255,0.06)' }} startIcon={<RefreshIcon />}>Загрузить данные</Button>
                </Box>
              )}
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
};

export default MonthDashboardScreen;