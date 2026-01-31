// src/features/feed/PublishButton.tsx
import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import { Public, Lock, Close } from '@mui/icons-material';
import { motion } from 'framer-motion';

interface PublishButtonProps {
  dreamId: string;
  isPublic: boolean;
  onPublish: (dreamId: string) => Promise<any>;
  onUnpublish: (dreamId: string) => Promise<any>;
  onSuccess?: () => void;
}

// ===== Пастельная стеклянная палитра =====
const glassBg = 'rgba(255, 255, 255, 0.12)';
const glassBorder = 'rgba(255, 255, 255, 0.25)';
const pastelPurpleGradient = 'linear-gradient(135deg, rgba(165,180,252,0.3), rgba(192,132,252,0.25))';
const pastelPinkGradient = 'linear-gradient(135deg, rgba(255,200,220,0.3), rgba(255,180,200,0.25))';

export const PublishButton: React.FC<PublishButtonProps> = ({
  dreamId,
  isPublic,
  onPublish,
  onUnpublish,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const handleTogglePublish = async () => {
    setLoading(true);
    try {
      if (isPublic) {
        await onUnpublish(dreamId);
      } else {
        await onPublish(dreamId);
      }
      setShowDialog(false);
      onSuccess?.();
    } catch (err) {
      console.error('Failed to toggle publish:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
  fullWidth
  startIcon={isPublic ? <Lock /> : <Public />}
  onClick={() => setShowDialog(true)}
  sx={{
    textTransform: 'none',
    fontWeight: 600,
    py: 0.75,
    px: 2,
    fontSize: '0.8125rem',
    minHeight: 36,
    background: 'transparent', // 🔥 прозрачный фон
    backdropFilter: 'none', // 🔥 без размытия
    WebkitBackdropFilter: 'none',
    border: 'none', // 🔥 без границы
    color: 'rgba(255,220,230,0.95)',
    boxShadow: 'none',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(255,255,255,0.08)', // 🔥 легкий фон при ховере
      color: 'rgba(255,220,230,1)',
    },
    '& .MuiButton-startIcon': {
      color: isPublic ? 'rgba(255,160,180,0.95)' : 'rgba(165,180,252,0.95)',
      marginRight: 0.5,
    },
  }}
>
  {isPublic ? 'Снять с публикации' : 'Поделиться в ленте'}
</Button>


      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: glassBg, // 🔥 светлое стекло
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${glassBorder}`,
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(11,8,36,0.15)',
          },
        }}
        BackdropProps={{
          sx: {
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          },
        }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                color: 'rgba(255,220,230,0.95)', // 🔥 пастельный текст
                letterSpacing: 0.3,
              }}
            >
              {isPublic ? 'Снять сон с публикации?' : 'Опубликовать сон?'}
            </Typography>
            <IconButton
              onClick={() => setShowDialog(false)}
              size="small"
              sx={{
                color: 'rgba(255,220,230,0.9)',
                background: 'transparent',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${glassBorder}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'rgba(255,255,255,0.15)',
                  color: 'rgba(255,220,230,1)',
                  transform: 'rotate(90deg)',
                },
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {isPublic ? (
            <Box>
              <Typography
                variant="body1"
                mb={2}
                sx={{
                  color: 'rgba(255,220,230,0.90)',
                  lineHeight: 1.6,
                  fontWeight: 500,
                }}
              >
                Ваш сон станет приватным и исчезнет из публичной ленты.
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,220,230,0.75)',
                  lineHeight: 1.55,
                }}
              >
                Все лайки и комментарии будут сохранены, но другие пользователи больше не смогут
                видеть этот сон.
              </Typography>
            </Box>
          ) : (
            <Box>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Typography
                  variant="body1"
                  mb={2}
                  sx={{
                    color: 'rgba(255,220,230,0.90)',
                    lineHeight: 1.6,
                    fontWeight: 500,
                  }}
                >
                  Ваш сон появится в публичной ленте, где его смогут увидеть другие пользователи.
                </Typography>
                <Box
                  sx={{
                    p: 2.5,
                    mb: 2,
                    borderRadius: 2.5,
                    background: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${glassBorder}`,
                    boxShadow: 'none',
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    mb={1.5}
                    sx={{
                      color: 'rgba(255,220,230,0.95)',
                      letterSpacing: 0.2,
                    }}
                  >
                    ✨ Что это значит:
                  </Typography>
                  <Typography
                    variant="body2"
                    component="ul"
                    sx={{
                      pl: 2,
                      m: 0,
                      color: 'rgba(255,220,230,0.85)',
                      lineHeight: 1.8,
                      fontWeight: 450,
                      '& li': {
                        mb: 0.5,
                      },
                      '& li::marker': {
                        color: 'rgba(192,132,252,0.75)',
                      },
                    }}
                  >
                    <li>Пользователи смогут ставить лайки</li>
                    <li>Появится возможность комментировать</li>
                    <li>Сон попадёт в публичную ленту</li>
                    <li>Вы можете снять публикацию в любой момент</li>
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255,220,230,0.70)',
                    lineHeight: 1.55,
                  }}
                >
                  Убедитесь, что сон не содержит слишком личной информации, которой вы не хотите
                  делиться.
                </Typography>
              </motion.div>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1.5 }}>
          <Button
            onClick={() => setShowDialog(false)}
            disabled={loading}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              px: 2.5,
              py: 1,
              borderRadius: 999,
              color: 'rgba(255,220,230,0.90)',
              background: 'transparent',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${glassBorder}`,
              transition: 'all 0.2s ease',
              '&:hover': {
                background: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,220,230,1)',
                border: '1px solid rgba(255,255,255,0.35)',
              },
              '&:disabled': {
                opacity: 0.4,
                color: 'rgba(255,255,255,0.5)',
              },
            }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleTogglePublish}
            disabled={loading}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1,
              borderRadius: 999,
              color: 'rgba(255,220,230,0.95)',
              background: isPublic
                ? pastelPinkGradient // 🔥 пастельный розовый
                : pastelPurpleGradient, // 🔥 пастельный фиолетовый
              backdropFilter: 'blur(10px)',
              border: `1px solid ${glassBorder}`,
              boxShadow: 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: isPublic
                  ? 'linear-gradient(135deg, rgba(255,200,220,0.4), rgba(255,180,200,0.35))'
                  : 'linear-gradient(135deg, rgba(165,180,252,0.4), rgba(192,132,252,0.35))',
                transform: 'translateY(-2px)',
                boxShadow: isPublic
                  ? '0 6px 24px rgba(255,180,200,0.2)'
                  : '0 6px 24px rgba(165,180,252,0.2)',
                border: '1px solid rgba(255,255,255,0.35)',
              },
              '&:disabled': {
                opacity: 0.5,
                color: 'rgba(255,255,255,0.6)',
              },
            }}
          >
            {loading ? 'Загрузка...' : isPublic ? 'Снять публикацию' : 'Опубликовать'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
