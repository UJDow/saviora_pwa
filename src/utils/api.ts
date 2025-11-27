// src/utils/api.ts
const API_URL = import.meta.env.VITE_API_URL as string;

// === ТИПЫ ===

export interface SimilarArtwork {
  title: string;
  author: string;
  desc: string;
  value?: string; // url картинки, если есть
  type?: string;  // тип блока
}

export type FindSimilarArtworksResponse =
  | { similarArtworks: SimilarArtwork[] }
  | { error: string; message?: string };

export interface User {
  email: string;
  trialDaysLeft: number;
}

export interface Dream {
  id: string;
  dreamText: string;
  title?: string | null;
  date: number;
  blocks?: any[];
  globalFinalInterpretation?: string | null;
  dreamSummary?: string | null;
  autoSummary?: string | null;
  similarArtworks?: any[];
  category?: string | null;
  context?: string | null;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageMeta {
  kind?: string;
  blockId?: string;
  insightLiked?: boolean;
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  meta?: ChatMessageMeta;
  createdAt: string;
  insightLiked?: boolean;
}

export interface DreamInsight {
  messageId: string;
  text: string;
  createdAt: string;
  blockId: string | null;
  insightLiked?: boolean;
  insightArtworksLiked?: boolean;
  meta?: Record<string, unknown>;
}

// === БАЗОВЫЙ ЗАПРОС ===

export async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (withAuth) {
    const token = localStorage.getItem('saviora_jwt');
    if (token && token !== 'null' && token !== 'undefined') {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      headers.delete('Authorization');
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    throw new Error(data.error || `Ошибка запроса: ${res.status}`);
  }
  return data as T;
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

const normalizeCreatedAt = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
};

const normalizeMeta = (meta: unknown): ChatMessageMeta | undefined => {
  if (meta == null || meta === '') {
    return undefined;
  }

  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      return parsed && typeof parsed === 'object' ? (parsed as ChatMessageMeta) : undefined;
    } catch {
      return undefined;
    }
  }

  if (typeof meta === 'object') {
    return meta as ChatMessageMeta;
  }

  return undefined;
};

const mapChatMessage = (message: any): ChatMessage => {
  const normalizedMeta = normalizeMeta(message.meta);
  const insightLiked = Boolean(normalizedMeta?.insightLiked ?? message.insightLiked);

  return {
    id: String(message.id),
    role: message.role as ChatRole,
    content: message.content,
    createdAt: normalizeCreatedAt(message.createdAt ?? message.created_at),
    meta: normalizedMeta,
    insightLiked,
  };
};

// === АВТОРИЗАЦИЯ ===

