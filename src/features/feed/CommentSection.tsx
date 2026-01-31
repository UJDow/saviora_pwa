// src/features/feed/CommentSection.tsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Avatar,
  IconButton,
  Drawer,
  CircularProgress,
  Divider,
} from '@mui/material';
import { ChatBubbleOutline, Send, Close } from '@mui/icons-material';
import { useComments } from './useComments';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// ===== Пастельная палитра =====
const glassBg = 'rgba(255, 255, 255, 0.06)';
const glassBorder = 'rgba(255, 255, 255, 0.10)';

// 🌸 Пастельный стиль для кнопки Send
const pastelSendButtonStyle = {
  background: 'rgba(190, 220, 255, 0.30)', // 🔥 пастельный голубой (было фиолетовый)
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1.5px solid rgba(200, 230, 255, 0.45)', // 🔥 светло-голубая граница
  boxShadow: '0 0 16px rgba(180, 210, 255, 0.3), inset 0 0 20px rgba(255,255,255,0.15)',
  color: 'rgba(255, 255, 255, 0.95)',
  width: 48,
  height: 48,
  flexShrink: 0,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: 'rgba(200, 230, 255, 0.40)',
    borderColor: 'rgba(220, 240, 255, 0.60)',
    boxShadow: '0 0 24px rgba(180, 210, 255, 0.5), inset 0 0 24px rgba(255,255,255,0.2)',
    transform: 'scale(1.08) rotate(5deg)', // 🔥 добавили вращение
  },
  '&:active': {
    transform: 'scale(0.92) rotate(-5deg)',
  },
  '&:disabled': {
    background: glassBg,
    color: 'rgba(255,255,255,0.3)',
    boxShadow: 'none',
    opacity: 0.5,
  },
};

