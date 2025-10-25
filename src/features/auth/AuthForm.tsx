// src/features/auth/AuthForm.tsx
import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useAuth } from './useAuth';

export const AuthForm: React.FC = () => {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const ok = await login(email, password);
    if (!ok) setMsg('Неверный email или пароль');
    // Если успех — редирект или обновление UI (например, через глобальный state)
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, width: 320 }}>
      <Typography variant="h5" align="center" gutterBottom>
        Вход в Saviora
      </Typography>
      <TextField
        label="Email"
        type="email"
        fullWidth
        margin="normal"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <TextField
        label="Пароль"
        type="password"
        fullWidth
        margin="normal"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {msg && <Alert severity="error" sx={{ mt: 2 }}>{msg}</Alert>}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        sx={{ mt: 2 }}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} /> : 'Войти'}
      </Button>
    </Box>
  );
};