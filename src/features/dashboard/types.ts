// src/features/dashboard/types.ts

export type ProgressPoint = {
  date: string; // ISO string
  score: number;
};

export interface HighestRating {
  value: number;
  date?: string;
}

export interface GamesStats {
  total?: number;
  won?: number;
  lost?: number;
  draw?: number;
  byVariant?: Record<string, number>;
}

export interface DashboardDataFromServer {
  score?: number;
  improvementScore?: number; // <- добавляем это поле (optional)
  globalRank?: number;
  percentile?: number;
  friendsRank?: number;
  highestRating?: HighestRating;
  games?: GamesStats;
  // расширяйте по необходимости
}