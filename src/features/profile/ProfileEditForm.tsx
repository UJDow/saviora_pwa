// ProfileEditForm.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Avatar,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  TextField,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import LogoutIcon from '@mui/icons-material/Logout';
import { useProfile } from './ProfileContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { request } from 'src/utils/api';
import AvatarSelector from './AvatarSelector'; // Предполагается, что AvatarSelector находится здесь

// --- Avatar options ---
// Пастельные цвета, расширенные для всех иконок
export const AVATAR_OPTIONS = [
  { id: '1', icon: 'Pets', name: 'Плюшевая лапка', color: 'rgba(83,134,136,0.78)' },
  { id: '2', icon: 'Cloud', name: 'Пушистое облачко', color: 'rgba(118,174,186,0.78)' },
  { id: '3', icon: 'NightsStay', name: 'Сонная ночь', color: 'rgba(160,198,206,0.78)' },
  { id: '4', icon: 'Psychology', name: 'Мягкие мысли', color: 'rgba(228,228,228,0.78)' },
  { id: '5', icon: 'AutoAwesome', name: 'Волшебные блестки', color: 'rgba(229,213,223,0.78)' },
  { id: '6', icon: 'EmojiNature', name: 'Природа снов', color: 'rgba(105,127,163,0.78)' },
  { id: '7', icon: 'WaterDrop', name: 'Капелька сна', color: 'rgba(154,188,221,0.78)' },
  { id: '8', icon: 'LocalFlorist', name: 'Цветочные сны', color: 'rgba(151,194,193,0.78)' },
  { id: '9', icon: 'AcUnit', name: 'Хрустальная снежинка', color: 'rgba(202,216,210,0.78)' },
  { id: '10', icon: 'Bedtime', name: 'Уютная луна', color: 'rgba(201, 193, 183, 0.78)' },
  { id: '11', icon: 'Palette', name: 'Палитра грез', color: 'rgba(130,150,170,0.78)' }, // Дополнительный пастельный
  { id: '12', icon: 'Circle', name: 'Мягкий кружок', color: 'rgba(180,200,210,0.78)' }, // Дополнительный пастельный
];

const VALID_AVATAR_NAMES = AVATAR_OPTIONS.map(o => o.icon);

