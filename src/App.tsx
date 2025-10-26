import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthScreen } from './features/auth/AuthScreen';
import { DreamsScreen } from './features/dreams/DreamsScreen';
import { PrivateRoute } from './features/auth/PrivateRoute';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useAuth } from './features/auth/AuthProvider';

function Home() {
  const { user, logout, tryAutoLogin } = useAuth();

  React.useEffect(() => {
    tryAutoLogin();
    // eslint-disable-next-line
  }, []);

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;