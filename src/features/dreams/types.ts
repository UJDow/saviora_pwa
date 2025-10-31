// src/features/dreams/types.ts
import type { Dream as ApiDream } from 'src/utils/api';

export interface Block {
  id: string;
  text: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

// Используем тип Dream из api.ts без изменений
export type Dream = ApiDream;