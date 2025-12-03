// src/features/daily/types.ts

export type UUID = string;

export type EntryType = 'dailyconvo' | 'dream' | 'other';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageMeta {
  kind?: string;
  blockId?: string;
  insightLiked?: boolean;
  [key: string]: unknown;
}

/**
 * Тип сообщения как приходит/возвращается с API (mapChatMessage в utils/api.ts)
 * createdAt может приходить как ISO string или как число (unix ms)
 */
export interface ApiChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  meta?: ChatMessageMeta;
  createdAt: string | number; // ISO string or unix ms
  insightLiked?: boolean;
}

/**
 * Более удобный UI-тип сообщения (используется в DailyConvoChat.tsx)
 */
export interface DailyConvoMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  role: ChatRole;
  timestamp: number; // unix ms
  meta?: ChatMessageMeta | null;
  insightLiked?: boolean;
}

/**
 * Инсайт, возвращаемый API для daily convos (совпадает с utils/api DailyConvoInsight)
 */
export interface DailyConvoInsight {
  messageId: string;
  text: string;
  createdAt?: string | number; // ISO or unix ms
  blockId?: string | null;
  insightLiked?: boolean;
  insightArtworksLiked?: boolean;
  meta?: Record<string, unknown>;
}

/**
 * Основной объект дневной беседы. В API в некоторых местах используется поле `notes`,
 * а в UI в других — `body`. Здесь оба поля отмечены опциональными, чтобы покрыть оба варианта.
 */
export interface DailyConvo {
  id: string;
  notes?: string | null; // текст записи, часто используется в API
  body?: string | null;  // альтернативное поле, которое используется в UI (DailyConvoScreen)
  title?: string | null;
  date?: number | string | null; // unix ms or ISO string
  blocks?: any[]; // rich content blocks — уточните при необходимости
  globalFinalInterpretation?: string | null;
  autoSummary?: string | null;
  category?: string | null;
  context?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, any> | null;
  createdAt?: number | string | null;
  updatedAt?: number | string | null;
}

/** Вспомогательные входные типы для создания/обновления (опционально) */
export type DailyConvoCreateInput = {
  notes?: string;
  body?: string;
  title?: string;
  date?: number | string;
  blocks?: any[];
  tags?: string[];
  metadata?: Record<string, any>;
};

export type DailyConvoUpdateInput = Partial<DailyConvo> & {
  messagesToAdd?: Omit<ApiChatMessage, 'id' | 'createdAt'>[];
  messagesToUpdate?: Partial<ApiChatMessage>[];
  messagesToDeleteIds?: string[];
};