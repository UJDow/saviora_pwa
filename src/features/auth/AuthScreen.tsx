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
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        overflow: 'hidden',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 4 },
          width: '100%',
          maxWidth: 400,
          borderRadius: '24px',
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.20)',
          boxShadow: '0 4px 32px 0 rgba(31, 38, 135, 0.15)',
        }}
      >
        {isLogin ? (
          <AuthForm onSwitch={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitch={() => setIsLogin(true)} />
        )}
      </Paper>
    </Box>
  );
};