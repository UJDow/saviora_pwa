import React, { useState, useEffect } from 'react';
import { AuthForm } from './features/auth/AuthForm';
import { RegisterForm } from './features/auth/RegisterForm';
import { useAuth } from './features/auth/useAuth';
import { CircularProgress, Box, Typography, Button, Paper, Alert } from '@mui/material';

function App() {
  const { user, loading, error, tryAutoLogin, logout } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    tryAutoLogin();
    // eslint-disable-next-line
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box
        component={Paper}
        elevation={4}
        sx={{
          p: 4,
          mt: 8,
          maxWidth: 400,
          mx: 'auto',
          background: 'rgba(255,255,255,0.85)',
          borderRadius: 3,
        }}
      >
        {showRegister ? (
          <RegisterForm onSwitch={() => setShowRegister(false)} />
        ) : (
          <AuthForm onSwitch={() => setShowRegister(true)} />
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Box>
    );
  }

  return (
    <Box
      component={Paper}
      elevation={4}
      sx={{
        p: 4,
        mt: 8,
        maxWidth: 400,
        mx: 'auto',
        background: 'rgba(255,255,255,0.85)',
        borderRadius: 3,
      }}
    >
      <Typography variant="h4" gutterBottom>
        Привет, {user.email}!
      </Typography>
      <Typography variant="body1" gutterBottom>
        Осталось дней пробного периода: {user.trialDaysLeft}
      </Typography>
      <Button variant="outlined" color="secondary" onClick={logout} sx={{ mt: 2 }}>
        Выйти
      </Button>
      {/* Здесь можно добавить DreamsList или другой контент */}
    </Box>
  );
}

export default App;