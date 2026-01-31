// src/features/feed/FeedScreen.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import { ArrowBackIosNew } from '@mui/icons-material';
import { useFeed } from './useFeed';
import { DreamCard } from './DreamCard';
import { DreamCardSkeleton } from './DreamCardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../../utils/api';
import type { FeedDream } from './types';

// 🌙✨ ПАСТЕЛЬНАЯ ПАЛИТРА
const dreamPalette = {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  glass: {
    bg: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.10)',
    shadow: '0 8px 24px rgba(11,8,36,0.16)',
  },
};

const HEADER_BASE = 56;

export const FeedScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [featuredDream, setFeaturedDream] = useState<FeedDream | null>(null);
  
  const {
    dreams,
    loading,
    loadingMore,
    error,
    hasMore,
    toggleLike,
    loadMore,
    changeSort,
  } = useFeed({
    initialPage: 1,
    limit: 20,
    sort,
  });

  const [localDreams, setLocalDreams] = useState(dreams);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getMe();
        setCurrentUserEmail(user.email);
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    setLocalDreams(dreams);
  }, [dreams]);

  // 🌟 Выбираем Hero Dream БЕЗ ДУБЛИРОВАНИЯ
  useEffect(() => {
    if (localDreams.length === 0) {
      setFeaturedDream(null);
      return;
    }

    let featured: FeedDream;

    if (sort === 'latest') {
      // ДЛЯ "СВЕЖЕЕ": самый активный из первых 5
      const topRecent = localDreams.slice(0, 5).reduce((prev, current) => {
        const prevScore = prev.likes_count + prev.comments_count * 2;
        const currentScore = current.likes_count + current.comments_count * 2;
        return currentScore > prevScore ? current : prev;
      });
      featured = topRecent;
    } else {
      // ДЛЯ "ПОПУЛЯРНОЕ": исключаем топ-5 свежих
      const olderDreams = localDreams.slice(5);
      
      if (olderDreams.length > 0) {
        // Самый популярный среди старых снов
        featured = olderDreams.reduce((prev, current) => {
          const prevScore = prev.likes_count + prev.comments_count * 2 + prev.views_count * 0.1;
          const currentScore = current.likes_count + current.comments_count * 2 + current.views_count * 0.1;
          return currentScore > prevScore ? current : prev;
        });
      } else {
        // Если снов меньше 5, берём самый популярный из всех
        featured = localDreams.reduce((prev, current) => {
          const prevScore = prev.likes_count + prev.comments_count * 2 + prev.views_count * 0.1;
          const currentScore = current.likes_count + current.comments_count * 2 + current.views_count * 0.1;
          return currentScore > prevScore ? current : prev;
        });
      }
    }

    setFeaturedDream(featured);
  }, [localDreams, sort]);

  const observerTarget = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasMore && !loadingMore && !loading) {
        loadMore();
      }
    },
    [hasMore, loadingMore, loading, loadMore]
  );

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const option = {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    };

    const observer = new IntersectionObserver(handleObserver, option);
    observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: 'latest' | 'popular') => {
    if (newValue !== sort) {
      setSort(newValue);
      changeSort(newValue);
    }
  };

  const handleUnpublish = (dreamId: string) => {
    setLocalDreams((prev) => prev.filter((d) => d.id !== dreamId));
    if (featuredDream?.id === dreamId) {
      setFeaturedDream(null);
    }
  };

  const regularDreams = localDreams.filter(d => d.id !== featuredDream?.id);

  // 🎨 Динамический стиль для Hero Card
  const heroBadge = sort === 'latest' 
    ? { 
        gradient: 'linear-gradient(90deg, rgba(100,240,180,0.8), rgba(120,255,200,0.8))',
      }
    : { 
        gradient: 'linear-gradient(90deg, rgba(255,200,80,0.8), rgba(255,180,100,0.8))',
      };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        height: '100vh',
        overflow: 'auto',
        background: dreamPalette.background,
        color: '#fff',
        // ✅ УБРАЛИ paddingTop — safe area теперь только на header
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header с вкладками */}
      <Box
        sx={{
          position: 'sticky',
          top: 0, // ✅ ИЗМЕНЕНО: убрали env(safe-area-inset-top)
          left: 0,
          right: 0,
          zIndex: 1400,
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 8px 28px rgba(41, 52, 98, 0.12)',
          // ✅ ДОБАВИЛИ: safe area теперь через padding
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Строка с кнопкой назад и заголовком */}
        <Box
          sx={{
            height: `${HEADER_BASE}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
            position: 'relative',
          }}
        >
          <IconButton
            onClick={() => navigate(-1)}
            aria-label="Назад"
            sx={{
              position: 'absolute',
              left: 12,
              color: '#fff',
              '@media (hover: hover)': {
                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
              },
            }}
          >
            <ArrowBackIosNew fontSize="small" />
          </IconButton>

          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '1.05rem',
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            Лента снов 🌙
          </Typography>
        </Box>

        {/* 🔥 СВАЙПАБЕЛЬНЫЕ ВКЛАДКИ */}
        <Tabs
          value={sort}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': {
              height: 3,
              background: heroBadge.gradient,
              borderRadius: '3px 3px 0 0',
            },
            '& .MuiTab-root': {
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 600,
              fontSize: '0.9rem',
              textTransform: 'none',
              minHeight: 44,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&.Mui-selected': {
                color: '#fff',
                textShadow: '0 2px 8px rgba(0,0,0,0.2)',
              },
            },
          }}
        >
          <Tab value="latest" label="🌟 Свежее" />
          <Tab value="popular" label="⭐ Популярное" />
        </Tabs>
      </Box>

      {/* Контент */}
      <Container
        maxWidth="md"
        sx={{
          pt: 3,
          pb: 4,
        }}
      >
        {/* Описание */}
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255,255,255,0.85)',
            mb: 3,
            textAlign: 'center',
          }}
        >
          Исследуйте сновидения других пользователей ✨
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              background: 'rgba(220,38,38,0.15)',
              color: '#fff',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 3,
            }}
          >
            {error}
          </Alert>
        )}

        {loading && localDreams.length === 0 ? (
          <Box display="flex" flexDirection="column" gap={3}>
            {Array.from({ length: 3 }).map((_, index) => (
              <DreamCardSkeleton key={index} />
            ))}
          </Box>
        ) : localDreams.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              background: dreamPalette.glass.bg,
              border: `1px solid ${dreamPalette.glass.border}`,
              borderRadius: 3,
              boxShadow: dreamPalette.glass.shadow,
            }}
          >
            <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
              Пока нет снов
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Будьте первым, кто поделится своим сновидением! ✨
            </Typography>
          </Box>
        ) : (
          <>
            {/* 🌟 HERO CARD - с цветной полоской */}
            {featuredDream && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${featuredDream.id}-${sort}`}
                  initial={{ opacity: 0, x: sort === 'latest' ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: sort === 'latest' ? 20 : -20 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      mb: 3,
                      borderRadius: 4,
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: heroBadge.gradient,
                        zIndex: 1,
                      },
                    }}
                  >
                    <DreamCard
                      dream={featuredDream}
                      onLike={toggleLike}
                      onUnpublish={handleUnpublish}
                      currentUserEmail={currentUserEmail || undefined}
                    />
                  </Box>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Список остальных снов */}
            <Box display="flex" flexDirection="column" gap={3}>
              {regularDreams.map((dream, index) => (
                <motion.div
                  key={dream.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
                >
                  <DreamCard 
                    dream={dream} 
                    onLike={toggleLike}
                    onUnpublish={handleUnpublish}
                    currentUserEmail={currentUserEmail || undefined}
                  />
                </motion.div>
              ))}
            </Box>

            {/* Infinite scroll trigger */}
            <Box
              ref={observerTarget}
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 80,
                mt: 3,
              }}
            >
              {loadingMore && (
                <CircularProgress size={32} sx={{ color: '#fff' }} />
              )}
              {!hasMore && localDreams.length > 0 && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                    py: 2,
                  }}
                >
                  Вы просмотрели все сны ✨
                </Typography>
              )}
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
};
