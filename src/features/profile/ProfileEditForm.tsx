// src/screens/ProfileEditForm.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Avatar,
  Typography,
  IconButton,
  Dialog,
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
import AvatarSelector from './AvatarSelector';
import SubscriptionPlanSelector from 'src/features/profile/SubscriptionPlanSelector';
import type { Plan } from 'src/utils/api';

// --- Avatar options ---
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
  { id: '11', icon: 'Palette', name: 'Палитра грез', color: 'rgba(130,150,170,0.78)' },
  { id: '12', icon: 'Circle', name: 'Мягкий кружок', color: 'rgba(180,200,210,0.78)' },
];

const VALID_AVATAR_NAMES = AVATAR_OPTIONS.map(o => o.icon);

const HEADER_BASE = 56;
const FOOTER_HEIGHT = 64;

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
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error' | 'info'>('success');
  const [openAvatarDialog, setOpenAvatarDialog] = useState(false);

  const [inputOpen, setInputOpen] = useState(false);
  const [headerExtra, setHeaderExtra] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const IconComp = getIconComponent(selectedAvatarIcon ?? profile.avatarIcon ?? null);

  // Subscription states
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [selectingPlan, setSelectingPlan] = useState(false);

  // Sync local state when profile changes
  useEffect(() => {
    setName(profile.name || '');
    setSelectedAvatarIcon(profile.avatarIcon ?? null);
  }, [profile.name, profile.avatarIcon]);

  useEffect(() => {
    let mounted = true;

    type MeResponse = {
      email?: string;
      created?: number;
      trialDaysLeft?: number;
      name?: string;
      avatarIcon?: string;
      avatar_icon?: string;
      subscription_plan_id?: string | number | null;
      subscription_plan_title?: string | null;
      subscription?: { 
        id?: string | number; 
        title?: string | null; 
        emoji?: string | null; 
        price?: string | null 
      } | null;
    };

    async function loadMe() {
      try {
        const data = await request<MeResponse>('/me', {}, true);
        if (!mounted || !data) return;

        setServerMeta({
          email: data.email,
          created: typeof data.created === 'number' ? data.created : undefined,
          trialDaysLeft: typeof data.trialDaysLeft === 'number' ? data.trialDaysLeft : undefined,
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

        // Handle subscription data with proper type conversion
        let planData: Plan | null = null;
        
        if (data.subscription) {
          const sub = data.subscription;
          planData = {
            id: String(sub.id ?? ''),
            title: String(sub.title ?? 'Подписка'),
            emoji: sub.emoji ?? '★',
            price: sub.price ?? '',
          };
        } else if (data.subscription_plan_id && data.subscription_plan_title) {
          planData = {
            id: String(data.subscription_plan_id),
            title: String(data.subscription_plan_title),
            emoji: '★',
            price: '',
          };
        }
        
        setSelectedPlan(planData);
      } catch (e) {
        console.debug('Could not load /api/me', e);
      }
    }

    loadMe();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetchPlans() {
      setPlanLoading(true);
      try {
        const json = await request<{ plans: Plan[] }>('/plans', {}, true);
        if (!mounted) return;
        const visible = (json.plans || []).filter(p => (p as any).visible !== false);
        setPlans(visible);
      } catch (e) {
        console.error('Failed to load plans', e);
      } finally {
        if (mounted) setPlanLoading(false);
      }
    }
    fetchPlans();
    return () => { mounted = false; };
  }, []);

  // Sync selected plan with plans list
  useEffect(() => {
    if (plans.length > 0 && selectedPlan) {
      const matchedPlan = plans.find(p => String(p.id) === String(selectedPlan.id));
      if (matchedPlan && matchedPlan !== selectedPlan) {
        setSelectedPlan(matchedPlan);
      }
    }
  }, [plans, selectedPlan]);

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

  const handleAvatarSelectorUpdateAvatar = useCallback((id: string) => {
    const opt = AVATAR_OPTIONS.find(o => o.id === id);
    if (!opt) {
      setSnackSeverity('error');
      setSnackMsg('Неверный id аватара');
      setSnackOpen(true);
      return;
    }
    void saveAvatarToServer(opt.icon);
    setOpenAvatarDialog(false);
  }, []);

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
      const serverAvatarImage = user.avatar_image_url ?? null;

      updateProfile({
        name: serverName,
        avatarIcon: serverAvatar,
        avatarImage: serverAvatarImage,
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

  const createdDate = typeof serverMeta?.created === 'number' ? new Date(serverMeta!.created) : null;
  const createdDateStr = createdDate && !Number.isNaN(createdDate.getTime())
    ? createdDate.toLocaleDateString('ru-RU')
    : undefined;

  const screenGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const glassBorder = 'rgba(255,255,255,0.06)';
  const accentColor = 'rgba(88,120,255,0.95)';

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

  // visualViewport handling
  useEffect(() => {
    const vv = (window as any).visualViewport;
    const update = () => {
      if (vv && typeof vv.height === 'number') {
        const kb = Math.max(0, window.innerHeight - vv.height);
        setKeyboardHeight(kb);
      } else {
        setKeyboardHeight(0);
      }
    };

    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      update();
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    } else {
      const onResize = () => setKeyboardHeight(0);
      window.addEventListener('resize', onResize);
      update();
      return () => window.removeEventListener('resize', onResize);
    }
  }, []);

  useEffect(() => {
    if (inputOpen || keyboardHeight > 0) {
      const computed = Math.min(48, Math.max(6, Math.round(keyboardHeight * 0.03) + 8));
      setHeaderExtra(computed);
    } else {
      setHeaderExtra(0);
    }
  }, [inputOpen, keyboardHeight]);

  const headerTopStr = `calc(env(safe-area-inset-top) + ${headerExtra}px)`;
  const headerHeightStr = `${HEADER_BASE}px`;
  const contentMarginTop = `calc(${HEADER_BASE}px + env(safe-area-inset-top) + ${headerExtra}px)`;
  const contentMarginBottom = `${FOOTER_HEIGHT + Math.ceil(Math.max(0, keyboardHeight)) + 18}px`;

  // Subscription interactions
  const openSubscriptionDialog = async () => {
    try {
      await request('/subscription/modal-open', { method: 'POST' }, true);
    } catch (e) {
      // ignore
    }
    setOpenPlanDialog(true);
  };

  const handleSelectPlan = async (plan: Plan) => {
    setSelectingPlan(true);
    setSelectedPlan(plan); // optimistic update
    setOpenPlanDialog(false);

    try {
      await request<{ ok?: boolean; choice?: any }>('/subscription/choice', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          plan_code: plan.plan_code ?? plan.title,
          chosen_emoji: plan.emoji,
          chosen_price: plan.price,
          is_custom_price: 0,
        }),
      }, true);

      // Refresh user data after successful plan selection
      try {
        const me = await request<{
          subscription?: { 
            id?: string | number; 
            title?: string | null; 
            emoji?: string | null; 
            price?: string | null 
          } | null;
          subscription_plan_id?: string | number | null;
          subscription_plan_title?: string | null;
        }>('/me', {}, true);

        let updatedPlan: Plan | null = null;
        
        if (me?.subscription) {
          const sub = me.subscription;
          updatedPlan = {
            id: String(sub.id ?? plan.id),
            title: String(sub.title ?? plan.title),
            emoji: sub.emoji ?? plan.emoji ?? '★',
            price: sub.price ?? plan.price ?? '',
          };
        } else if (me?.subscription_plan_id && me.subscription_plan_title) {
          updatedPlan = {
            id: String(me.subscription_plan_id),
            title: String(me.subscription_plan_title),
            emoji: plan.emoji ?? '★',
            price: plan.price ?? '',
          };
        } else {
          // Keep optimistic update if server doesn't return subscription data
          updatedPlan = plan;
        }
        
        setSelectedPlan(updatedPlan);
      } catch (e) {
        console.debug('Failed to refresh /me after subscription', e);
        // Keep optimistic update
      }

      setSnackSeverity('success');
      setSnackMsg('Тариф выбран');
      setSnackOpen(true);
    } catch (e: any) {
      console.error('Failed to select plan', e);
      setSnackSeverity('error');
      setSnackMsg('Ошибка при выборе тарифа');
      setSnackOpen(true);
    } finally {
      setSelectingPlan(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: screenGradient,
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            position: 'fixed',
            top: headerTopStr,
            left: 0,
            right: 0,
            height: headerHeightStr,
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 28px rgba(41, 52, 98, 0.12)',
            userSelect: 'none',
            px: 2,
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
            aria-label="Выйти"
            onClick={handleLogoutClick}
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
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          sx={{
            flexGrow: 1,
            marginTop: contentMarginTop,
            marginBottom: contentMarginBottom,
            overflowY: 'auto',
            px: { xs: 2, sm: 4 },
            py: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <Typography
            variant="h5"
            align="center"
            fontWeight="700"
            mb={2}
            sx={{
              mt: 1,
              color: '#fff',
              textShadow: '0 2px 14px rgba(4,6,26,0.28)',
            }}
          >
            Профиль
          </Typography>

          {/* Profile summary */}
          <Box sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            mt: 1,
            mb: 4,
            width: '100%',
            maxWidth: 520
          }}>
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
                  color: '#fff',
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

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
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

                {/* Subscription pill */}
                <Box
                  onClick={openSubscriptionDialog}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openSubscriptionDialog(); }}
                  sx={{
                    px: 1.5,
                    py: 0.6,
                    borderRadius: 999,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    border: selectedPlan ? `1.75px solid ${accentColor}` : `1px solid ${glassBorder}`,
                    bgcolor: selectedPlan ? 'rgba(88,120,255,0.12)' : 'rgba(255,255,255,0.02)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 8px 20px rgba(88,120,255,0.08)',
                    },
                  }}
                  title="Нажмите, чтобы выбрать тариф"
                >
                  {selectingPlan ? (
                    <CircularProgress size={16} sx={{ color: '#fff' }} />
                  ) : selectedPlan ? (
                    <>
                      <Box sx={{ fontSize: '1.05rem' }}>{selectedPlan.emoji}</Box>
                      <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, textAlign: 'left' }}>
                        <span>{selectedPlan.title}</span>
                      </Box>
                      {selectedPlan.price ? <Box sx={{ opacity: 0.95, fontWeight: 800, ml: 1 }}>{selectedPlan.price}</Box> : null}
                    </>
                  ) : (
                    <>
                      <Box sx={{ fontSize: '1.05rem' }}>✨</Box>
                      <Box>Подписка</Box>
                    </>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Name edit */}
          <Box sx={{
            mb: 3,
            width: '100%',
            maxWidth: 520
          }}>
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
              onFocus={() => setInputOpen(true)}
              onBlur={() => setInputOpen(false)}
            />
          </Box>

          {/* Actions */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              mt: 2,
              mb: 3,
              width: '100%',
              maxWidth: 520,
            }}
          >
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
                py: 0,
                height: 44,
                flex: 1,
                borderRadius: 12,
                fontSize: '0.95rem',
                textTransform: 'none',
                '&:hover': { borderColor: accentColor, bgcolor: 'rgba(88,120,255,0.06)' },
                '&.Mui-disabled': { opacity: 0.6 },
              }}
            >
              Отмена
            </Button>

            <Button
              variant="contained"
              type="submit"
              disabled={savingProfile}
              sx={{
                bgcolor: accentColor,
                color: '#fff',
                height: 44,
                px: 3,
                flex: 1,
                borderRadius: 12,
                fontSize: '0.95rem',
                textTransform: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                '&:hover': { bgcolor: 'rgba(88,120,255,0.88)', boxShadow: '0 8px 28px rgba(88,120,255,0.18)' },
                '&.Mui-disabled': { bgcolor: 'rgba(88,120,255,0.6)' },
              }}
            >
              {savingProfile ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Сохранить'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* AvatarSelector */}
      <AvatarSelector
        open={openAvatarDialog}
        onClose={() => setOpenAvatarDialog(false)}
        avatarOptions={AVATAR_OPTIONS}
        profile={profile}
        getIconComponent={getIconComponent}
        updateAvatar={handleAvatarSelectorUpdateAvatar}
        dialogPaperSx={{
          background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
          border: `1px solid ${glassBorder}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 3,
          p: 1,
          color: '#fff',
        }}
      />

      {/* Subscription selector */}
      <SubscriptionPlanSelector
        open={openPlanDialog}
        onClose={() => setOpenPlanDialog(false)}
        plans={plans}
        selectedPlanId={selectedPlan?.id ?? null}
        onSelectPlan={handleSelectPlan}
        dialogPaperSx={{
          background: 'linear-gradient(180deg, rgba(24,24,48,0.96), rgba(12,12,24,0.94))',
          border: `1px solid ${glassBorder}`,
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

        <DialogActions sx={{ px: 3, pb: 2, gap: 2 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={logoutLoading}
            sx={{
              color: '#fff',
              borderRadius: 12,
              height: 44,
              textTransform: 'none',
            }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleConfirmLogout}
            variant="contained"
            disabled={logoutLoading}
            sx={{
              bgcolor: 'rgba(255,100,100,0.95)',
              '&:hover': { bgcolor: 'rgba(255,100,100,0.85)' },
              borderRadius: 12,
              height: 44,
              textTransform: 'none',
            }}
          >
            {logoutLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Выйти'}
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