interface CommentSectionProps {
  dreamId: string;
  initialCommentsCount: number;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  dreamId,
  initialCommentsCount,
}) => {
  const { comments, loading, addComment } = useComments(dreamId);
  const [open, setOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasNewComments, setHasNewComments] = useState(false); // 🔥 для индикатора

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await addComment(newComment.trim());
      setNewComment('');
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([10, 20, 10]); // 🔥 более сложная вибрация
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAddComment();
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setHasNewComments(false);
  };

  return (
    <>
      {/* Кнопка открытия комментариев */}
      <Box 
        display="flex" 
        alignItems="center" 
        gap={0.5}
        sx={{ minHeight: 40, position: 'relative' }}
      >
        <motion.div 
          whileHover={{ scale: 1.1 }} 
          whileTap={{ scale: 0.9 }}
        >
          <IconButton
            size="small"
            onClick={handleOpen}
            sx={{
              color: 'rgba(190, 220, 255, 0.85)', // 🔥 пастельный голубой
              transition: 'all 0.2s',
              flexShrink: 0,
              position: 'relative',
              '&:hover': {
                color: 'rgba(200, 230, 255, 0.95)',
                bgcolor: 'rgba(190, 220, 255, 0.15)',
              },
            }}
          >
            {/* 🔥 Анимация покачивания иконки */}
            <motion.div
              animate={
                comments.length > 0
                  ? {
                      y: [0, -3, 0],
                    }
                  : {}
              }
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            >
              <ChatBubbleOutline fontSize="small" />
            </motion.div>

            {/* Пульсирующий индикатор новых комментов */}
            {comments.length > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'rgba(180, 210, 255, 0.9)',
                  boxShadow: '0 0 8px rgba(180, 210, 255, 0.8)',
                }}
              />
            )}
          </IconButton>
        </motion.div>

        <Typography
          variant="body2"
          sx={{
            color: 'rgba(190, 220, 255, 0.85)', // 🔥 пастельный голубой
            cursor: 'pointer',
            fontWeight: 600,
            minWidth: 24,
            textAlign: 'left',
            transition: 'color 0.2s',
            '&:hover': {
              color: 'rgba(200, 230, 255, 0.95)',
            },
          }}
          onClick={handleOpen}
        >
          {comments.length || initialCommentsCount || 0}
        </Typography>
      </Box>

      {/* Bottom Sheet Drawer */}
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            background: 'transparent',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            border: `1px solid ${glassBorder}`,
            borderBottom: 'none',
            boxShadow: '0 -8px 32px rgba(11,8,36,0.2)',
            maxHeight: '85vh',
            pb: 'env(safe-area-inset-bottom)',
          },
        }}
        BackdropProps={{
          sx: {
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(0,0,0,0.5)',
          },
        }}
      >
        {/* Drag Handle */}
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.3)',
            mx: 'auto',
            mt: 1.5,
            mb: 1,
          }}
        />

        {/* Header */}
        <Box 
          sx={{ 
            px: 3, 
            py: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                color: '#fff',
                letterSpacing: 0.3,
              }}
            >
              Комментарии
            </Typography>
            <Box
              sx={{
                px: 1.5,
                py: 0.3,
                borderRadius: 999,
                background: 'rgba(190, 220, 255, 0.20)', // 🔥 пастельный голубой
                border: '1px solid rgba(190, 220, 255, 0.35)',
                boxShadow: '0 0 8px rgba(180, 210, 255, 0.2)',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(220, 240, 255, 0.95)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              >
                {comments.length}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setOpen(false)}
            size="small"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              background: glassBg,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${glassBorder}`,
              transition: 'all 0.2s ease',
              '&:hover': {
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                transform: 'rotate(90deg)',
              },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: glassBorder, mx: 2 }} />

        {/* Список комментариев */}
        <Box 
          sx={{
            px: 2,
            py: 2,
            overflowY: 'auto',
            maxHeight: 'calc(85vh - 200px)',
            '&::-webkit-scrollbar': {
              width: 6,
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(190, 220, 255, 0.3)', // 🔥 пастельный голубой
              borderRadius: 999,
              '&:hover': {
                background: 'rgba(190, 220, 255, 0.5)',
              },
            },
          }}
        >
          {loading && comments.length === 0 ? (
            <Box 
              display="flex" 
              justifyContent="center" 
              alignItems="center"
              py={6}
            >
              <CircularProgress 
                size={32} 
                sx={{ 
                  color: 'rgba(190, 220, 255, 0.8)',
                  filter: 'drop-shadow(0 0 8px rgba(180, 210, 255, 0.5))',
                }} 
              />
            </Box>
          ) : comments.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                px: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: 'rgba(255,255,255,0.9)',
                  mb: 1,
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                Пока нет комментариев
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.6,
                  fontSize: '0.875rem',
                }}
              >
                Будьте первым, кто поделится мыслями! 💬
              </Typography>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              <AnimatePresence>
                {comments.map((comment, index) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ 
                      duration: 0.3,
                      delay: Math.min(index * 0.05, 0.2),
                      ease: [0.4, 0, 0.2, 1],
                    }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        background: glassBg,
                        border: `1px solid ${glassBorder}`,
                        borderRadius: 2.5,
                        transition: 'all 0.2s',
                        '&:hover': {
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderColor: 'rgba(190, 220, 255, 0.3)', // 🔥 пастельный голубой
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <Box display="flex" gap={1.5}>
                        <Avatar
                          sx={{ 
                            width: 36, 
                            height: 36,
                            flexShrink: 0,
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(99,102,241,0.8))',
                            border: `2px solid ${glassBorder}`,
                          }}
                          src={comment.author.avatar || undefined}
                        >
                          {comment.author.displayName[0]?.toUpperCase()}
                        </Avatar>
                        <Box flex={1} minWidth={0}>
                          <Box 
                            display="flex" 
                            alignItems="center" 
                            gap={1} 
                            mb={0.5} 
                            flexWrap="wrap"
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: '#fff',
                                fontSize: '0.875rem',
                              }}
                            >
                              {comment.author.displayName}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '0.7rem',
                              }}
                            >
                              {formatDistanceToNow(new Date(comment.created_at), {
                                locale: ru,
                                addSuffix: true,
                              })}
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'rgba(255,255,255,0.85)',
                              lineHeight: 1.6,
                              fontSize: '0.875rem',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {comment.text}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Box>
          )}
        </Box>

        {/* Поле ввода */}
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            background: 'transparent',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderTop: `1px solid ${glassBorder}`,
            px: 2,
            py: 2,
            pb: 'calc(16px + env(safe-area-inset-bottom))',
          }}
        >
          <Box display="flex" gap={1} alignItems="flex-end">
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Поделитесь своими мыслями..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={submitting}
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  background: glassBg,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderRadius: 3,
                  fontSize: '0.9375rem',
                  py: 1.5,
                  transition: 'all 0.2s',
                  '& fieldset': {
                    borderColor: glassBorder,
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(190, 220, 255, 0.4)', // 🔥 пастельный голубой
                  },
                  '&.Mui-focused': {
                    background: 'rgba(255, 255, 255, 0.08)',
                    '& fieldset': {
                      borderColor: 'rgba(190, 220, 255, 0.6)', // 🔥 пастельный голубой
                      borderWidth: 1,
                    },
                  },
                },
                '& .MuiInputBase-input::placeholder': {
                  color: 'rgba(255,255,255,0.4)',
                  opacity: 1,
                },
              }}
            />
            {/* 🌸 Пастельная кнопка Send */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
            >
              <IconButton
                onClick={handleAddComment}
                disabled={!newComment.trim() || submitting}
                sx={pastelSendButtonStyle}
              >
                {submitting ? (
                  <CircularProgress 
                    size={20} 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.95)',
                      filter: 'drop-shadow(0 0 6px rgba(180, 210, 255, 0.5))',
                    }} 
                  />
                ) : (
                  <motion.div
                    animate={{ x: [0, 2, 0] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                  >
                    <Send 
                      fontSize="small" 
                      sx={{
                        filter: 'drop-shadow(0 0 6px rgba(180, 210, 255, 0.5))',
                      }}
                    />
                  </motion.div>
                )}
              </IconButton>
            </motion.div>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};
