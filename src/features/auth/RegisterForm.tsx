import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Alert } from '@mui/material';

const inputGlassSx = {
  '& .MuiInputLabel-root': {
    color: '#fff',
    opacity: 0.8,
    '&.Mui-focused': { color: '#fff', opacity: 1 },
  },
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    borderRadius: 2,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    '& fieldset': {
      borderColor: 'rgba(255,255,255,0.2)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255,255,255,0.4)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(255,255,255,0.8)',
    },
  },
  '& .MuiOutlinedInput-input': {
    color: '#fff !important',
    '&::placeholder': {
      color: 'rgba(255,255,255,0.5)',
    },
  },
};

export const RegisterForm: React.FC<{ onSwitch: () => void }> = ({
  onSwitch,
}) => {
  const { register, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await register(email, password);
    if (ok) {
      navigate('/dreams');
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
        Регистрация
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
        InputLabelProps={{
          shrink: true,
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
        InputLabelProps={{
          shrink: true,
        }}
        inputProps={{
          style: {
            backgroundColor: 'transparent',
            WebkitAppearance: 'none',
          },
        }}
        placeholder="Минимум 6 символов"
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
        {loading ? 'Регистрация…' : 'Зарегистрироваться'}
      </Button>

      <Box mt={2.4} textAlign="center">
        <Typography
          variant="body2"
          sx={{
            color: '#e0bbff',
            fontSize: 14,
          }}
        >
          Уже есть аккаунт?{' '}
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
            Войдите
          </Box>
        </Typography>
      </Box>
    </form>
  );
};