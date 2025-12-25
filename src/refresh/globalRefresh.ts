// src/refresh/globalRefresh.ts
// Глобальное обновление данных приложения (кроме чатов).
// Здесь можно централизованно добавлять нужные запросы.

import * as api from 'src/utils/api';

export async function globalRefresh(): Promise<void> {
  try {
    // Базовый вариант: просто обновляем ключевые сущности.
    // Если позже появятся сторы/React Query — сюда добавим invalidation.
    await Promise.allSettled([
      api.getDreams(),
      api.getDailyConvos(),
      // сюда при желании можно добавить:
      // api.getProfile(),
      // api.getStats(),
    ]);
  } catch (e) {
    console.error('Global refresh error:', e);
  }
}