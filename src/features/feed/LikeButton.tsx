// src/features/feed/LikeButton.tsx
import React, { useState } from 'react';
import { IconButton, Typography, Box } from '@mui/material';
import { Favorite, FavoriteBorder } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface LikeButtonProps {
  liked: boolean;
  likesCount: number;
  onToggle: () => void;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  liked,
  likesCount,
  onToggle,
}) => {
  const [particles, setParticles] = useState<number[]>([]);
  const [showPulse, setShowPulse] = useState(false);

  const handleClick = () => {
    onToggle();
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(liked ? 10 : [10, 20, 10]);
    }

    if (!liked) {
      // Создаём частицы при лайке
      setParticles(Array.from({ length: 8 }, (_, i) => i));
      setTimeout(() => setParticles([]), 1000);

      // Пульсация
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 600);
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={0.5}
      sx={{ position: 'relative', minHeight: 40 }}
    >
      {/* Пульсирующий круг при лайке */}
      <AnimatePresence>
        {showPulse && (
          <motion.div
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: 4,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,180,200,0.6), transparent)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Частицы-сердечки */}
      <AnimatePresence>
        {particles.map((i) => (
          <motion.div
            key={i}
            initial={{
              x: 0,
              y: 0,
              scale: 0,
              opacity: 1,
              rotate: 0,
            }}
            animate={{
              x: Math.cos((i * Math.PI) / 4) * (30 + Math.random() * 20),
              y: Math.sin((i * Math.PI) / 4) * (30 + Math.random() * 20) - 20,
              scale: [0, 1.2, 0],
              opacity: [1, 1, 0],
              rotate: Math.random() * 360,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.8,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{
              position: 'absolute',
              left: 12,
              fontSize: '1rem',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {['❤️', '💕', '💖', '✨'][Math.floor(Math.random() * 4)]}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Кнопка лайка */}
      <motion.div
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
      >
        <IconButton
          size="small"
          onClick={handleClick}
          aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'}
          sx={{
            color: liked
              ? 'rgba(255, 180, 200, 0.95)' // 🌸 пастельный розовый
              : 'rgba(255,255,255,0.75)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: liked
              ? 'drop-shadow(0 0 8px rgba(255, 180, 200, 0.5))' // 🌸 мягкое свечение
              : 'none',
            position: 'relative',
            zIndex: 1,
            '&:hover': {
              color: liked 
                ? 'rgba(255, 200, 215, 1)' 
                : 'rgba(255, 180, 200, 0.9)',
              bgcolor: liked
                ? 'rgba(255, 180, 200, 0.15)'
                : 'rgba(255, 180, 200, 0.12)',
            },
          }}
        >
          {/* Анимация иконки */}
          <AnimatePresence mode="wait">
            {liked ? (
              <motion.div
                key="liked"
                initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
                animate={{ 
                  scale: [0.5, 1.3, 1],
                  opacity: 1,
                  rotate: [0, -15, 15, -10, 0],
                }}
                exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
                transition={{ 
                  duration: 0.5,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                <Favorite fontSize="small" />
              </motion.div>
            ) : (
              <motion.div
                key="unliked"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FavoriteBorder fontSize="small" />
              </motion.div>
            )}
          </AnimatePresence>
        </IconButton>
      </motion.div>

      {/* Счётчик с анимацией */}
      <motion.div
        key={likesCount}
        initial={{ scale: 1.3, opacity: 0, y: -5 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.3, 
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: liked
              ? 'rgba(255, 180, 200, 0.95)' // 🌸 пастельный розовый
              : 'rgba(255,255,255,0.75)',
            fontWeight: 600,
            minWidth: 24,
            textAlign: 'left',
            fontSize: '0.875rem',
            textShadow: liked
              ? '0 0 8px rgba(255, 180, 200, 0.4)' // 🌸 мягкая тень
              : 'none',
            transition: 'all 0.2s',
          }}
        >
          {likesCount || 0}
        </Typography>
      </motion.div>
    </Box>
  );
};
