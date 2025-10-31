const API_URL = import.meta.env.VITE_API_URL as string;

export interface User {
  email: string;
  trialDaysLeft: number;
}

export interface Dream {
  id: string;
  dreamText: string;
  title?: string;
  date: number;
  blocks?: any[];
  globalFinalInterpretation?: string | null;
  dreamSummary?: string | null;
  similarArtworks?: any[];
  category?: string | null;
}

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
      // Можно здесь выбросить ошибку или вернуть null, если хотите
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    // Можно добавить статус в ошибку для удобства
    throw new Error(data.error || `Ошибка запроса: ${res.status}`);
  }
  return data;
}

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

export const getDreams = () =>
  request<Dream[]>('/dreams', {}, true);

export const addDream = (
  dreamText: string,
  title?: string,
  category?: string,
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
        title: title || '',
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
  title?: string,
  blocks?: any[],
  globalFinalInterpretation?: string | null,
  dreamSummary?: string | null,
  similarArtworks?: any[],
  category?: string | null
) =>
  request<Dream>(`/dreams/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      dreamText,
      title: title || '',
      blocks: blocks || [],
      globalFinalInterpretation,
      dreamSummary,
      similarArtworks: similarArtworks || [],
      category: category || null,
    }),
  }, true);

export const deleteDream = (id: string) =>
  request<{ success: boolean }>(`/dreams/${id}`, {
    method: 'DELETE',
  }, true);

export const analyzeDream = (
  blockText: string,
  lastTurns?: any[],
  rollingSummary?: string,
  extraSystemPrompt?: string,
  dreamSummary?: string
) =>
  request<any>('/analyze', {
    method: 'POST',
    body: JSON.stringify({
      blockText,
      lastTurns: lastTurns || [],
      rollingSummary,
      extraSystemPrompt,
      dreamSummary,
    }),
  }, true);

export const summarizeDream = (
  history: any[],
  blockText?: string,
  existingSummary?: string
) =>
  request<{ summary: string }>('/summarize', {
    method: 'POST',
    body: JSON.stringify({
      history,
      blockText,
      existingSummary,
    }),
  }, true);

export const findSimilarArtworks = (
  dreamText: string,
  globalFinalInterpretation?: string,
  blockInterpretations?: string
) =>
  request<{ similar: any[] }>('/find_similar', {
    method: 'POST',
    body: JSON.stringify({
      dreamText,
      globalFinalInterpretation,
      blockInterpretations,
    }),
  }, true);