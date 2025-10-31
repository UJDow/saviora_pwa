// src/features/auth/authHelpers.ts
import { useAuth as useAuthHook } from './useAuth';

export const useAuthValue = () => {
  return useAuthHook();
};