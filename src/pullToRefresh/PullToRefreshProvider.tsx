// src/pullToRefresh/PullToRefreshProvider.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

interface PullToRefreshProviderProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  /**
   * Доп. фильтр: можно отключать pull-to-refresh на отдельных маршрутах.
   */
  isEnabled?: () => boolean;
}

/**
 * Глобальный pull-to-refresh для PWA:
 * - работает в standalone режиме,
 * - обрабатывает touch и mouse,
 * - не мешает обычной прокрутке,
 * - показывает стеклянный индикатор сверху.
 */
export const PullToRefreshProvider: React.FC<PullToRefreshProviderProps> = ({
  children,
  onRefresh,
  isEnabled,
}) => {
  const [state, setState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);

  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const lastYRef = useRef(0);

  // Настройки "физики"
  const MAX_PULL = 140;       // максимум вытягивания
  const TRIGGER_DISTANCE = 90; // порог для срабатывания refresh

  const checkEnabled = (): boolean => {
    if (state === 'refreshing') return false;
    if (typeof isEnabled === 'function' && !isEnabled()) return false;

    const path = window.location.pathname;
    // Чаты — исключаем
    if (path.startsWith('/dreams/') && path.includes('/chat')) return false;
    if (path.startsWith('/daily/') && path.includes('/chat')) return false;

    return true;
  };

  const isAtTop = (): boolean => {
    // Основной критерий — глобальный скролл наверху
    if (window.scrollY > 0) return false;
    return true;
  };

  const calcPullDistance = (deltaY: number): number => {
    if (deltaY <= 0) return 0;
    const resistance = 0.5; // 0.5 = мягкое сопротивление
    const powered = Math.pow(deltaY, resistance);
    return Math.min(MAX_PULL, powered);
  };

  const handleStart = (clientY: number) => {
    if (!checkEnabled() || !isAtTop()) return;
    draggingRef.current = true;
    startYRef.current = clientY;
    lastYRef.current = clientY;
  };

  const handleMove = (clientY: number, preventDefault?: () => void) => {
    if (!draggingRef.current || startYRef.current == null) return;

    const deltaY = clientY - startYRef.current;
    if (deltaY <= 0) {
      setPullDistance(0);
      setState('idle');
      return;
    }

    const dist = calcPullDistance(deltaY);
    setPullDistance(dist);

    if (dist >= TRIGGER_DISTANCE) {
      setState('ready');
    } else {
      setState('pulling');
    }

    const prevY = lastYRef.current;
    const dy = clientY - prevY;
    if (dy > 0 && preventDefault) {
      // блокируем нативный скролл, пока тянем вниз
      preventDefault();
    }

    lastYRef.current = clientY;
  };

  const animateBack = (target: number, opts: { stiff?: boolean } = {}) => {
    const { stiff = false } = opts;
    const duration = stiff ? 200 : 260;
    const frames = Math.round(duration / 16);
    const start = pullDistance;
    const delta = target - start;

    let frame = 0;

    const step = () => {
      frame += 1;
      const progress = frame / frames;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      const current = start + delta * eased;
      setPullDistance(current);
      if (frame < frames) {
        requestAnimationFrame(step);
      } else {
        setPullDistance(target);
        if (target === 0 && state !== 'refreshing') {
          setState('idle');
        }
      }
    };

    requestAnimationFrame(step);
  };

  const handleEnd = async () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    startYRef.current = null;

    if (state === 'ready') {
      setState('refreshing');
      // фиксируем индикатор на пороге
      animateBack(TRIGGER_DISTANCE, { stiff: true });

      try {
        await onRefresh();
      } catch (e) {
        console.error('Pull-to-refresh onRefresh error:', e);
      } finally {
        setState('idle');
        animateBack(0);
      }
    } else {
      animateBack(0);
    }
  };

  // Touch
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      handleStart(e.touches[0].clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      const touch = e.touches[0];
      handleMove(touch.clientY, () => e.preventDefault());
    };

    const onTouchEnd = () => {
      void handleEnd();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pullDistance]);

  // Mouse (для десктопа/симуляторов)
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // ограничим начало жеста верхней зоной (например, 120px)
      if (e.clientY > 120) return;
      handleStart(e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      handleMove(e.clientY);
    };

    const onMouseUp = () => {
      void handleEnd();
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pullDistance]);

  // Текст статуса
  let statusText = 'Потяните вниз, чтобы обновить';
  if (state === 'ready') statusText = 'Отпустите, чтобы обновить';
  if (state === 'refreshing') statusText = 'Обновление…';

  const progress = Math.min(1, pullDistance / TRIGGER_DISTANCE);

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Индикатор */}
      <Box
        sx={{
          position: 'fixed',
          top: 'env(safe-area-inset-top)',
          left: 0,
          right: 0,
          height: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1600,
          transform: `translateY(${pullDistance - 80}px)`,
          transition:
            state === 'pulling' || state === 'ready' || state === 'refreshing'
              ? 'none'
              : 'transform 0.2s ease-out',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 10px 35px rgba(0,0,0,0.45)',
            opacity: progress > 0 ? 0.3 + progress * 0.7 : 0,
            transform: `scale(${0.9 + progress * 0.1})`,
            transition: 'opacity 0.12s linear, transform 0.12s ease-out',
          }}
        >
          {state === 'refreshing' ? (
            <CircularProgress
              size={18}
              thickness={5}
              sx={{ color: 'rgba(255,255,255,0.92)' }}
            />
          ) : (
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.7)',
                borderTopColor:
                  state === 'ready'
                    ? 'rgba(129, 212, 250, 1)'
                    : 'rgba(255,255,255,0.4)',
                transform:
                  state === 'ready'
                    ? 'rotate(180deg)'
                    : `rotate(${progress * 90}deg)`,
                transition: 'border-top-color 0.2s, transform 0.2s',
              }}
            />
          )}
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 500,
              letterSpacing: 0.3,
              whiteSpace: 'nowrap',
            }}
          >
            {statusText}
          </Typography>
        </Box>
      </Box>

      {/* Контент приложения — немного “плавающий” вниз при жесте */}
      <Box
        sx={{
          height: '100%',
          width: '100%',
          transform: `translateY(${pullDistance}px)`,
          transition:
            state === 'pulling' || state === 'ready' || state === 'refreshing'
              ? 'none'
              : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};