export function ProfileEditForm() {
  const { profile, updateProfile, getIconComponent } = useProfile();
  const { logout } = useAuth();
  const [name, setName] = useState(profile.name ?? '');
  const [selectedAvatarIcon, setSelectedAvatarIcon] = useState<string | null>(
    profile.avatarIcon ?? null
  );
  const [serverMeta, setServerMeta] = useState<{
    email?: string;
    created?: number;
    trialDaysLeft?: number;
  } | null>(null);

  const navigate = useNavigate();

  // UI state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false); // Это состояние теперь не используется для загрузки изображения, только для иконок
  const [savingProfile, setSavingProfile] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error' | 'info'>('success');
  const [openAvatarDialog, setOpenAvatarDialog] = useState(false);

  // Icon component to render currently selected icon (fallback to profile.avatarIcon)
  // Используем null, чтобы getIconComponent из ProfileContext сам выбрал дефолтную иконку
  const IconComp = getIconComponent(selectedAvatarIcon ?? profile.avatarIcon ?? null);

  // Sync local state when profile changes
  useEffect(() => {
    setName(profile.name || '');
    setSelectedAvatarIcon(profile.avatarIcon ?? null);
  }, [profile.name, profile.avatarIcon]);

  useEffect(() => {
    let mounted = true;
    async function loadMe() {
      try {
        const data = await request<{
          email: string;
          created: number;
          trialDaysLeft: number;
          name?: string;
          avatarIcon?: string;
          avatar_icon?: string;
        }>('/me', {}, true);

        if (!mounted) return;

        setServerMeta({
          email: data.email,
          created: data.created,
          trialDaysLeft: data.trialDaysLeft,
        });

        const serverAvatar = data.avatarIcon ?? data.avatar_icon;
        const serverName = data.name;

        if (serverName && serverName !== profile.name) {
          updateProfile({ name: serverName });
          setName(serverName);
        }

        if (serverAvatar && VALID_AVATAR_NAMES.includes(serverAvatar) && serverAvatar !== profile.avatarIcon) {
          updateProfile({ avatarIcon: serverAvatar });
          setSelectedAvatarIcon(serverAvatar);
        }
      } catch (e) {
        console.debug('Could not load /api/me', e);
      }
    }
    loadMe();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetSnack() {
    setSnackOpen(false);
    setSnackMsg('');
  }

  async function saveAvatarToServer(avatarIcon: string) {
    if (!VALID_AVATAR_NAMES.includes(avatarIcon)) {
      setSnackSeverity('error');
      setSnackMsg('Недопустимая иконка');
      setSnackOpen(true);
      throw new Error('Invalid avatar icon');
    }

    setSavingAvatar(true);
    try {
      const json = await request<{
        ok: boolean;
        user?: {
          id: string;
          email: string;
          name: string;
          avatar_icon: string;
          avatarIcon?: string;
          avatar_image_url?: string;
          created_at?: number;
        };
      }>('/me', {
        method: 'PUT',
        body: JSON.stringify({ avatar_icon: avatarIcon }),
      }, true);

      const user = json.user;
      if (!user) throw new Error('Не удалось получить данные пользователя');

      const serverAvatar = user.avatar_icon || user.avatarIcon || avatarIcon;
      const serverName = user.name;

      updateProfile({
        avatarIcon: serverAvatar,
        // Если мы сохраняем иконку, то avatarImage должен быть null
        avatarImage: null,
        ...(typeof serverName !== 'undefined' ? { name: serverName } : {}),
      });

      setSelectedAvatarIcon(serverAvatar);
      setSnackSeverity('success');
      setSnackMsg('Аватар сохранён');
      setSnackOpen(true);
      return user;
    } catch (e: any) {
      console.error('saveAvatarToServer error', e);
      setSnackSeverity('error');
      setSnackMsg(e?.message || 'Не удалось сохранить аватар');
      setSnackOpen(true);
      throw e;
    } finally {
      setSavingAvatar(false);
    }
  }

  // User clicked option inside AvatarSelector (it returns id)
  const handleAvatarSelectorUpdateAvatar = useCallback((id: string) => {
    const opt = AVATAR_OPTIONS.find(o => o.id === id);
    if (!opt) {
      setSnackSeverity('error');
      setSnackMsg('Неверный id аватара');
      setSnackOpen(true);
      return;
    }
    // Use same flow as before: save by icon name
    void saveAvatarToServer(opt.icon);
    setOpenAvatarDialog(false); // Закрываем диалог после выбора
  }, []);

  // Обработчик для загрузки/сброса изображения аватара удален, так как функционал убран из AvatarSelector.
  // Если в будущем потребуется, его нужно будет восстановить вместе с UI в AvatarSelector.

  const handleSave = async () => {
    setSavingProfile(true);
    try {
      const json = await request<{
        ok: boolean;
        user?: {
          id: string;
          email: string;
          name: string;
          avatar_icon?: string;
          avatarIcon?: string;
          avatar_image_url?: string;
          created_at?: number;
        };
      }>('/me', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          avatar_icon: selectedAvatarIcon ?? undefined,
        }),
      }, true);

      const user = json.user;
      if (!user) throw new Error('Не удалось получить данные пользователя');

      const serverAvatar = user.avatar_icon || user.avatarIcon || selectedAvatarIcon || null;
      const serverName = user.name ?? name;
      const serverAvatarImage = user.avatar_image_url ?? null; // Получаем avatarImage с сервера

      updateProfile({
        name: serverName,
        avatarIcon: serverAvatar,
        avatarImage: serverAvatarImage, // Обновляем avatarImage из ответа сервера
      });

      setSnackSeverity('success');
      setSnackMsg('Профиль сохранён');
      setSnackOpen(true);
      navigate(-1);
    } catch (e: any) {
      console.error('Save profile error', e);
      setSnackSeverity('error');
      setSnackMsg(e?.message || 'Не удалось сохранить профиль');
      setSnackOpen(true);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogoutClick = () => setConfirmOpen(true);

  const handleConfirmLogout = async () => {
    setLogoutLoading(true);
    try {
      await Promise.resolve(logout && logout());
    } finally {
      setLogoutLoading(false);
      setConfirmOpen(false);
      try { localStorage.removeItem('saviora_jwt'); } catch {}
      navigate('/auth', { replace: true });
    }
  };

  // Safe created date formatting (avoids Invalid Date)
  const createdDate = typeof serverMeta?.created === 'number' ? new Date(serverMeta!.created) : null;
  const createdDateStr = createdDate && !Number.isNaN(createdDate.getTime())
    ? createdDate.toLocaleDateString('ru-RU')
    : undefined;

  // Styling constants (kept as before)
  const screenGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const glassBorder = 'rgba(255,255,255,0.06)';
  const accentColor = 'rgba(88,120,255,0.95)';

  const pageSx = {
    minHeight: '100vh',
    background: screenGradient,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative' as const,
    overflow: 'hidden',
    p: { xs: 2, sm: 4 },
  };

  const mainCardSx = {
    width: '100%',
    maxWidth: { xs: '100%', sm: 520 },
    borderRadius: 3,
    background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${glassBorder}`,
    boxShadow: '0 12px 60px rgba(24,32,80,0.28)',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '72vh',
    overflow: 'hidden',
    color: '#fff',
    p: { xs: 3, sm: 4 },
    mt: { xs: 4, sm: 6 },
  };

  const unifiedIconBtnSx = {
    position: 'absolute',
    top: 16,
    left: 16,
    color: '#fff',
    bgcolor: 'transparent',
    borderRadius: '50%',
    p: 1,
    transition: 'background-color 0.18s, box-shadow 0.18s, transform 0.12s',
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.08)',
      boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: '2px solid rgba(255,255,255,0.12)',
      outlineOffset: 3,
    },
    zIndex: 10,
  } as const;

  const avatarWrapperSx = {
    cursor: 'pointer',
    display: 'inline-block',
    borderRadius: '50%',
    border: `2px solid rgba(255,255,255,0.06)`,
    p: 1,
    transition: 'all 0.18s ease',
    '&:hover': {
      transform: 'scale(1.03)',
      boxShadow: '0 10px 30px rgba(88,120,255,0.18)',
    },
  };

  return (
    <>
      <Box sx={pageSx}>
        <Box
          sx={mainCardSx}
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <IconButton
            onClick={() => navigate(-1)}
            aria-label="Назад"
            sx={unifiedIconBtnSx}
            size="large"
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>

          <Typography
            variant="h5"
            align="center"
            fontWeight="700"
            mb={1}
            sx={{
              mt: 1,
              color: '#fff',
              textShadow: '0 2px 14px rgba(4,6,26,0.28)',
            }}
          >
            Профиль
          </Typography>

          {/* Profile summary */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1, mb: 3 }}>
            <Box
              onClick={() => setOpenAvatarDialog(true)}
              sx={avatarWrapperSx}
              title="Нажмите, чтобы выбрать аватар"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenAvatarDialog(true); }}
            >
              <Avatar
  sx={{
    width: 98,
    height: 98,
    bgcolor: profile.avatarImage
      ? undefined
      : AVATAR_OPTIONS.find((o) => o.icon === (selectedAvatarIcon ?? profile.avatarIcon))?.color ?? '#f0f0f0',
    color: '#fff', // <- белая заливка иконки
    border: `2px solid ${accentColor}`,
  }}
  src={profile.avatarImage ?? undefined}
>
  {!profile.avatarImage && <IconComp />}
</Avatar>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#fff' }}>
                {name || profile.name || 'Пользователь'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>
                {serverMeta?.email ?? profile.email ?? '—'}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${glassBorder}`,
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                }}>
                  <Typography component="span" sx={{ fontWeight: 700 }}>
                    {serverMeta?.trialDaysLeft ?? '-'}
                  </Typography>
                  <Typography component="span" sx={{ opacity: 0.8, fontSize: '0.86rem' }}>
                    дней триала
                  </Typography>
                </Box>

                {createdDateStr && (
                  <Box sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 999,
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${glassBorder}`,
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '0.82rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                  }}>
                    <Typography component="span" sx={{ fontSize: '0.82rem' }}>
                      слушает себя с {createdDateStr}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* Name edit */}
          <Box sx={{ mb: 2 }}>
            <TextField
              label="Имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              sx={{
                mb: 0,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                  '&:hover fieldset': { borderColor: accentColor },
                  '&.Mui-focused fieldset': { borderColor: accentColor },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                '& .MuiInputBase-input': { color: '#fff' },
              }}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.85)' } }}
            />
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setName(profile.name || '');
                setSelectedAvatarIcon(profile.avatarIcon ?? null);
                setSnackSeverity('info');
                setSnackMsg('Изменения отменены');
                setSnackOpen(true);
              }}
              sx={{
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                py: 1.1,
                flex: 1,
                '&:hover': { borderColor: accentColor, bgcolor: 'rgba(88,120,255,0.06)' },
              }}
            >
              Отмена
            </Button>

            <Button
              variant="contained"
              type="submit"
              sx={{
                bgcolor: accentColor,
                color: '#fff',
                py: 1.1,
                px: 3,
                '&:hover': { bgcolor: 'rgba(88,120,255,0.88)', boxShadow: '0 8px 28px rgba(88,120,255,0.18)' },
              }}
              disabled={savingProfile}
            >
              {savingProfile ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Сохранить'}
            </Button>
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* Simple logout (icon + text) in bottom-right */}
          <Box sx={{ position: 'absolute', right: 16, bottom: 16 }}>
            <Button
              onClick={handleLogoutClick}
              startIcon={<LogoutIcon />}
              sx={{
                textTransform: 'none',
                color: 'rgba(255,255,255,0.8)', // Нейтральный цвет
                bgcolor: 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                px: 1.25,
                py: 0.5,
                borderRadius: 2,
                border: `1px solid rgba(255,255,255,0.04)`,
              }}
            >
              Выйти
            </Button>
          </Box>
        </Box>
      </Box>

      {/* AvatarSelector — uses your Swiper-based selector */}
      <AvatarSelector
        open={openAvatarDialog}
        onClose={() => setOpenAvatarDialog(false)}
        avatarOptions={AVATAR_OPTIONS} // Передаем AVATAR_OPTIONS напрямую
        profile={profile} // Передаем объект profile напрямую
        getIconComponent={getIconComponent}
        updateAvatar={handleAvatarSelectorUpdateAvatar}
        // updateAvatarImage удален, так как функционал загрузки/сброса изображения убран
        // Если TypeScript ругается, что updateAvatarImage отсутствует,
        // убедитесь, что в AvatarSelectorProps он помечен как опциональный (updateAvatarImage?: ...)
        dialogPaperSx={{
          // glassmorph style (в духе SimilarArtworksScreen)
          background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
          border: `1px solid ${glassBorder}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 3,
          p: 1,
          color: '#fff',
        }}
      />

      {/* Logout confirm */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        aria-labelledby="logout-dialog-title"
        PaperProps={{
          sx: {
            // glassmorph paper (как в примере)
            background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 3,
            border: `1px solid ${glassBorder}`,
            color: '#fff',
            px: 0,
          }
        }}
      >
        <Box sx={{ px: 3, pt: 2 }}>
          <Typography id="logout-dialog-title" variant="h6" sx={{ color: '#fff' }}>Подтвердите выход</Typography>
        </Box>

        <Box sx={{ px: 3, py: 1 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>Вы действительно хотите выйти из аккаунта?</Typography>
        </Box>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={logoutLoading} sx={{ color: '#fff' }}>
            Отмена
          </Button>
          <Button
            onClick={handleConfirmLogout}
            variant="contained"
            disabled={logoutLoading}
            sx={{ bgcolor: 'rgba(255,100,100,0.95)', '&:hover': { bgcolor: 'rgba(255,100,100,0.85)' } }}
          >
            {logoutLoading ? 'Выход...' : 'Выйти'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackOpen}
        autoHideDuration={3400}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackOpen(false)}
          severity={snackSeverity}
          sx={{
            width: '100%',
            '& .MuiAlert-message': { fontSize: '0.95rem' },
            bgcolor: 'rgba(0,0,0,0.35)',
            color: '#fff',
            border: `1px solid ${glassBorder}`,
            backdropFilter: 'blur(6px)',
          }}
        >
          {snackMsg}
        </Alert>
      </Snackbar>
    </>
  );
}

export default ProfileEditForm;