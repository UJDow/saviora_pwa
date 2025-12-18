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
  date: number; // milliseconds
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

// === ТИПЫ DAILY CONVO ===

export interface DailyConvo {
  id: string;
  notes: string;
  body?: string | null;
  title?: string | null;
  date?: number | string | null; // will be normalized to milliseconds where used
  blocks?: any[];
  globalFinalInterpretation?: string | null;
  autoSummary?: string | null;
  category?: string | null;
  context?: string | null;
  createdAt?: number | string | null;
  updatedAt?: number | string | null;
}

export interface DailyConvoInsight {
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

  const url = `${API_URL}${path}`;
  let res: Response;

  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    // сетевые ошибки
    console.error('Network error when calling', url, options, err);
    throw new Error(`Network error when calling ${path}: ${String(err)}`);
  }

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text };
  }

  if (!res.ok) {
    // детальный лог для отладки
    console.error('API error', {
      url,
      status: res.status,
      statusText: res.statusText,
      requestOptions: options,
      responseText: text,
      parsed: data,
    });

    // пробрасываем сообщение, содержащее статус и тело ответа
    const errMsg = data?.error || data?.message || data?._raw || `Ошибка запроса: ${res.status}`;
    const err = new Error(`${errMsg}`);
    // @ts-ignore добавим поля для удобства при обработке в UI
    (err as any).status = res.status;
    (err as any).response = data;
    throw err;
  }

  return data as T;
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

// Преобразует значение в миллисекунды (number) или undefined.
// Если приходит число в секундах (меньше 1e12), умножаем на 1000.
const normalizeTimestampToMs = (value: unknown): number | undefined => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && !isNaN(Number(value))) {
    const n = Number(value);
    return n < 1e12 ? n * 1000 : n;
  }
  return undefined;
};

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

// Нормализует объект dailyConvo, возвращая поля date/createdAt/updatedAt в миллисекундах (числа)
const normalizeDailyConvo = (dc: any): DailyConvo => {
  const dateMs = normalizeTimestampToMs(dc.date) ?? normalizeTimestampToMs(dc.createdAt) ?? Date.now();
  const createdAtMs = normalizeTimestampToMs(dc.createdAt) ?? dateMs;
  const updatedAtMs = normalizeTimestampToMs(dc.updatedAt) ?? createdAtMs;

  return {
    ...dc,
    date: dateMs,
    createdAt: createdAtMs,
    updatedAt: updatedAtMs,
  } as DailyConvo;
};

export const generateAutoSummaryDailyConvo = (
  dailyConvoId: string,
  notes: string
) =>
  request<{ success: boolean; autoSummary: string }>('/generate_auto_summary_daily_convo', {
    method: 'POST',
    body: JSON.stringify({ dailyConvoId, notes }),
  }, true);

// Нормализует dream объект (date -> ms)
const normalizeDream = (d: any): Dream => {
  const dateMs = normalizeTimestampToMs(d.date) ?? Date.now();
  return {
    ...d,
    date: dateMs,
  } as Dream;
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
  request<Dream[]>('/dreams', {}, true).then((data) =>
    (data || []).map((d) => normalizeDream(d))
  );

export const getDream = (id: string) =>
  request<Dream>(`/dreams/${id}`, {}, true).then((d) => normalizeDream(d));

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
  ).then((d) => normalizeDream(d));

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
  ).then((d) => normalizeDream(d));

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

