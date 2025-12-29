import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Alert } from '@mui/material';

const inputGlassSx = {
  '& .MuiInputLabel-root': {
    color: '#fff',
    opacity: 0.95,
    '&.Mui-focused': { color: '#fff' },
  },
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    '& fieldset': {
      borderColor: 'rgba(255,255,255,0.24)',
      borderWidth: '1px',
      backgroundColor: 'transparent',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255,255,255,0.45)',
      borderWidth: '1px',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(255,255,255,0.9)',
      borderWidth: '1px',
    },
  },
  '& .MuiOutlinedInput-input': {
    color: '#fff !important',
    fontWeight: 500,
    backgroundColor: 'transparent !important',
    WebkitAppearance: 'none',
    '&::placeholder': {
      color: 'rgba(248,250,252,0.7)',
    },
    '&:focus': {
      backgroundColor: 'transparent !important',
      outline: 'none',
    },
  },
  // autofill стили вынесены в глобальный app.css
};

export const AuthForm: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) {
      navigate('/');
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          color: '#fff',
          fontWeight: 700,
          fontSize: { xs: 20, sm: 22 },
          mb: 1.5,
        }}
      >
        Вход
      </Typography>

      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        margin="normal"
        required
        autoFocus
        variant="outlined"
        autoComplete="email"
        InputLabelProps={{
          shrink: Boolean(email),
        }}
        inputProps={{
          style: {
            backgroundColor: 'transparent',
            WebkitAppearance: 'none',
          },
        }}
        placeholder="you@example.com"
        sx={inputGlassSx}
      />

      <TextField
        label="Пароль"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        margin="normal"
        required
        variant="outlined"
        autoComplete="current-password"
        InputLabelProps={{
          shrink: Boolean(password),
        }}
        inputProps={{
          style: {
            backgroundColor: 'transparent',
            WebkitAppearance: 'none',
          },
        }}
        placeholder="Ваш пароль"
        sx={inputGlassSx}
      />

      {error && (
        <Alert
          severity="error"
          sx={{
            mt: 2,
            bgcolor: 'rgba(248,113,113,0.2)',
            color: '#fee2e2',
            '& .MuiAlert-icon': { color: '#fecaca' },
          }}
        >
          {error}
        </Alert>
      )}

      <Button
        type="submit"
        variant="contained"
        fullWidth
        sx={{
          mt: 2.5,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: 0.4,
          py: 1.1,
          borderRadius: 2,
          background:
            'linear-gradient(135deg, rgba(88,120,255,0.98), rgba(139,92,246,0.98))',
          boxShadow: 'none',
          '&:hover': {
            background:
              'linear-gradient(135deg, rgba(88,120,255,1), rgba(139,92,246,1))',
            boxShadow: 'none',
          },
          '&.Mui-disabled': {
            background: 'rgba(148,163,184,0.35)',
            color: 'rgba(226,232,240,0.8)',
            boxShadow: 'none',
          },
        }}
        disabled={loading}
      >
        {loading ? 'Вход…' : 'Войти'}
      </Button>

      <Box mt={2.4} textAlign="center">
        <Typography
          variant="body2"
          sx={{
            color: '#e0bbff',
            fontSize: 14,
          }}
        >
          Нет аккаунта?{' '}
          <Box
            component="button"
            type="button"
            onClick={onSwitch}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              color: '#ffffff',
              font: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Зарегистрируйтесь
          </Box>
        </Typography>
      </Box>
    </form>
  );
};