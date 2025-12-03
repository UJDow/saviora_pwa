// src/features/insights/RecentInsightsGrid.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  useTheme,
  Avatar,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { Dream } from '../../utils/api';
import { getDreams, getDreamInsights, getDreamArtworksInsights } from '../../utils/api';
import { normalizeInsightsResponseWithSource, stringifyId } from './helpers';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ShareIcon from '@mui/icons-material/Share';

/* -----------------------
   Types
   ----------------------- */

type InsightWithTag = ReturnType<typeof normalizeInsightsResponseWithSource>[number];

type Props = {
  maxItems?: number;
  compact?: boolean;
};

/* -----------------------
   Component
   ----------------------- */

export default function RecentInsightsGrid({ maxItems = 12, compact = true }: Props) {
  const navigate = useNavigate();
  const theme = useTheme();
  const white = theme.palette.common.white;

  // немного увеличенный радиус (≈ +10%)
  const borderRadius = 2.2;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InsightWithTag[]>([]);
  const [dreamsMap, setDreamsMap] = useState<Record<string, Dream>>({});
  const [filter, setFilter] = useState<'all' | 'dream' | 'art'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [searchTerm, setSearchTerm] = useState('');

  const handleChangeFilter = (event: SelectChangeEvent) => {
    setFilter(event.target.value as 'all' | 'dream' | 'art');
  };

  const handleChangeSortBy = (event: SelectChangeEvent) => {
    setSortBy(event.target.value as 'newest' | 'oldest');
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const dreamsResp = await getDreams();
        const dreamsArray: Dream[] = Array.isArray(dreamsResp)
          ? dreamsResp
          : dreamsResp && Array.isArray((dreamsResp as any).items)
          ? (dreamsResp as any).items
          : [];

        const map: Record<string, Dream> = {};
        for (const d of dreamsArray) {
          const id = stringifyId((d as any).id);
          if (id) map[id] = d;
        }
        if (!mounted) return;
        setDreamsMap(map);

        const insightPromises: Promise<{ dreamId: string; insights: any[] }>[] = [];
        for (const d of dreamsArray) {
          const id = stringifyId((d as any).id);
          if (!id) continue;
          insightPromises.push(
            (async () => {
              try {
                const raw = await getDreamInsights(id);
                const arr = Array.isArray(raw) ? raw : raw && Array.isArray((raw as any).items) ? (raw as any).items : raw ?? [];
                return { dreamId: id, insights: arr };
              } catch {
                return { dreamId: id, insights: [] };
              }
            })(),
          );
          insightPromises.push(
            (async () => {
              try {
                const raw2 = await getDreamArtworksInsights(id);
                const arr2 = Array.isArray(raw2) ? raw2 : raw2 && Array.isArray((raw2 as any).items) ? (raw2 as any).items : raw2 ?? [];
                return { dreamId: id, insights: arr2 };
              } catch {
                return { dreamId: id, insights: [] };
              }
            })(),
          );
        }

        const settled = await Promise.allSettled(insightPromises);
        if (!mounted) return;

        const collected: InsightWithTag[] = [];
        for (const res of settled) {
          if (res.status !== 'fulfilled') continue;
          const payload = res.value;
          const dreamId = payload.dreamId;
          const arr = Array.isArray(payload.insights) ? payload.insights : [];

          const normalized = normalizeInsightsResponseWithSource(arr).map((insight) => ({
            ...insight,
            dreamId,
          }));

          collected.push(...normalized);
        }

        const dedup = new Map<string, InsightWithTag>();
        for (const t of collected) {
          const key = t.messageId || `${t.blockId ?? 'unknown'}-${t.createdAt}`;
          const prev = dedup.get(key);
          if (!prev) {
            dedup.set(key, t);
            continue;
          }
          const preferCurrent =
            (t.insightLiked ?? false) && !(prev.insightLiked ?? false)
              ? true
              : new Date(t.createdAt).getTime() > new Date(prev.createdAt).getTime();
          if (preferCurrent) dedup.set(key, t);
        }

        const all = Array.from(dedup.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        if (!mounted) return;
        setItems(all);
      } catch (err: any) {
        console.error('RecentInsightsGrid error', err);
        if (!mounted) return;
        setError(err?.message || 'Ошибка загрузки инсайтов');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredAndSortedItems = useMemo(() => {
    let currentItems = items.slice();

    if (filter !== 'all') {
      currentItems = currentItems.filter((item) => item.source === filter);
    }

    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentItems = currentItems.filter(
        (item) =>
          item.text.toLowerCase().includes(lowerCaseSearchTerm) ||
          (item.dreamId && (dreamsMap[item.dreamId]?.title ?? '').toLowerCase().includes(lowerCaseSearchTerm)),
      );
    }

    currentItems = [...currentItems].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return currentItems;
  }, [items, filter, searchTerm, sortBy, dreamsMap]);

  const handleClick = (ins: InsightWithTag) => {
    if (!ins.dreamId) return;
    const dreamId = ins.dreamId;
    if (ins.source === 'art') {
      let idx = 0;
      if (ins.blockId) {
        const match = ins.blockId.match(/artwork__(\d+)/);
        if (match) idx = parseInt(match[1], 10);
      }
      navigate(`/dreams/${dreamId}/artwork-chat/${idx}?messageId=${encodeURIComponent(ins.messageId)}`, {
        state: { highlightMessageId: ins.messageId },
      });
    } else {
      navigate(`/dreams/${dreamId}/chat?messageId=${encodeURIComponent(ins.messageId)}`, {
        state: { highlightMessageId: ins.messageId },
      });
    }
  };

  const formatted = useMemo(() => {
    return filteredAndSortedItems.map((it) => ({
      ...it,
      shortText: it.text.length > 160 ? it.text.slice(0, 160).trimEnd() + '…' : it.text,
      prettyDate: new Date(it.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }),
      dreamTitle: it.dreamId ? (dreamsMap[it.dreamId]?.title ?? '') : '',
    }));
  }, [filteredAndSortedItems, dreamsMap]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={20} sx={{ color: white }} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const columnCount = compact ? { xs: 1, sm: 2, md: 3, lg: 4 } : { xs: 1, sm: 2, md: 3 };
  const gap = compact ? 1 : 1.5;

  // glass PaperProps for dropdowns — white border, no hover/selected highlight
  const glassMenuPaper = {
    PaperProps: {
      sx: {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        color: white,
        border: '1px solid rgba(255,255,255,0.12)', // белая рамка
        backdropFilter: 'blur(8px)',
        borderRadius,
        // полностью отключаем hover/focus/selected визуалку внутри меню:
        '& .MuiMenuItem-root': {
          color: white,
          backgroundColor: 'transparent !important',
          outline: 'none',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: 'transparent !important',
          },
          '&:active': {
            backgroundColor: 'transparent !important',
          },
          '&:focus': {
            backgroundColor: 'transparent !important',
            outline: 'none',
            boxShadow: 'none',
          },
        },
        '& .MuiMenuItem-root.Mui-selected': {
          backgroundColor: 'transparent !important',
          color: white,
        },
        '& .MuiMenuItem-root.Mui-selected:focus': {
          backgroundColor: 'transparent !important',
        },
      },
    },
  };

  return (
    <Box>
      {/* Controls: two equal selects on top, search below spanning their combined width (adaptive) */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          mb: 2,
          gap: 1,
        }}
      >
        {/* Container controls width: full on xs; constrained on sm+ (min of 720px and 60vw) */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            width: { xs: '100%', sm: 'min(720px, 60vw)' },
            justifyContent: 'flex-end',
          }}
        >
          <FormControl size="small" sx={{ width: '50%' }}>
            <Select
              value={filter}
              onChange={handleChangeFilter}
              displayEmpty
              inputProps={{ 'aria-label': 'Фильтр инсайтов' }}
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                color: white,
                borderRadius,
                border: 'none', // Убрал рамку
                backdropFilter: 'blur(6px)',
                '& .MuiSelect-select': { py: 0.6, px: 1.25, color: white },
                '& .MuiSelect-icon': { color: white },
                // Убрал все hover/focus/active стили для самого Select
                '&.Mui-focused': { boxShadow: 'none', outline: 'none' },
                '&:focus': { outline: 'none' },
                '&:hover': { backgroundColor: 'transparent' },
                '&.Mui-active': { backgroundColor: 'transparent' },
              }}
              MenuProps={glassMenuPaper as any}
            >
              <MenuItem value="all" sx={{ color: white }}>Все</MenuItem>
              <MenuItem value="dream" sx={{ color: white }}>Сны</MenuItem>
              <MenuItem value="art" sx={{ color: white }}>Арт</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ width: '50%' }}>
            <Select
              value={sortBy}
              onChange={handleChangeSortBy}
              displayEmpty
              inputProps={{ 'aria-label': 'Сортировка инсайтов' }}
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                color: white,
                borderRadius,
                border: 'none', // Убрал рамку
                backdropFilter: 'blur(6px)',
                '& .MuiSelect-select': { py: 0.6, px: 1.25, display: 'flex', alignItems: 'center', gap: 1, color: white },
                '& .MuiSelect-icon': { color: white },
                // Убрал все hover/focus/active стили для самого Select
                '&.Mui-focused': { boxShadow: 'none', outline: 'none' },
                '&:focus': { outline: 'none' },
                '&:hover': { backgroundColor: 'transparent' },
                '&.Mui-active': { backgroundColor: 'transparent' },
              }}
              IconComponent={(props: any) => <SortIcon {...props} sx={{ color: white }} />}
              MenuProps={glassMenuPaper as any}
            >
              <MenuItem value="newest" sx={{ color: white }}>Сначала новые</MenuItem>
              <MenuItem value="oldest" sx={{ color: white }}>Сначала старые</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Search below — width equals container width (so equals sum of two selects) */}
        <Box sx={{ width: { xs: '100%', sm: 'min(720px, 60vw)' }, display: 'flex', justifyContent: 'flex-end' }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Поиск..."
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: white }} />
                </InputAdornment>
              ),
              sx: {
                borderRadius,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& input': { color: white, py: 0.6, px: 1.25 },
                '& input::placeholder': { color: 'rgba(255,255,255,0.6)' },
                '& .Mui-focused': { boxShadow: 'none', outline: 'none' },
                '&:focus': { outline: 'none' },
              },
            }}
            sx={{ width: '100%' }}
          />
        </Box>
      </Box>

      {/* Scrollable grid area with hidden scrollbar (glassmorph cards inside) */}
      <Box
        sx={{
          maxHeight: '60vh',
          overflowY: 'auto',
          px: 0,
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: gap,
            gridTemplateColumns: {
              xs: `repeat(${columnCount.xs}, 1fr)`,
              sm: `repeat(${columnCount.sm}, 1fr)`,
              md: `repeat(${columnCount.md}, 1fr)`,
              lg: columnCount.lg ? `repeat(${columnCount.lg}, 1fr)` : undefined,
            },
          }}
        >
          {formatted.length === 0 ? (
            <Box sx={{ gridColumn: '1/-1', py: 6, textAlign: 'center' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>По вашему запросу ничего не найдено.</Typography>
            </Box>
          ) : (
            formatted.map((it) => {
              const thumbUrl =
                ((it as any).thumbUrl as string | undefined) ??
                (it.dreamId ? ((dreamsMap[it.dreamId] as any)?.thumbnail as string | undefined) : undefined);

              const cardBg = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';

              return (
                <Card
                  key={it.messageId || `${it.blockId}-${it.createdAt}`}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'stretch',
                    bgcolor: cardBg,
                    color: white,
                    borderRadius,
                    border: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    overflow: 'hidden',
                    transition: 'transform .18s ease, box-shadow .18s ease',
                    boxShadow: '0 6px 18px rgba(2,6,23,0.08)',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: '0 18px 40px rgba(2,6,23,0.18)',
                    },
                  }}
                >
                  {/* Пастельная цветовая полоска слева */}
                  <Box
                    aria-hidden
                    sx={{
                      width: 6,
                      background: it.source === 'art'
                        ? 'linear-gradient(180deg, #a8e6cf, #6fb9d6)'
                        : 'linear-gradient(180deg, #f8cdda, #cbb4d4)',
                      flexShrink: 0,
                    }}
                  />

                  {/* Только миниатюра, без иконки S и даты */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1 }}>
                    {it.source === 'art' && thumbUrl ? (
                      <Avatar
                        src={thumbUrl}
                        alt={it.dreamTitle || 'Арт'}
                        variant="rounded"
                        sx={{
                          width: compact ? 52 : 64,
                          height: compact ? 52 : 64,
                          borderRadius: 1.5,
                          boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
                          bgcolor: 'transparent',
                        }}
                      />
                    ) : thumbUrl ? (
                      <Avatar
                        src={thumbUrl}
                        alt={it.dreamTitle || 'Сон'}
                        variant="rounded"
                        sx={{
                          width: compact ? 52 : 64,
                          height: compact ? 52 : 64,
                          borderRadius: 1.5,
                          boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
                          bgcolor: 'rgba(255,255,255,0.04)',
                        }}
                      />
                    ) : null}
                  </Box>

                  {/* Заменяем CardActionArea на Box с ролью button */}
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(it)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(it);
                      }
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      flex: 1,
                      p: compact ? 1 : 1.25,
                      textAlign: 'left',
                      gap: 1,
                      cursor: 'pointer',
                      outline: 'none',
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <CardContent sx={{ py: 0, px: 0, '&:last-child': { pb: 0 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: compact ? 13 : 14, color: white }}>
                          {it.dreamTitle || (it.source === 'art' ? 'Арт' : '')}
                        </Typography>

                        <Box sx={{ flex: 1 }} />

                        <Box
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.02)',
                            color: 'rgba(255,255,255,0.7)',
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: 12,
                            alignSelf: 'flex-start',
                          }}
                          aria-hidden
                        >
                          {new Date(it.createdAt).toLocaleDateString()}
                        </Box>
                      </Box>

                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: compact ? 13 : 14,
                          color: white,
                          display: '-webkit-box',
                          WebkitLineClamp: compact ? 2 : 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'normal',
                        }}
                      >
                        {it.shortText}
                      </Typography>

                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 0.5,
                            opacity: 0,
                            transform: 'translateY(4px)',
                            transition: 'opacity .14s ease, transform .14s ease',
                            pointerEvents: 'none',
                            [`${Card}:hover &`]: {
                              opacity: 1,
                              transform: 'translateY(0)',
                              pointerEvents: 'auto',
                            },
                          }}
                        >
                          <Tooltip title="Открыть">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleClick(it); }} aria-label="Открыть инсайт">
                              <OpenInNewIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.85)' }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Поделиться">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); /* share logic */ }} aria-label="Поделиться">
                              <ShareIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.85)' }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </Box>
                </Card>
              );
            })
          )}
        </Box>
      </Box>
    </Box>
  );
}