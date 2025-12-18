// src/features/dashboard/types.ts

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

import type { GamificationData } from 'src/utils/api';

export interface DashboardDataFromServer {
  totalDreams: number;
  totalDreamsInPeriod?: number;
  interpretedCount?: number;
  interpretedPercent?: number;
  artworksCount?: number;
  dialogDreamsCount?: number;
  monthlyBlocks?: number;
  streak?: number;
  insightsDreamsCount?: number;
  insightsArtworksCount?: number;
  moodCounts?: Record<string, number>;
  moodTotal?: number;
  breakdownCounts?: {
    interpreted: number;
    artworks: number;
    dialogs: number;
  };
  breakdownPercent?: {
    interpreted: number;
    artworks: number;
    dialogs: number;
  };
  recentDreams?: Array<{
    id: string;
    title: string | null;
    date: string;
  }>;
  history?: Array<{
    date: string;
    score: number;
  }>;
  lastUpdated?: string;
  score?: number;
  gamification?: GamificationData; // <- ДОБАВЛЕНО
}

export interface ProgressPoint {
  date: string;
  score: number;
  ideal?: number;
}