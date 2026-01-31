// src/features/feed/DreamCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Avatar,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Visibility,
  MoreVert,
  PublicOff,
} from '@mui/icons-material';
import type { FeedDream } from './types';
import { LikeButton } from './LikeButton';
import { CommentSection } from './CommentSection';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { request } from '../../utils/api';
import { useFeed } from './useFeed';

const glassBg = 'rgba(255, 255, 255, 0.06)';
const glassBorder = 'rgba(255, 255, 255, 0.10)';
const cardShadow = '0 8px 24px rgba(11,8,36,0.16)';

// ✨ ГЛОБАЛЬНЫЙ SET ДЛЯ ЗАЩИТЫ ОТ ПОВТОРНЫХ ПРОСМОТРОВ
// • Один экземпляр на всё приложение
// • Хранится в памяти JavaScript (не localStorage)
// • Очищается при перезагрузке страницы или закрытии вкладки
const viewedDreamsInSession = new Set<string>();

// 🔥 ФУНКЦИЯ СКЛОНЕНИЯ БЛОКОВ
const getBlocksLabel = (count: number): string => {
  const cases = [2, 0, 1, 1, 1, 2];
  const titles = ['блок', 'блока', 'блоков'];
  return titles[
    count % 100 > 4 && count % 100 < 20
      ? 2
      : cases[count % 10 < 5 ? count % 10 : 5]
  ];
};

interface DreamCardProps {
  dream: FeedDream;
  onLike: (dreamId: string) => void;
  onUnpublish?: (dreamId: string) => void;
  currentUserEmail?: string;
}

