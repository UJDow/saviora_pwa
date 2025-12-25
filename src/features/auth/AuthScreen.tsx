import React, { useState } from 'react';
import { AuthForm } from './AuthForm';
import { RegisterForm } from './RegisterForm';
import { Box, Paper } from '@mui/material';

const bgGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const glassBg = 'rgba(255,255,255,0.10)';
const glassBorder = 'rgba(255,255,255,0.20)';

export const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: bgGradient,
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Центрированный контент без хедера */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          px: 2,
          py: 4,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 4,
            background: glassBg,
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            border: `1px solid ${glassBorder}`,
            boxShadow: '0 12px 40px rgba(15,23,42,0.45)',
            p: { xs: 2.4, sm: 3.2 },
          }}
        >
          {isLogin ? (
            <AuthForm onSwitch={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitch={() => setIsLogin(true)} />
          )}
        </Paper>
      </Box>
    </Box>
  );
};