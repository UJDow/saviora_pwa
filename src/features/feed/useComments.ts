import { useState, useEffect, useCallback } from 'react';
import type { Comment } from './types';
import { request } from '../../utils/api'; // 👈 импортируем request

export function useComments(dreamId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!dreamId) return;

    setLoading(true);
    setError(null);

    try {
      // 👇 используем request с withAuth=true
      const data = await request<{ comments: Comment[] }>(
        `/dreams/${dreamId}/comments`,
        {},
        true
      );
      
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [dreamId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = async (text: string) => {
    try {
      // 👇 используем request вместо fetch
      const data = await request<{ success: boolean; comment: Comment }>(
        `/dreams/${dreamId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ comment_text: text }),
        },
        true
      );
      
      setComments((prev) => [...prev, data.comment]);
      
      return data.comment;
    } catch (err) {
      console.error('Add comment error:', err);
      throw err;
    }
  };

  return {
    comments,
    loading,
    error,
    addComment,
    refresh: fetchComments,
  };
}
