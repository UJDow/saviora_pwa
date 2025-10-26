// src/features/auth/AuthScreen.tsx
import React, { useState } from 'react';
import { AuthForm } from './AuthForm';
import { RegisterForm } from './RegisterForm';
import { Box, Paper } from '@mui/material';

export const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <Paper elevation={3} sx={{ p: 4, minWidth: 360 }}>
        {isLogin ? (
          <AuthForm onSwitch={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitch={() => setIsLogin(true)} />
        )}
      </Paper>
    </Box>
  );
};