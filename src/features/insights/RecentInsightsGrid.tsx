// src/features/insights/RecentInsightsGrid.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  useTheme,
  Avatar,
  Tooltip,
} from '@mui/material';
import type { Dream } from '../../utils/api';
import { getDreams, getDreamInsights, getDreamArtworksInsights } from '../../utils/api';

/* -----------------------
   Types
   ----------------------- */

type NormalizedInsight = {
  messageId: string;
  text: string;
  dreamId: string | null;
  blockId: string | null;
  createdAt: string;
  insightLiked?: boolean;
};

type InsightWithTag = NormalizedInsight & { tag: 'art' | 'dream' };

type Props = {
  maxItems?: number;
  compact?: boolean;
};

/* -----------------------
   Helpers (lenient)
   ----------------------- */

const stringifyId = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

const ensureIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value as any);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
};

const toBooleanFlag = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'да'].includes(s);
  }
  return false;
};

const extractPlainText = (node: unknown, seen = new WeakSet<object>()): string => {
  const out: string[] = [];
  const push = (s: string) => {
    const t = String(s || '').trim();
    if (!t) return;
    out.push(t);
  };
  const visit = (n: unknown) => {
    if (n == null) return;
    if (typeof n === 'string') return push(n);
    if (typeof n === 'number' || typeof n === 'boolean') return push(String(n));
    if (Array.isArray(n)) return n.forEach(visit);
    if (typeof n === 'object') {
      const obj = n as Record<string, unknown>;
      if (seen.has(obj)) return;
      seen.add(obj);
      const keys = ['text', 'content', 'message', 'summary', 'output', 'body', 'payload', 'data'];
      for (const k of keys) if (k in obj) visit(obj[k]);
      for (const v of Object.values(obj)) visit(v);
    }
  };
  visit(node);
  return Array.from(new Set(out)).join('\n');
};

const mapEntryToInsight = (entry: any, dreamId?: string | null): NormalizedInsight | null => {
  if (!entry) return null;
  const messageIdRaw = entry.messageId ?? entry.message_id ?? entry.id ?? entry?.message?.id ?? null;
  const textCandidate =
    entry.text ?? entry.content ?? entry.message ?? entry.summary ?? entry.output ?? entry.body ?? entry.payload ?? entry.data ?? null;
  const text = extractPlainText(textCandidate ?? entry);
  if (!messageIdRaw || !text) return null;
  const blockIdRaw = entry.blockId ?? entry.block_id ?? entry.block?.id ?? null;
  const createdRaw = entry.createdAt ?? entry.created_at ?? entry.timestamp ?? entry.ts ?? null;
  const liked = entry.insightLiked ?? entry.liked ?? entry.insightArtworksLiked ?? false;
  return {
    messageId: stringifyId(messageIdRaw),
    text,
    dreamId: dreamId ? stringifyId(dreamId) : null,
    blockId: blockIdRaw !== undefined && blockIdRaw !== null ? stringifyId(blockIdRaw) : null,
    createdAt: ensureIsoString(createdRaw),
    insightLiked: toBooleanFlag(liked),
  };
};

/* -----------------------
   Component
   ----------------------- */

export default function RecentInsightsGrid({ maxItems = 12, compact = true }: Props) {
  const navigate = useNavigate();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InsightWithTag[]>([]);
  const [dreamsMap, setDreamsMap] = useState<Record<string, Dream>>({});

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

        const limitedDreams = dreamsArray.slice(0, 30);

        const insightPromises: Promise<{ dreamId: string; insights: any[] }>[] = [];
        for (const d of limitedDreams) {
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

        const collected: NormalizedInsight[] = [];
        for (const res of settled) {
          if (res.status !== 'fulfilled') continue;
          const payload = res.value;
          const dreamId = payload.dreamId;
          const arr = Array.isArray(payload.insights) ? payload.insights : [];
          for (const entry of arr) {
            const normalized = mapEntryToInsight(entry, dreamId);
            if (!normalized) continue;
            collected.push(normalized);
          }
        }

        const tagged = collected.map((it): InsightWithTag => {
          const isArt =
            !!(it.blockId && it.blockId.toLowerCase().includes('artwork')) ||
            it.messageId.toLowerCase().includes('artwork') ||
            (it.blockId && /art/i.test(it.blockId));
          return { ...it, tag: isArt ? 'art' : 'dream' };
        });

        const dedup = new Map<string, InsightWithTag>();
        for (const t of tagged) {
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
        setItems(all.slice(0, maxItems));
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
  }, [maxItems]);

  const handleClick = (ins: InsightWithTag) => {
    if (!ins.dreamId) return;
    const dreamId = ins.dreamId;
    if (ins.tag === 'art') {
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
    return items.map((it) => ({
      ...it,
      shortText: it.text.length > 160 ? it.text.slice(0, 160).trimEnd() + '…' : it.text,
      prettyDate: new Date(it.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }),
      dreamTitle: it.dreamId ? (dreamsMap[it.dreamId]?.title ?? '') : '',
    }));
  }, [items, dreamsMap]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!formatted.length) {
    return <Typography color="text.secondary">Пока нет последних инсайтов.</Typography>;
  }

  // responsive grid layout
  const columnCount = compact ? { xs: 1, sm: 2, md: 3, lg: 4 } : { xs: 1, sm: 2, md: 3 };
  const gap = compact ? 1 : 1.5;

  return (
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
      {formatted.map((it) => {
        const tagColor = it.tag === 'art' ? 'secondary' : 'default';
        return (
          <Card
            key={it.messageId}
            elevation={0}
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#fff',
              borderRadius: 2,
              border: `1px solid rgba(0,0,0,0.06)`,
            }}
          >
            <CardActionArea
              onClick={() => handleClick(it as InsightWithTag)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick(it as InsightWithTag);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: compact ? 1 : 1.25,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pr: 1 }}>
                <Tooltip title={it.dreamTitle || 'Сон'}>
                  <Avatar sx={{ width: compact ? 40 : 48, height: compact ? 40 : 48, bgcolor: 'rgba(88,120,255,0.12)', color: 'rgba(88,120,255,0.95)' }}>
                    {it.dreamTitle ? it.dreamTitle.slice(0, 1).toUpperCase() : 'S'}
                  </Avatar>
                </Tooltip>
                <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  {it.prettyDate}
                </Typography>
              </Box>

              <CardContent sx={{ py: 0, px: 0, '&:last-child': { pb: 0 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={it.tag.toUpperCase()}
                    size="small"
                    color={tagColor as any}
                    sx={{ fontWeight: 700, height: 22 }}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: compact ? 13 : 14 }}>
                    {it.dreamTitle || (it.dreamId ? 'Сон' : '—')}
                  </Typography>
                </Box>

                <Typography
                  variant="body2"
                  sx={{
                    fontSize: compact ? 13 : 14,
                    color: 'text.primary',
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

                <Box sx={{ mt: 0.75, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {it.insightLiked ? '★' : ''}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {new Date(it.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}