// src/screens/UserProfileScreen.tsx
import React, { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useNavigate } from 'react-router-dom';
import { useProfile } from './ProfileContext';
import { AVATAR_OPTIONS } from './ProfileEditForm';
import { MoodSlider } from './mood/MoodSlider';
import { setMoodForDate } from 'src/utils/api';
import { getLocalDateStr } from 'src/utils/dateUtils';
import RecentInsightsGrid from 'src/features/insights/RecentInsightsGrid';

const HEADER_BASE_HEIGHT = 56; // внутренняя высота хедера (контент)
const FOOTER_HEIGHT = 64; // высота "невидимого" футера (мы учитываем как отступ снизу)

export function UserProfileScreen() {
  const navigate = useNavigate();
  const { profile, getIconComponent, refreshProfile, updateProfile } = useProfile();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [moodSaving, setMoodSaving] = useState(false);

  const open = Boolean(anchorEl);

  const shareUrl = window.location.origin + '/auth';
  const shareText = `👋 Привет! Я веду дневник сновидений в "Saviora". Присоединяйся — это реально интересно! 🌙✨

Регистрируйся по ссылке: ${shareUrl}`;

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleEdit = () => {
    handleMenuClose();
    navigate('/profile/edit');
  };

  const handleShare = async () => {
    handleMenuClose();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Сны — приложение для ведения дневника снов',
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // ignore share failure, fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setSnackbarMessage('Текст приглашения скопирован в буфер обмена.');
      setSnackbarSeverity('success');
    } catch {
      setSnackbarMessage('Не удалось скопировать текст.');
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleSaveMood = async (moodId: string) => {
    setMoodSaving(true);
    try {
      if (!moodId) throw new Error('Не выбрано настроение для сохранения.');

      const todayStr = getLocalDateStr();
      await setMoodForDate(todayStr, moodId);
      updateProfile?.({ todayMood: moodId });
      await refreshProfile();

      setSnackbarMessage('Настроение сохранено.');
      setSnackbarSeverity('success');
    } catch (err: any) {
      console.error('[UserProfile] Ошибка сохранения настроения:', err);
      setSnackbarMessage(err?.message || 'Ошибка при сохранении настроения.');
      setSnackbarSeverity('error');
      throw err;
    } finally {
      setMoodSaving(false);
      setSnackbarOpen(true);
    }
  };

  const IconComp = getIconComponent(profile.avatarIcon ?? 'Pets');
  const avatarColor =
    AVATAR_OPTIONS.find((o) => o.icon === (profile.avatarIcon ?? 'Pets'))?.color ?? '#f0f0f0';

  const screenGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const glassBorder = 'rgba(255,255,255,0.06)';

  // Отступ сверху для хедера: безопасная зона + небольшой offset (8px)
  const headerTop = `calc(env(safe-area-inset-top) + 8px)`;
  const headerHeight = `${HEADER_BASE_HEIGHT}px`;

  // Отступы для скроллящейся области: учитывать высоту хедера + safe area + маленький offset
  const contentMarginTop = `calc(${HEADER_BASE_HEIGHT}px + env(safe-area-inset-top) + 8px)`;
  const contentMarginBottom = `${FOOTER_HEIGHT}px`;

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: screenGradient,
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
        // чтобы iOS корректно показывал safe area снизу/сверху
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ========== Header (fixed, с safe-area) ========== */}
      <Box
        sx={{
          position: 'fixed',
          top: headerTop,
          left: 0,
          right: 0,
          height: headerHeight,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1400,
          userSelect: 'none',
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 8px 28px rgba(41, 52, 98, 0.12)',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          transition: 'top 0.28s ease, height 0.18s ease',
        }}
      >
        <IconButton
          aria-label="Назад"
          onClick={() => navigate(-1)}
          sx={{
            position: 'absolute',
            left: 12,
            color: '#fff',
            bgcolor: 'transparent',
            borderRadius: '50%',
            p: 1,
            zIndex: 1500,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
          }}
          size="large"
        >
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>

        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '1.05rem',
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: 0.4,
            userSelect: 'none',
          }}
        >
          Saviora
        </Typography>

        <IconButton
          aria-label="дополнительные опции"
          onClick={handleMenuClick}
          sx={{
            position: 'absolute',
            right: 12,
            color: '#fff',
            bgcolor: 'transparent',
            borderRadius: '50%',
            p: 1,
            zIndex: 1500,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
          }}
          size="large"
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ========== Content (scrollable, учитывает header & footer) ========== */}
      <Box
        sx={{
          flexGrow: 1,
          marginTop: contentMarginTop,
          marginBottom: contentMarginBottom,
          overflowY: 'auto',
          px: { xs: 2, sm: 4 },
          py: 3,
          position: 'relative',
        }}
      >
        {/* Меню — открывается "под" кнопкой (нижняя привязка), glass style, скругления сверху */}
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              mt: '6px',
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid rgba(255, 255, 255, 0.3)`,
              color: '#fff',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              zIndex: 1600,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            },
          }}
        >
          <MenuItem onClick={handleEdit}>Изменить</MenuItem>
          <MenuItem onClick={handleShare}>Поделиться</MenuItem>
        </Menu>

        {/* Header area in content: avatar + name (left) and MoodSlider (right) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr minmax(240px, 420px)' },
            alignItems: 'center',
            gap: 2,
            mt: 4,
            px: { xs: 0, sm: 1 },
            width: '100%',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: { xs: 72, sm: 92 },
                height: { xs: 72, sm: 92 },
                bgcolor: avatarColor,
                color: '#fff',
                boxShadow: '0 6px 20px rgba(24,32,80,0.18)',
                border: `2px solid rgba(255,255,255,0.06)`,
              }}
            >
              {IconComp ? <IconComp /> : null}
            </Avatar>

            <Box>
              <Typography variant="h5" fontWeight="bold" sx={{ color: '#fff' }}>
                {profile.name || 'Пользователь'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                Пользователь
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              justifySelf: { xs: 'stretch', sm: 'end' },
              alignSelf: 'center',
              width: { xs: '100%', sm: 360, md: 420 },
              maxWidth: '48vw',
            }}
          >
            {moodSaving ? (
              <CircularProgress size={24} sx={{ color: 'rgba(255,255,255,0.7)' }} />
            ) : (
              <MoodSlider
                value={profile.todayMood ?? null}
                onChange={handleSaveMood}
                closeOnSelect="confirmed"
                transferToProfileOnSelect={false}
                startCollapsed={Boolean(profile.todayMood)}
                disabled={profile.loading || moodSaving}
                ready={!profile.loading}
              />
            )}
          </Box>
        </Box>

        {/* Остальная разметка профиля */}
        <Box sx={{ mt: 4, px: { xs: 0, sm: 1 }, pb: 6 }}>
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
              Последние инсайты
            </Typography>
            <RecentInsightsGrid maxItems={12} />
          </Box>
        </Box>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{
            width: '100%',
            alignItems: 'center',
            bgcolor: 'rgba(0,0,0,0.35)',
            color: '#fff',
            border: `1px solid ${glassBorder}`,
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default UserProfileScreen;