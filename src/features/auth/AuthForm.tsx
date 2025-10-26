// src/features/auth/AuthForm.tsx
import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Alert } from '@mui/material';

export const AuthForm: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) {
      navigate('/dreams');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Typography variant="h5" gutterBottom>Вход</Typography>
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        fullWidth
        margin="normal"
        required
        autoFocus
      />
      <TextField
        label="Пароль"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        fullWidth
        margin="normal"
        required
      />
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        sx={{ mt: 2 }}
        disabled={loading}
      >
        {loading ? 'Вход...' : 'Войти'}
      </Button>
      <Box mt={2} textAlign="center">
        <Button onClick={onSwitch} color="secondary">
          Нет аккаунта? Зарегистрироваться
        </Button>
      </Box>
    </form>
  );
};