export const login = (email: string, password: string) =>
  request<{ token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const register = (email: string, password: string) =>
  request<{ success: boolean }>('/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const getMe = () =>
  request<User>('/me', {}, true);

// === DREAMS CRUD ===

export const getDreams = () =>
  request<Dream[]>('/dreams', {}, true);

export const getDream = (id: string) =>
  request<Dream>(`/dreams/${id}`, {}, true);

export const addDream = (
  dreamText: string,
  title?: string | null,
  category?: string | null,
  blocks: any[] = [],
  globalFinalInterpretation: string | null = null,
  dreamSummary: string | null = null,
  similarArtworks: any[] = []
) =>
  request<Dream>(
    '/dreams',
    {
      method: 'POST',
      body: JSON.stringify({
        dreamText,
        title: title || null,
        category: category || null,
        blocks,
        globalFinalInterpretation,
        dreamSummary,
        similarArtworks,
      }),
    },
    true
  );

export const updateDream = (
  id: string,
  dreamText: string,
  title?: string | null,
  blocks?: any[],
  globalFinalInterpretation?: string | null,
  dreamSummary?: string | null,
  similarArtworks?: any[],
  category?: string | null,
  date?: number
) =>
  request<Dream>(
    `/dreams/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        dreamText,
        title: title ?? null,
        blocks: blocks ?? [],
        globalFinalInterpretation: globalFinalInterpretation ?? null,
        dreamSummary: dreamSummary ?? null,
        similarArtworks: similarArtworks ?? [],
        category: category ?? null,
        ...(typeof date === 'number' ? { date } : {}),
      }),
    },
    true
  );

export const deleteDream = (id: string) =>
  request<{ success: boolean }>(`/dreams/${id}`, {
    method: 'DELETE',
  }, true);

// === АНАЛИТИКА И ГЕНЕРАЦИЯ ===

export const analyzeDream = (
  blockText: string,
  lastTurns?: any[],
  extraSystemPrompt?: string,
  dreamId?: string,
  blockId?: string,
  dreamSummary?: string | null,
  autoSummary?: string | null
) =>
  request<any>('/analyze', {
    method: 'POST',
    body: JSON.stringify({
      blockText,
      lastTurns: lastTurns || [],
      extraSystemPrompt,
      dreamId,
      blockId,
      dreamSummary,
      autoSummary,
    }),
  }, true);

export const findSimilarArtworks = (
  dreamText: string,
  globalFinalInterpretation?: string,
  blockInterpretations?: string
) =>
  request<FindSimilarArtworksResponse>('/find_similar', {
    method: 'POST',
    body: JSON.stringify({
      dreamText,
      globalFinalInterpretation,
      blockInterpretations,
    }),
  }, true);

export const generateAutoSummary = (dreamId: string, dreamText: string) =>
  request<{ success: boolean; autoSummary: string }>('/generate_auto_summary', {
    method: 'POST',
    body: JSON.stringify({ dreamId, dreamText }),
  }, true);

export const getChat = (dreamId: string, blockId: string) =>
  request<{ messages: any[] }>(
    `/chat?dreamId=${encodeURIComponent(dreamId)}&blockId=${encodeURIComponent(blockId)}`,
    {},
    true
  ).then(({ messages }) => ({
    messages: messages.map(mapChatMessage),
  }));

export const appendChat = (params: {
  id?: string;
  dreamId: string;
  blockId: string;
  role: ChatRole;
  content: string;
  meta?: ChatMessageMeta;
}) =>
  request<any>(
    '/chat',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    true
  ).then(mapChatMessage);

export const clearChat = (dreamId: string, blockId: string) =>
  request<{ success: boolean }>(
    `/chat?dreamId=${encodeURIComponent(dreamId)}&blockId=${encodeURIComponent(blockId)}`,
    { method: 'DELETE' },
    true
  );

export const interpretBlock = (
  blockText: string,
  dreamId?: string,
  blockId?: string,
  dreamSummary?: string | null,
  autoSummary?: string | null
) =>
  request<{ interpretation: string; isBlockInterpretation?: boolean }>(
    '/interpret_block',
    {
      method: 'POST',
      body: JSON.stringify({ 
        blockText, 
        dreamId, 
        blockId,
        dreamSummary,
        autoSummary,
      }),
    },
    true
  );

export const interpretFinal = (
  dreamText: string,
  blocks?: any[],
  dreamId?: string
) =>
  request<{ interpretation: string }>(
    '/interpret_final',
    {
      method: 'POST',
      body: JSON.stringify({ dreamText, blocks, dreamId }),
    },
    true
  );

// === ИНСАЙТЫ ===

/**
 * Лайк/дислайк сообщения.
 * @param dreamId ID сна
 * @param messageId ID сообщения
 * @param liked true/false
 * @param blockId (опционально) ID блока (например artwork)
 */

export const toggleMessageLike = (
  dreamId: string,
  messageId: string,
  liked: boolean,
  blockId?: string // ← новый параметр
) =>
  request<any>(
    `/dreams/${encodeURIComponent(dreamId)}/messages/${encodeURIComponent(messageId)}/like`,
    {
      method: 'PUT',
      body: JSON.stringify({ liked, blockId }), // ← передаём blockId
    },
    true
  ).then(mapChatMessage);

export const getDreamInsights = (
  dreamId: string,
  opts?: { metaKey?: 'insightArtworksLiked' | 'insightLiked' }
) => {
  const q = opts?.metaKey ? `?metaKey=${encodeURIComponent(opts.metaKey)}` : '';
  return request<{ insights: DreamInsight[] }>(
    `/dreams/${encodeURIComponent(dreamId)}/insights${q}`,
    {},
    true
  ).then(({ insights }) => insights);
};

// Удобный alias для запроса только artwork-инсайтов
export const getDreamArtworksInsights = (dreamId: string) =>
  getDreamInsights(dreamId, { metaKey: 'insightArtworksLiked' });

export const toggleArtworkInsight = (
  dreamId: string,
  messageId: string,
  liked: boolean,
  blockId?: string
) =>
  request<any>(
    `/dreams/${encodeURIComponent(dreamId)}/messages/${encodeURIComponent(messageId)}/artwork_like`,
    {
      method: 'PUT',
      body: JSON.stringify({ liked, blockId }),
    },
    true
  ).then(mapChatMessage);

// === MOOD API ===

export const getMoodForDate = (dateStr: string) =>
  request<{ context?: string }>(`/moods?date=${encodeURIComponent(dateStr)}`, {}, true)
    .then(res => res.context ?? null);

export const setMoodForDate = (dateStr: string, moodId: string) =>
  request<void>(
    '/moods',
    {
      method: 'PUT',
      body: JSON.stringify({ date: dateStr, context: moodId }),
    },
    true
  );