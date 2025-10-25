const API_URL = import.meta.env.VITE_API_URL as string;

export interface User {
  email: string;
  trialDaysLeft: number;
}

export interface Dream {
  id: string;
  text: string;
  createdAt: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (withAuth) {
    const token = localStorage.getItem('saviora_jwt');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

export const login = (email: string, password: string) =>
  request<{ token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const register = (email: string, password: string) =>
  request<{ message: string }>('/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const getMe = () =>
  request<User>('/me', {}, true);

export const getDreams = () =>
  request<Dream[]>('/dreams', {}, true);

export const addDream = (text: string) =>
  request<Dream>('/dreams', {
    method: 'POST',
    body: JSON.stringify({ text }),
  }, true);

export const deleteDream = (id: string) =>
  request<{ message: string }>(`/dreams/${id}`, {
    method: 'DELETE',
  }, true);