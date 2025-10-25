import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useAuth } from './useAuth';

export const RegisterForm: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
  const { register, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const ok = await register(email, password);
    if (!ok) setMsg('Ошибка регистрации');
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, width: 320 }}>
      <Typography variant="h5" align="center" gutterBottom>
        Регистрация в Saviora
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
        {loading ? <CircularProgress size={24} /> : 'Зарегистрироваться'}
      </Button>
      <Button
        onClick={onSwitch}
        fullWidth
        sx={{ mt: 1 }}
      >
        Уже есть аккаунт? Войти
      </Button>
    </Box>
  );
};