export const DreamCard: React.FC<DreamCardProps> = ({ 
  dream, 
  onLike,
  onUnpublish,
  currentUserEmail,
}) => {
  const navigate = useNavigate();
  const { unpublishDream } = useFeed();
  const [expanded, setExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const MAX_PREVIEW_LENGTH = 200;
  const needsExpansion = (dream.dreamText?.length || 0) > MAX_PREVIEW_LENGTH;
  const previewText = needsExpansion && !expanded
    ? `${dream.dreamText?.slice(0, MAX_PREVIEW_LENGTH)}...`
    : dream.dreamText;

  const isOwnDream = currentUserEmail && dream.author.email === currentUserEmail;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'только что';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин назад`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч назад`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} д назад`;

    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // ✨ ТРЕКИНГ ПРОСМОТРОВ С ЗАЩИТОЙ ОТ ПОВТОРОВ
  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        
        // Проверяем: карточка видна на 50% и ещё не была просмотрена
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          // ✅ ЗАЩИТА: проверяем, не был ли сон уже просмотрен в этой сессии
          if (viewedDreamsInSession.has(dream.id)) {
            console.log(`[DreamCard] Dream ${dream.id} already viewed in this session, skipping`);
            return;
          }

          // ✅ Добавляем в список просмотренных (мгновенная операция)
          viewedDreamsInSession.add(dream.id);
          console.log(`[DreamCard] Marking dream ${dream.id} as viewed`);
          console.log(`[DreamCard] Total dreams viewed in session: ${viewedDreamsInSession.size}`);
          
          // ✅ Отправляем запрос на трекинг
          try {
            await request<{ success: boolean; message: string }>(
              `/dreams/${dream.id}/mark-viewed`,
              { method: 'PUT' },
              true
            );
            console.log(`✅ Successfully tracked view for dream ${dream.id}`);
          } catch (error) {
            console.error(`❌ Error tracking view for dream ${dream.id}:`, error);
          }
        }
      },
      {
        threshold: 0.5, // Трекаем когда 50% карточки видно
        rootMargin: '0px',
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [dream.id]); // ✅ Зависимость только от dream.id

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleUnpublish = async () => {
    handleMenuClose();
    setUnpublishing(true);

    try {
      await unpublishDream(dream.id);
      onUnpublish?.(dream.id);
      console.log('✅ Dream unpublished:', dream.id);
    } catch (error) {
      console.error('❌ Error unpublishing dream:', error);
    } finally {
      setUnpublishing(false);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
    >
      <Card
        sx={{
          background: glassBg,
          border: `1px solid ${glassBorder}`,
          borderRadius: 4,
          boxShadow: cardShadow,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          position: 'relative',
          '&:hover': {
            boxShadow: '0 12px 32px rgba(139,92,246,0.2)',
            border: '1px solid rgba(139,92,246,0.3)',
          },
        }}
      >
        {/* Кнопка меню */}
        {isOwnDream && (
          <IconButton
            onClick={handleMenuOpen}
            disabled={unpublishing}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              width: 32,
              height: 32,
              color: 'rgba(255,255,255,0.7)',
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              transition: 'all 0.18s ease',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.95)',
                transform: 'scale(1.05)',
              },
              '&.Mui-disabled': {
                opacity: 0.5,
              },
            }}
          >
            <MoreVert sx={{ fontSize: 18 }} />
          </IconButton>
        )}

        {/* Меню снятия публикации */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 3,
              minWidth: 200,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            },
          }}
          MenuListProps={{
            sx: {
              py: 0.5,
              background: 'transparent',
            },
          }}
        >
          <MenuItem
            onClick={handleUnpublish}
            disabled={unpublishing}
            sx={{
              py: 1,
              px: 1.5,
              color: 'rgba(255,220,230,0.95)',
              transition: 'all 0.2s ease',
              background: 'transparent',
              minHeight: 36,
              '&:hover': {
                background: 'rgba(255,180,200,0.15)',
              },
              '&.Mui-disabled': {
                opacity: 0.5,
                color: 'rgba(255,255,255,0.4)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <PublicOff 
                sx={{ 
                  color: 'rgba(255,160,180,0.95)',
                  fontSize: 18,
                }} 
              />
            </ListItemIcon>
            <ListItemText
              primary={unpublishing ? 'Снимаем...' : 'Снять с публикации'}
              primaryTypographyProps={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'rgba(255,220,230,0.95)',
              }}
            />
          </MenuItem>
        </Menu>

        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flex: 1,
                minWidth: 0,
              }}
            >
              <Avatar
                src={dream.author.avatar || undefined}
                sx={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(88,120,255,0.8), rgba(139,92,246,0.8))',
                  border: '2px solid rgba(255,255,255,0.15)',
                }}
              >
                {dream.author.displayName[0]?.toUpperCase()}
              </Avatar>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 14,
                  }}
                >
                  {dream.author.displayName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.7rem',
                  }}
                >
                  {formatDate(dream.published_at)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {dream.title && (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 1.5,
                color: '#fff',
                fontSize: { xs: '1rem', sm: '1.15rem' },
                lineHeight: 1.3,
                cursor: 'pointer',
                transition: 'color 0.2s',
                '&:hover': {
                  color: 'rgba(165,180,252,1)',
                },
              }}
              onClick={() => navigate(`/dreams/${dream.id}`)}
            >
              {dream.title}
            </Typography>
          )}

          {dream.dreamSummary && (
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                mb: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.5,
                fontSize: '0.85rem',
                fontStyle: 'italic',
              }}
            >
              {dream.dreamSummary}
            </Typography>
          )}

          {dream.dreamText && (
            <>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.8)',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.6,
                  fontSize: '0.85rem',
                  mb: needsExpansion ? 1 : 1.5,
                }}
              >
                {previewText}
              </Typography>

              {needsExpansion && (
                <Chip
                  icon={
                    expanded ? (
                      <ExpandLess 
                        sx={{ 
                          fontSize: 16, 
                          color: 'rgba(240,245,255,0.95)',
                          filter: 'drop-shadow(0 0 3px rgba(200,220,255,0.4))',
                        }} 
                      />
                    ) : (
                      <ExpandMore 
                        sx={{ 
                          fontSize: 16, 
                          color: 'rgba(240,245,255,0.95)',
                          filter: 'drop-shadow(0 0 3px rgba(200,220,255,0.4))',
                        }} 
                      />
                    )
                  }
                  label={expanded ? 'Свернуть' : 'Читать далее'}
                  size="small"
                  onClick={() => setExpanded(!expanded)}
                  sx={{
                    height: 26,
                    mb: 1.5,
                    background: 'rgba(230,240,255,0.2)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(230,240,255,0.35)',
                    boxShadow: '0 0 10px rgba(200,220,255,0.15)',
                    color: 'rgba(240,245,255,0.95)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '& .MuiChip-icon': { ml: 0.5 },
                    '& .MuiChip-label': { px: 1 },
                    '&:hover': {
                      background: 'rgba(230,240,255,0.3)',
                      borderColor: 'rgba(230,240,255,0.45)',
                      boxShadow: '0 0 14px rgba(200,220,255,0.25)',
                      transform: 'scale(1.02)',
                    },
                  }}
                />
              )}
            </>
          )}

          {/* 🔥 ОБНОВЛЁННЫЙ ЧИП С БЛОКАМИ */}
          {dream.blocks && dream.blocks.length > 0 && (
            <Box display="flex" gap={0.75} flexWrap="wrap" mt={1}>
              <Chip
                label={`${dream.blocks.length} ${getBlocksLabel(dream.blocks.length)}`}
                size="small"
                sx={{
                  height: 24,
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(168,85,247,0.25))',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1.5px solid rgba(168,85,247,0.4)',
                  boxShadow: '0 0 12px rgba(139,92,246,0.25)',
                  color: 'rgba(220,200,255,0.95)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  transition: 'all 0.2s',
                  '& .MuiChip-label': { px: 1.5 },
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(168,85,247,0.35))',
                    borderColor: 'rgba(168,85,247,0.6)',
                    boxShadow: '0 0 16px rgba(139,92,246,0.4)',
                    transform: 'scale(1.05)',
                  },
                }}
              />
            </Box>
          )}
        </CardContent>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

        <CardActions
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 56,
          }}
        >
          {/* Левая группа: лайки и комментарии */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <LikeButton
              liked={dream.user_liked}
              likesCount={dream.likes_count}
              onToggle={() => onLike(dream.id)}
            />
            <CommentSection
              dreamId={dream.id}
              initialCommentsCount={dream.comments_count}
            />
          </Box>

          {/* Просмотры справа внизу */}
          {dream.views_count > 0 && (
            <Chip
              icon={
                <Visibility 
                  sx={{ 
                    fontSize: 14, 
                    color: 'rgba(240,245,255,0.95)',
                    filter: 'drop-shadow(0 0 4px rgba(200,220,255,0.4))',
                  }} 
                />
              }
              label={dream.views_count}
              size="small"
              sx={{
                height: 24,
                flexShrink: 0,
                background: 'rgba(230,240,255,0.2)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(230,240,255,0.35)',
                boxShadow: '0 0 10px rgba(200,220,255,0.15)',
                color: 'rgba(240,245,255,0.95)',
                fontSize: '0.7rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                '& .MuiChip-icon': { ml: 0.5 },
                '&:hover': {
                  background: 'rgba(230,240,255,0.3)',
                  borderColor: 'rgba(230,240,255,0.45)',
                  boxShadow: '0 0 14px rgba(200,220,255,0.25)',
                  transform: 'scale(1.02)',
                },
              }}
            />
          )}
        </CardActions>
      </Card>
    </motion.div>
  );
};
