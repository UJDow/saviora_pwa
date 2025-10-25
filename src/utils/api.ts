// src/utils/api.ts
const API_URL = import.meta.env.VITE;

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export const api = {
  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Ошибка входа');
    return res.json();
  },
  async register(email: string, password: string) {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Ошибка регистрации');
    return res.json();
  },
  async getMe(token: string) {
    const res = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Ошибка');
    return res.json();
  },
  // ... другие методы
};