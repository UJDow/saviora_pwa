import { useState, useEffect, useCallback, useRef } from 'react';
import type { FeedResponse, FeedDream } from './types';
import { request } from '../../utils/api';

interface UseFeedOptions {
  initialPage?: number;
  limit?: number;
  sort?: 'latest' | 'popular';
}

export function useFeed(options: UseFeedOptions = {}) {
  const { initialPage = 1, limit = 20, sort = 'latest' } = options;
  
  const [dreams, setDreams] = useState<FeedDream[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit,
    total: 0,
    totalPages: 0,
  });
  const [hasMore, setHasMore] = useState(true);
  
  const isFetchingRef = useRef(false);
  const currentSortRef = useRef(sort);

  const fetchFeed = useCallback(async (pageToFetch: number, isLoadMore = false) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    setError(null);

    try {
      const data: FeedResponse = await request(
        `/feed?page=${pageToFetch}&limit=${limit}&sort=${currentSortRef.current}`,
        {},
        true
      );
      
      if (isLoadMore) {
        setDreams((prev) => [...prev, ...data.dreams]);
      } else {
        setDreams(data.dreams);
      }
      
      setPagination(data.pagination);
      setHasMore(data.pagination.page < data.pagination.totalPages);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ошибка загрузки ленты');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [limit]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    
    const nextPage = pagination.page + 1;
    fetchFeed(nextPage, true);
  }, [hasMore, loadingMore, loading, pagination.page, fetchFeed]);

  const changeSort = useCallback((newSort: 'latest' | 'popular') => {
    if (currentSortRef.current === newSort) return;
    
    currentSortRef.current = newSort;
    setPagination((prev) => ({ ...prev, page: 1 }));
    setDreams([]);
    setHasMore(true);
    fetchFeed(1, false);
  }, [fetchFeed]);

  const refresh = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setDreams([]);
    setHasMore(true);
    fetchFeed(1, false);
  }, [fetchFeed]);

  useEffect(() => {
    fetchFeed(initialPage, false);
  }, []);

  const toggleLike = async (dreamId: string) => {
  const dream = dreams.find((d) => d.id === dreamId);
  if (!dream) return;

  const method = dream.user_liked ? 'DELETE' : 'POST';

  console.log('🔍 Frontend toggleLike called');
  console.log('   dreamId:', dreamId);
  console.log('   method:', method);
  console.log('   user_liked:', dream.user_liked);
  console.log('   likes_count:', dream.likes_count);
  console.log('   author:', dream.author.displayName);
  console.log('   endpoint:', `/dreams/${dreamId}/like`);

  // Оптимистичное обновление UI
  setDreams((prev) =>
    prev.map((d) =>
      d.id === dreamId
        ? {
            ...d,
            user_liked: !d.user_liked,
            likes_count: d.user_liked ? d.likes_count - 1 : d.likes_count + 1,
          }
        : d
    )
  );

  try {
    console.log('   🌐 Making request:', method, `/dreams/${dreamId}/like`);
    
    const data = await request<{ success: boolean; likes_count: number }>(
      `/dreams/${dreamId}/like`,
      { method },
      true
    );

    console.log('   ✅ Response received:', data);

    // ✅ ДОБАВЬТЕ ПРОВЕРКУ
    if (typeof data.likes_count !== 'number') {
      console.error('   ❌ likes_count is missing in response!', data);
      throw new Error('likes_count missing in server response');
    }

    // Корректировка реальными данными с сервера
    setDreams((prev) =>
      prev.map((d) =>
        d.id === dreamId
          ? { ...d, likes_count: data.likes_count, user_liked: !dream.user_liked }
          : d
      )
    );
    
    console.log('   ✅ toggleLike completed successfully');
  } catch (err) {
    console.error('   ❌ Toggle like error:', err);
    
    // Откат при ошибке
    setDreams((prev) =>
      prev.map((d) =>
        d.id === dreamId
          ? {
              ...d,
              user_liked: dream.user_liked,
              likes_count: dream.likes_count,
            }
          : d
      )
    );
  }
};


  const publishDream = async (dreamId: string) => {
    console.log('🔍 Frontend publishDream called:', dreamId);
    
    try {
      const result = await request<{ success: boolean; published_at: number }>(
        `/dreams/${dreamId}/publish`,
        { method: 'PUT' },
        true
      );
      
      console.log('   ✅ Publish result:', result);
      
      setDreams((prev) =>
        prev.map((d) =>
          d.id === dreamId
            ? { ...d, is_public: true, published_at: result.published_at }
            : d
        )
      );
      
      return result;
    } catch (err) {
      console.error('   ❌ Publish dream error:', err);
      throw err;
    }
  };

  const unpublishDream = async (dreamId: string) => {
    // 🔥🔥🔥 КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ
    console.log('🔥🔥🔥 Frontend unpublishDream called!');
    console.log('   dreamId:', dreamId);
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Stack trace:');
    console.trace();
    
    try {
      console.log('   🌐 Making request: PUT /dreams/' + dreamId + '/unpublish');
      
      const result = await request<{ success: boolean }>(
        `/dreams/${dreamId}/unpublish`,
        { method: 'PUT' },
        true
      );
      
      console.log('   ✅ Unpublish result:', result);
      console.log('   🗑️ Removing dream from local state');
      
      // Удаляем из ленты
      setDreams((prev) => prev.filter((d) => d.id !== dreamId));
      
      console.log('🔥🔥🔥 Frontend unpublishDream completed');
      
      return result;
    } catch (err) {
      console.error('   ❌ Unpublish dream error:', err);
      throw err;
    }
  };

  return {
    dreams,
    loading,
    loadingMore,
    error,
    pagination,
    hasMore,
    currentSort: currentSortRef.current,
    toggleLike,
    publishDream,
    unpublishDream,
    loadMore,
    changeSort,
    refresh,
  };
}
