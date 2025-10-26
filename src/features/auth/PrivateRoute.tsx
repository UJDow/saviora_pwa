import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return null; // Можно заменить на спиннер
  }

  return token ? <>{children}</> : <Navigate to="/auth" replace />;
};