export const toggleMessageLike = (
  dreamId: string,
  messageId: string,
  liked: boolean,
  blockId?: string
) =>
  request<any>(
    `/dreams/${encodeURIComponent(dreamId)}/messages/${encodeURIComponent(messageId)}/like`,
    {
      method: 'PUT',
      body: JSON.stringify({ liked, blockId }),
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

export const setMoodForDream = (dreamId: string, moodId: string) =>
  request<void>(
    `/dreams/${encodeURIComponent(dreamId)}/mood`,
    {
      method: 'PUT',
      body: JSON.stringify({ context: moodId }),
    },
    true
  );

// === DAILY CONVOS CRUD ===

export const getDailyConvos = () =>
  request<DailyConvo[]>('/daily_convos', {}, true).then((data) =>
    (data || []).map((dc) => normalizeDailyConvo(dc))
  );

export const getDailyConvo = (id: string) =>
  request<DailyConvo>(`/daily_convos/${encodeURIComponent(id)}`, {}, true).then((dc) =>
    normalizeDailyConvo(dc)
  );

// addDailyConvo: добавил опциональный параметр date (ожидается seconds OR ms)
export const addDailyConvo = (
  notes: string,
  title?: string | null,
  blocks: any[] = [],
  globalFinalInterpretation: string | null = null,
  autoSummary: string | null = null,
  date?: number
) =>
  request<DailyConvo>('/daily_convos', {
    method: 'POST',
    body: JSON.stringify({
      notes,
      title: title || null,
      blocks,
      globalFinalInterpretation,
      autoSummary,
      ...(typeof date !== 'undefined' ? { date } : {}),
    }),
  }, true).then((dc) => normalizeDailyConvo(dc));

export const updateDailyConvo = (
  id: string,
  notes: string,
  title?: string | null,
  blocks?: any[],
  globalFinalInterpretation?: string | null,
  autoSummary?: string | null,
  category?: string | null,
  context?: string | null,
  date?: number
) =>
  request<DailyConvo>(
    `/daily_convos/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        notes,
        title: title ?? null,
        blocks: blocks ?? [],
        globalFinalInterpretation: globalFinalInterpretation ?? null,
        autoSummary: autoSummary ?? null,
        category: category ?? null,
        context: context ?? null, // <- теперь отправляем context
        ...(typeof date === 'number' ? { date } : {}),
      }),
    },
    true
  ).then((dc) => normalizeDailyConvo(dc));

export const deleteDailyConvo = (id: string) =>
  request<{ success: boolean }>(`/daily_convos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, true);

// === DAILY CONVO CHAT ===

export const getDailyConvoChat = (dailyConvoId: string) =>
  request<{ messages: any[] }>(
    `/daily_chat?dailyConvoId=${encodeURIComponent(dailyConvoId)}`,
    {},
    true
  ).then(({ messages }) => ({
    messages: messages.map(mapChatMessage),
  }));

export const appendDailyConvoChat = (params: {
  id?: string;
  dailyConvoId: string;
  role: ChatRole;
  content: string;
  meta?: ChatMessageMeta;
}) =>
  request<any>(
    '/daily_chat',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    true
  ).then(mapChatMessage);

export const clearDailyConvoChat = (dailyConvoId: string) =>
  request<{ success: boolean }>(
    `/daily_chat?dailyConvoId=${encodeURIComponent(dailyConvoId)}`,
    { method: 'DELETE' },
    true
  );

// === DAILY CONVO ANALYTICS ===

export const analyzeDailyConvo = (
  notesText: string,
  lastTurns?: any[],
  extraSystemPrompt?: string,
  dailyConvoId?: string,
  blockId?: string, // Добавлен blockId
  autoSummary?: string | null,
  context?: string | null
) =>
  request<any>('/analyze_daily_convo', {
    method: 'POST',
    body: JSON.stringify({
      notesText,
      lastTurns: lastTurns || [],
      extraSystemPrompt,
      dailyConvoId,
      blockId, // Передаем blockId
      autoSummary,
      context,
    }),
  }, true);

export const interpretBlockDailyConvo = (
  notesText: string,
  dailyConvoId?: string,
  blockType?: 'dialog' | 'art', // Добавлен blockType
  autoSummary?: string | null,
  context?: string | null
) =>
  request<{ interpretation: string }>(
    '/interpret_block_daily_convo',
    {
      method: 'POST',
      body: JSON.stringify({ notesText, dailyConvoId, blockType, autoSummary, context }),
    },
    true
  );

export const interpretFinalDailyConvo = (
  notesText: string,
  dailyConvoId?: string,
  autoSummary?: string | null,
  context?: string | null
) =>
  request<{ interpretation: string }>(
    '/interpret_final_daily_convo',
    {
      method: 'POST',
      body: JSON.stringify({ notesText, dailyConvoId, autoSummary, context }),
    },
    true
  );

// === DAILY CONVO INSIGHTS ===

export const toggleDailyConvoMessageLike = (
  dailyConvoId: string,
  messageId: string,
  liked: boolean,
  blockId?: string
) =>
  request<any>(
    `/daily_convos/${encodeURIComponent(dailyConvoId)}/messages/${encodeURIComponent(messageId)}/like`,
    {
      method: 'PUT',
      body: JSON.stringify({ liked, blockId }),
    },
    true
  ).then(mapChatMessage);

export const getDailyConvoInsights = (
  dailyConvoId: string,
  opts?: { metaKey?: 'insightArtworksLiked' | 'insightLiked' }
) => {
  const q = opts?.metaKey ? `?metaKey=${encodeURIComponent(opts.metaKey)}` : '';
  return request<{ insights: DailyConvoInsight[] }>(
    `/daily_convos/${encodeURIComponent(dailyConvoId)}/insights${q}`,
    {},
    true
  ).then(({ insights }) => insights);
};

export const getDailyConvoArtworksInsights = (dailyConvoId: string) =>
  getDailyConvoInsights(dailyConvoId, { metaKey: 'insightArtworksLiked' });

export const toggleDailyConvoArtworkInsight = (
  dailyConvoId: string,
  messageId: string,
  liked: boolean,
  blockId?: string
) =>
  request<any>(
    `/daily_convos/${encodeURIComponent(dailyConvoId)}/messages/${encodeURIComponent(messageId)}/artwork_like`,
    {
      method: 'PUT',
      body: JSON.stringify({ liked, blockId }),
    },
    true
  ).then(mapChatMessage);

  // ===== GOALS API =====

export interface GoalFromServer {
  goal_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  goal_type: string;
  target_count?: number | null;
  unit?: string | null;
  period?: string | null;
  start_date: number;
  due_date?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  total_done: number;
  progress_percent: number | null;
}

export interface TimelinePointFromServer {
  date: string;
  cumulative_amount: number;
  percent?: number; // 👈 добавить
}

export interface GoalsResponse {
  goals: GoalFromServer[];
}

export interface TimelineResponse {
  points: TimelinePointFromServer[];
}

export const getGoals = () =>
  request<GoalsResponse>('/goals', {}, true);

export type GoalsTimelineRange = '7d' | '30d' | '60d' | '90d' | '365d' | 'all';

export const getGoalsTimeline = (range: GoalsTimelineRange = '30d') =>
  request<TimelineResponse>(
    `/goals/timeline?range=${encodeURIComponent(range)}`,
    {},
    true,
  );

export const createGoal = (body: {
  title: string;
  description?: string | null;
  category?: string | null;
  goalType: string;
  targetCount: number;
  unit?: string | null;
  period?: string | null;
  startDate: number;
  dueDate?: number | null;
}) =>
  request<{ id: string }>('/goals', {
    method: 'POST',
    body: JSON.stringify(body),
  }, true);

export const updateGoal = (goalId: string, body: {
  title?: string;
  description?: string | null;
  category?: string | null;
  targetCount?: number;
  unit?: string | null;
  period?: string | null;
  dueDate?: number | null;
}) =>
  request<{ success: boolean }>(`/goals/${goalId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, true);

export const deleteGoal = (goalId: string) =>
  request<{ success: boolean }>(`/goals/${goalId}`, {
    method: 'DELETE',
  }, true);

export const addGoalEvent = (goalId: string, amount: number) =>
  request<{ success: boolean }>(`/goals/${goalId}/event`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }, true);

// ===== GAMIFICATION API =====

export interface Level {
  name: string;
  emoji: string;
  color: string;
  min: number;
  max: number;
  level?: number | null;        // ✅ измени на number | null
  isNew?: boolean;
  icon?: string;
  description?: string;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  category: string;
  description: string;
  unlocked?: boolean;
  unlockedAt?: number | null;
}

export interface GoalBadgeProgress {
  current: number;
  target: number;
}

export interface GoalBadge {
  badgeId: string;
  name: string;
  emoji: string;
  description: string;
  progress: GoalBadgeProgress;
  advice?: string; // лучше optional
  pinned?: boolean; // optional, если захочешь
}

export interface NextGoal {
  badgeId: string;
  name: string;
  emoji: string;
  description: string;
  progress: {
    current: number;
    target: number;
  };
  advice: string;
}

export interface BadgeCategory {
  name: string;
  emoji: string;
  badges: Badge[];
}

export interface GamificationData {
  depthScoreTotal: number;
  engagementScorePeriod?: number;

  level: Level;
  badges: {
    unlocked: Badge[];
    new: Badge[];
    unseen: Badge[];
    all: Badge[];
    categories?: BadgeCategory[]; // ✅ добавили это поле
  };

  currentGoal?: GoalBadge | null;
  recommendedGoal?: GoalBadge | null;
}

export const setCurrentGoal = (badgeId: string | null) =>
  request<{ success: boolean }>(
    '/set-current-goal',
    {
      method: 'POST',
      body: JSON.stringify({ badgeId }),
    },
    true
  );

export const markBadgesAsSeen = (badgeIds: string[]) =>
  request<{ success: boolean }>(
    '/mark-badges-seen',
    {
      method: 'POST',
      body: JSON.stringify({ badgeIds }),
    },
    true
  );