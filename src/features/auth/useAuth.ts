import { useState } from 'react';
import * as api from '../../utils/api';

const JWT_KEY = 'saviora_jwt';

export function useAuth() {
  const [user, setUser] = useState<api.User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(JWT_KEY)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Автоматический вход по токену
  const tryAutoLogin = async () => {
    const jwt = localStorage.getItem(JWT_KEY);
    if (!jwt) return false;
    setLoading(true);
    try {
      const me = await api.getMe();
      setUser(me);
      setToken(jwt);
      setError(null);
      return true;
    } catch {
      logout();
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Вход
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      localStorage.setItem(JWT_KEY, res.token);
      setToken(res.token);
      await tryAutoLogin();
      return true;
    } catch (e: any) {
      setError(e.message || 'Ошибка входа');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Регистрация
  const register = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.register(email, password);
      return await login(email, password);
    } catch (e: any) {
      setError(e.message || 'Ошибка регистрации');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Выход
  const logout = () => {
    localStorage.removeItem(JWT_KEY);
    setUser(null);
    setToken(null);
  };

  return {
    user,
    token,
    loading,
    error,
    login,
    logout,
    tryAutoLogin,
    register,
  };
}