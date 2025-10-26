import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthScreen } from './features/auth/AuthScreen';
import { useAuth } from './features/auth/useAuth';
import { DreamsScreen } from './features/dreams/DreamsScreen';
import { CircularProgress, Box, Typography, Button, Paper } from '@mui/material';

// Пример защищённого роута
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function Home() {
  const { user, logout } = useAuth();
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
        Привет, {user?.email}!
      </Typography>
      <Typography variant="body1" gutterBottom>
        Осталось дней пробного периода: {user?.trialDaysLeft}
      </Typography>
      <Button variant="outlined" color="secondary" onClick={logout} sx={{ mt: 2 }}>
        Выйти
      </Button>
      {/* Можно добавить ссылку на /dreams */}
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2 }}
        href="/dreams"
      >
        Перейти к снам
      </Button>
    </Box>
  );
}

function App() {
  const { tryAutoLogin } = useAuth();

  useEffect(() => {
    tryAutoLogin();
    // eslint-disable-next-line
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthScreen />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/dreams"
          element={
            <PrivateRoute>
              <DreamsScreen />
            </PrivateRoute>
          }
        />
        {/* Можно добавить другие приватные или публичные роуты */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;