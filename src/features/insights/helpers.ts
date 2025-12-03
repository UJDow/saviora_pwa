// src/features/insights/helpers.ts
/* Shared helpers for insights normalization and utilities */

export type EnrichedDreamInsight = {
  messageId: string;
  text: string;
  dreamId: string | null;
  blockId: string | null;
  createdAt: string;
  insightLiked?: boolean;
  meta?: Record<string, any>;
};

// 🔥 Новый тип с полем source
export type EnrichedDreamInsightWithSource = EnrichedDreamInsight & {
  source: 'dream' | 'art';
};

export const stringifyId = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

export const ensureIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value as any);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
};

export const toBooleanFlag = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number(value) === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'да'].includes(normalized);
  }
  return false;
};

export function extractPlainText(value: unknown, seen = new WeakSet<object>()): string {
  const fragments: string[] = [];

  // push accepts unknown and coerces to string safely
  const push = (str: unknown) => {
    const trimmed = String(str ?? '').trim();
    if (!trimmed) return;
    if (!fragments.includes(trimmed)) fragments.push(trimmed);
  };

  const visit = (node: unknown) => {
    if (node == null) return;
    const type = typeof node;

    if (type === 'string') {
      push(node);
      return;
    }
    if (type === 'number' || type === 'boolean' || type === 'bigint') {
      push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (type === 'object') {
      const obj = node as Record<string, unknown>;
      if (seen.has(obj)) return;
      seen.add(obj);

      const priorityKeys = [
        'text',
        'content',
        'message',
        'summary',
        'output',
        'outputText',
        'chunks',
        'parts',
        'messages',
        'data',
        'value',
        'response',
        'body',
        'payload',
        'suggestion',
        'details',
        'title',
        'desc',
      ];

      for (const key of priorityKeys) {
        if (key in obj) visit(obj[key]);
      }

      for (const v of Object.values(obj)) {
        if (typeof v === 'string') push(v);
        else if (typeof v === 'object') visit(v);
      }
    }
  };

  visit(value);
  return fragments.join('\n');
}

export const parseMetaObject = (raw: unknown): Record<string, any> => {
  if (!raw || typeof raw !== 'object') {
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {};
      } catch {
        return {};
      }
    }
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
};

export const normalizeInsightMeta = (entry: any): Record<string, any> => {
  const primaryMeta = parseMetaObject(entry.meta);
  const fallbackMeta = parseMetaObject(entry.metadata);

  const meta: Record<string, any> = {
    ...fallbackMeta,
    ...primaryMeta,
  };

  const textCandidate = extractPlainText(
    meta.text ??
      meta.content ??
      meta.response ??
      meta.output ??
      meta.body ??
      entry.text ??
      entry.content ??
      entry.message ??
      entry.summary,
  );

  if (textCandidate) meta.text = textCandidate;

  const likedCandidate =
    meta.insightLiked ??
    entry.insightLiked ??
    entry.liked ??
    entry.favorite ??
    entry.isInsight ??
    entry.isFavorite;

  meta.insightLiked = toBooleanFlag(likedCandidate);

  return meta;
};

export const extractArrayFromPayload = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const preferredKeys = ['insights', 'items', 'data', 'results', 'records', 'messages', 'rows'];
  const visited = new Set<object>();
  const queue: unknown[] = [payload];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if (Array.isArray(current)) return current;
    if (typeof current !== 'object') continue;

    const obj = current as Record<string, unknown>;
    if (visited.has(obj)) continue;
    visited.add(obj);

    for (const key of preferredKeys) {
      if (key in obj) queue.unshift(obj[key]);
    }

    for (const v of Object.values(obj)) queue.push(v);
  }

  return [];
};

export const mapEntryToInsight = (entry: any, dreamId?: string | null): EnrichedDreamInsight | null => {
  if (!entry || typeof entry !== 'object') return null;

  const meta = normalizeInsightMeta(entry);

  const messageIdRaw =
    entry.messageId ??
    entry.message_id ??
    entry.id ??
    entry.message?.id ??
    meta.messageId ??
    meta.message_id ??
    null;

  const text = extractPlainText(
    entry.text ??
      entry.content ??
      entry.message ??
      entry.summary ??
      meta.text ??
      meta.content ??
      meta.response ??
      meta.output ??
      meta.data ??
      meta.body ??
      '',
  );

  if (!messageIdRaw || !text) return null;

  const blockIdRaw =
    entry.blockId ??
    entry.block_id ??
    entry.block?.id ??
    meta.blockId ??
    meta.block_id ??
    null;

  const createdRaw =
    entry.createdAt ??
    entry.created_at ??
    entry.timestamp ??
    meta.createdAt ??
    meta.created_at ??
    meta.timestamp ??
    null;

  const insightLiked = meta.insightLiked ?? false;

  return {
    messageId: stringifyId(messageIdRaw),
    text,
    dreamId: dreamId ?? null,
    blockId: blockIdRaw !== undefined && blockIdRaw !== null ? stringifyId(blockIdRaw) : null,
    createdAt: ensureIsoString(createdRaw),
    insightLiked,
    meta,
  };
};

// 🔥 Новая функция: нормализация с определением source
export const normalizeInsightsResponseWithSource = (payload: unknown): EnrichedDreamInsightWithSource[] => {
  const rawEntries = extractArrayFromPayload(payload);
  const mapped = rawEntries
    .map((entry) => mapEntryToInsight(entry))
    .filter((e): e is EnrichedDreamInsight => Boolean(e));

  const enriched = mapped.map((insight) => {
    const blockId = insight.blockId ?? '';
    const meta = insight.meta ?? {};

    const source =
      blockId.startsWith('artwork__') ||
      meta.kind === 'art_interpretation' ||
      meta.insightArtworksLiked
        ? 'art'
        : 'dream';

    return {
      ...insight,
      source,
    } as EnrichedDreamInsightWithSource;
  });

  const deduped = new Map<string, EnrichedDreamInsightWithSource>();
  enriched.forEach((ins) => {
    const key = ins.messageId || `${ins.blockId ?? 'unknown'}-${ins.createdAt}`;
    const prev = deduped.get(key);
    if (!prev) {
      deduped.set(key, ins);
      return;
    }
    const preferCurrent =
      (ins.insightLiked ?? false) && !(prev.insightLiked ?? false)
        ? true
        : new Date(ins.createdAt).getTime() > new Date(prev.createdAt).getTime();
    if (preferCurrent) {
      deduped.set(key, { ...ins, meta: { ...(prev.meta ?? {}), ...(ins.meta ?? {}) } });
    }
  });

  return Array.from(deduped.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

// ⚠️ Устаревшая функция — оставлена для совместимости
export const normalizeInsightsResponse = (payload: unknown): EnrichedDreamInsight[] => {
  return normalizeInsightsResponseWithSource(payload);
};

export const normalizeDreamsResponse = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const key of ['items', 'data', 'results', 'records', 'dreams']) {
      const maybe = (payload as any)[key];
      if (Array.isArray(maybe)) return maybe;
    }
  }
  return [];
};

export const formatDateTimeRu = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU');
};

export function getArtworkIndexFromBlockId(blockId?: string | null, messageId?: string | null): number {
  const candidates = [blockId, messageId].filter(Boolean).map(String);
  for (const c of candidates) {
    const m = c.match(/(?:artwork__|block_art__|artwork-|art__)?(?:.*?__)?(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) return n;
    }
    const m2 = c.match(/(\d+)$/);
    if (m2) {
      const n = parseInt(m2[1], 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}