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
      navigate('/');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
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
        onChange={e => setEmail(e.target.value)}
        fullWidth
        margin="normal"
        required
        autoFocus
        variant="outlined"
        InputLabelProps={{
          sx: {
            color: '#fff !important',
            '&.Mui-focused': {
              color: '#fff !important',
            }
          }
        }}
        InputProps={{
  sx: {
    bgcolor: 'rgba(255,255,255,0.22)',
    borderRadius: 2,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)', // для iOS
    backgroundClip: 'padding-box',
    WebkitBackgroundClip: 'padding-box',
    color: '#fff',
    fontWeight: 500,
    input: { color: '#fff', fontWeight: 500 },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255,255,255,0.4)',
      borderWidth: '1px',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#fff',
      borderWidth: '1px',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#fff',
      borderWidth: '1px',
      boxShadow: 'none',
    },
    '&.Mui-focused': {
      bgcolor: 'rgba(255,255,255,0.22)',
    },
  }
}}
      />
      <TextField
        label="Пароль"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        fullWidth
        margin="normal"
        required
        variant="outlined"
        InputLabelProps={{
          sx: {
            color: '#fff !important',
            '&.Mui-focused': {
              color: '#fff !important',
            }
          }
        }}
        InputProps={{
          sx: {
            bgcolor: 'rgba(255,255,255,0.22)',
            borderRadius: 2,
            backdropFilter: 'blur(4px)',
            color: '#fff',
            fontWeight: 500,
            input: { color: '#fff', fontWeight: 500 },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255,255,255,0.4)',
              borderWidth: '1px',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#fff',
              borderWidth: '1px',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#fff',
              borderWidth: '1px',
              boxShadow: 'none',
            },
            '&.Mui-focused': {
              bgcolor: 'rgba(255,255,255,0.22)',
            },
          }
        }}
      />
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        sx={{
          mt: 2,
          bgcolor: 'rgba(88,120,255,0.95)',
          color: '#fff',
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: 0.5,
          py: 1,
          borderRadius: 2,
          boxShadow: '0 2px 8px 0 rgba(31, 38, 135, 0.10)',
          '&:hover': {
            bgcolor: 'rgba(88,120,255,1)',
          }
        }}
        disabled={loading}
      >
        {loading ? 'Вход...' : 'Войти'}
      </Button>
      <Box mt={2} textAlign="center">
        <Button
          onClick={onSwitch}
          color="secondary"
          sx={{
            color: '#e0bbff',
            fontWeight: 500,
            fontSize: 15,
            textTransform: 'none',
            opacity: 0.9,
            '&:hover': { color: '#fff', opacity: 1 }
          }}
        >
          Нет аккаунта? Зарегистрироваться
        </Button>
      </Box>
    </form>
  );
};