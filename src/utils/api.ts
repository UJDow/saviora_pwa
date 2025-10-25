const API_URL = import.meta.env.VITE_API_URL as string;

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

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

export const api = {
  login(email: string, password: string) {
    return request<{ token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  register(email: string, password: string) {
    return request<{ message: string }>('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  getMe() {
    return request<User>('/me', {}, true);
  },
  getDreams() {
    return request<Dream[]>('/dreams', {}, true);
  },
  addDream(text: string) {
    return request<Dream>('/dreams', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }, true);
  },
  deleteDream(id: string) {
    return request<{ message: string }>(`/dreams/${id}`, {
      method: 'DELETE',
    }, true);
  },
};