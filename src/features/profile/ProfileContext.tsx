// src/features/profile/ProfileContext.tsx
import React, {
  createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode, type FC,
} from 'react';
import {
  Pets, Cloud, NightsStay, Psychology, AutoAwesome, EmojiNature, WaterDrop,
  LocalFlorist, AcUnit, Bedtime, Palette, Circle,
} from '@mui/icons-material';
import { request, getMoodForDate } from 'src/utils/api';
import { Box, Paper, Dialog, Avatar } from '@mui/material';
import AvatarSelector from './AvatarSelector';
import { ProfileEditForm } from './ProfileEditForm';
import { useAuth } from 'src/features/auth/AuthProvider';
import { getLocalDateStr } from 'src/utils/dateUtils';

// --- Types ---
export type Achievement = { id: string; title: string; date: string };
export type Stat = { label: string; value: number | string };
export type Dream = { id: string; title: string; date: string };

export type Profile = {
  id?: string;
  name: string;
  avatarIcon?: string | null;
  avatarImage?: string | null;
  dreams: Dream[];
  achievements: Achievement[];
  loading: boolean;
  error?: string;
  email?: string | null;
  created?: number | null;
  trialDaysLeft?: number | null;
  todayMood?: string | null;
};

export type AvatarOption = {
  id: string;
  icon: string;
  name: string;
  color: string;
};

// 🔥 Новый тип для тегов
export type InsightTag = 'all' | 'dream' | 'art';

// Пастельные цвета
const BLOCK_COLORS = [
  'rgba(83,134,136,0.78)',
  'rgba(118,174,186,0.78)',
  'rgba(160,198,206,0.78)',
  'rgba(228,228,228,0.78)',
  'rgba(229,213,223,0.78)',
  'rgba(105,127,163,0.78)',
  'rgba(154,188,221,0.78)',
  'rgba(151,194,193,0.78)',
  'rgba(202,216,210,0.78)',
  'rgba(201,193,183,0.78)',
];

// Иконки и имена
const ICON_DEFS: { icon: string; name: string }[] = [
  { icon: 'Pets', name: 'Плюшевая лапка' },
  { icon: 'Cloud', name: 'Пушистое облачко' },
  { icon: 'NightsStay', name: 'Сонная ночь' },
  { icon: 'Psychology', name: 'Мягкие мысли' },
  { icon: 'AutoAwesome', name: 'Волшебные блестки' },
  { icon: 'EmojiNature', name: 'Природа снов' },
  { icon: 'WaterDrop', name: 'Капелька сна' },
  { icon: 'LocalFlorist', name: 'Цветочные сны' },
  { icon: 'AcUnit', name: 'Хрустальная снежинка' },
  { icon: 'Bedtime', name: 'Уютная луна' },
  { icon: 'Palette', name: 'Палитра грез' },
  { icon: 'Circle', name: 'Мягкий кружок' },
];

// Генерация опций
export const AVATAR_OPTIONS: AvatarOption[] = ICON_DEFS.map((d, i) => ({
  id: String(i + 1),
  icon: d.icon,
  name: d.name,
  color: BLOCK_COLORS[i % BLOCK_COLORS.length],
}));

export const getIconComponent = (iconName?: string | null): React.ComponentType<any> => {
  const icons: { [key: string]: React.ComponentType<any> } = {
    Pets, Cloud, NightsStay, Psychology, AutoAwesome, EmojiNature, WaterDrop,
    LocalFlorist, AcUnit, Bedtime, Palette, Circle,
  };
  if (!iconName) return Circle;
  return icons[iconName] || Circle;
};

const VALID_ICON_NAMES = AVATAR_OPTIONS.map(o => o.icon);

const normalizeAvatarIcon = (value?: string | null): string | null => {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (VALID_ICON_NAMES.includes(v)) return v;
  const byId = AVATAR_OPTIONS.find(opt => opt.id === v);
  if (byId) return byId.icon;
  const byIcon = AVATAR_OPTIONS.find(opt => opt.icon === v);
  if (byIcon) return byIcon.icon;
  return null;
};

const initialProfile: Profile = {
  name: '',
  avatarIcon: null,
  avatarImage: null,
  dreams: [],
  achievements: [],
  loading: true,
  email: null,
  created: null,
  trialDaysLeft: null,
  todayMood: null,
};

const AVATARS_PER_PAGE = 3;

type ProfileContextType = {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  updateProfile: (data: Partial<Profile>) => void;
  avatarOptions: AvatarOption[];
  visibleAvatarOptions?: AvatarOption[];
  updateAvatar: (avatarIdOrIcon: string) => void;
  updateAvatarImage: (imageUrl: string | null) => void;
  getIconComponent: (iconName?: string | null) => React.ComponentType<any>;
  refreshProfile: () => Promise<void>;
  showNextAvatarPage?: () => void;
  showPrevAvatarPage?: () => void;
  openAvatarSelector: () => void;
  closeAvatarSelector: () => void;
  isAvatarSelectorOpen: boolean;
  openProfileEditor: () => void;
  closeProfileEditor: () => void;
  isProfileEditorOpen: boolean;

  // 🔥 Новое: теги и фильтрация
  selectedTag: InsightTag;
  setSelectedTag: (tag: InsightTag) => void;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [avatarPage, setAvatarPage] = useState(0);
  const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);

  // 🔥 Новое состояние
  const [selectedTag, setSelectedTag] = useState<InsightTag>('all');

  const fetchedOnMountRef = useRef(false);

  const visibleAvatarOptions = useMemo(() => {
    const start = avatarPage * AVATARS_PER_PAGE;
    return AVATAR_OPTIONS.slice(start, start + AVATARS_PER_PAGE);
  }, [avatarPage]);

  const updateProfile = (data: Partial<Profile>) => {
    const normalized: Partial<Profile> = { ...data };
    if ('avatarImage' in data) {
      normalized.avatarImage = data.avatarImage ? String(data.avatarImage).trim() || null : null;
    }
    if ('avatarIcon' in data) {
      normalized.avatarIcon = normalizeAvatarIcon(data.avatarIcon as any);
    }
    if ('todayMood' in data) {
      normalized.todayMood = data.todayMood ?? null;
    }
    setProfile((prev) => ({ ...prev, ...normalized }));
  };

  const updateAvatar = (avatarIdOrIcon: string) => {
    const byId = AVATAR_OPTIONS.find(opt => opt.id === avatarIdOrIcon);
    if (byId) {
      updateProfile({
        avatarIcon: byId.icon,
        avatarImage: null,
      });
      return;
    }
    const normalized = normalizeAvatarIcon(avatarIdOrIcon);
    if (normalized) {
      updateProfile({
        avatarIcon: normalized,
        avatarImage: null,
      });
    } else {
      console.warn('[Profile] updateAvatar: unknown value', avatarIdOrIcon);
    }
  };

  const updateAvatarImage = (imageUrl: string | null) => {
    updateProfile({ avatarImage: imageUrl ? String(imageUrl).trim() || null : null });
  };

  const refreshProfile = async () => {
    updateProfile({ loading: true, error: undefined });
    try {
      const data = await request<{
        email?: string;
        name?: string;
        avatar_icon?: string | null;
        avatarIcon?: string | null;
        avatar_image_url?: string | null;
        avatarImage?: string | null;
        created?: number | null;
        trialDaysLeft?: number | null;
        id?: string;
        todayMood?: string | null;
      }>('/me', {}, true);

      const rawAvatar = data.avatarIcon ?? data.avatar_icon ?? null;
      const avatarIcon = normalizeAvatarIcon(rawAvatar);
      const rawImage = data.avatarImage ?? data.avatar_image_url ?? null;
      const avatarImage = rawImage ? String(rawImage).trim() || null : null;

      let todayMood = (data as any)?.todayMood ?? (data as any)?.today_mood ?? null;
      if (todayMood === undefined) todayMood = null;

      if (todayMood === null) {
        try {
          const todayStr = getLocalDateStr();
          const res = await getMoodForDate(todayStr);
          todayMood = res ?? null;
        } catch (e) {
          console.warn('[ProfileContext] fallback getMoodForDate failed', e);
          todayMood = null;
        }
      }

      setProfile((prev) => ({
        ...prev,
        id: data.id ?? prev.id,
        name: data.name ?? prev.name,
        email: data.email ?? prev.email,
        created: typeof data.created === 'number' ? data.created : prev.created,
        trialDaysLeft: typeof data.trialDaysLeft === 'number' ? data.trialDaysLeft : prev.trialDaysLeft,
        avatarIcon,
        avatarImage,
        todayMood,
        loading: false,
      }));
    } catch (error: any) {
      console.error('Failed to fetch profile:', error);
      updateProfile({
        error: error?.message || 'Не удалось загрузить профиль',
        loading: false,
      });
    }
  };

  // 👇 НОВОЕ: обновление todayMood при фокусе окна
  useEffect(() => {
    const onFocus = async () => {
      if (!auth.token || auth.loading) return;
      try {
        const todayStr = getLocalDateStr();
        const mood = await getMoodForDate(todayStr);
        updateProfile?.({ todayMood: mood ?? null });
      } catch (e) {
        console.warn('[ProfileContext] onFocus getMoodForDate failed', e);
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [auth.token, auth.loading, updateProfile]);

  // локальные открыватели/закрыватели, чтобы можно было безопасно ссылаться в JSX
  const openAvatarSelector = () => setIsAvatarSelectorOpen(true);
  const closeAvatarSelector = () => setIsAvatarSelectorOpen(false);
  const openProfileEditor = () => setIsProfileEditorOpen(true);
  const closeProfileEditor = () => setIsProfileEditorOpen(false);

  useEffect(() => {
    if (!auth.token || auth.loading) return;
    if (fetchedOnMountRef.current) return;
    fetchedOnMountRef.current = true;
    refreshProfile().catch(e => console.debug('refreshProfile failed', e));
  }, [auth.token, auth.loading]);

  const value: ProfileContextType = {
    profile,
    setProfile,
    updateProfile,
    avatarOptions: AVATAR_OPTIONS,
    visibleAvatarOptions,
    updateAvatar,
    updateAvatarImage,
    getIconComponent,
    refreshProfile,
    showNextAvatarPage: () => setAvatarPage(p => Math.min(p + 1, Math.ceil(AVATAR_OPTIONS.length / AVATARS_PER_PAGE) - 1)),
    showPrevAvatarPage: () => setAvatarPage(p => Math.max(p - 1, 0)),
    openAvatarSelector,
    closeAvatarSelector,
    isAvatarSelectorOpen,
    openProfileEditor,
    closeProfileEditor,
    isProfileEditorOpen,

    // 🔥 Новое
    selectedTag,
    setSelectedTag,
  };

  // dialog style
  const dialogPaperSx = {
    background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 12px 60px rgba(24,32,80,0.28)',
    borderRadius: 3,
    color: '#fff',
    p: { xs: 2, sm: 3 },
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
      <AvatarSelector
        open={isAvatarSelectorOpen}
        onClose={closeAvatarSelector}
        avatarOptions={AVATAR_OPTIONS}
        profile={profile}
        getIconComponent={getIconComponent}
        updateAvatar={updateAvatar}
        updateAvatarImage={updateAvatarImage}
        dialogPaperSx={dialogPaperSx}
      />
      <Dialog
        open={isProfileEditorOpen}
        onClose={closeProfileEditor}
        maxWidth="xs"
        fullWidth
        scroll="body"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <ProfileEditForm />
      </Dialog>
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
};

// --- ProfileAvatar (styled) ---
export const ProfileAvatar: React.FC<{ size?: number }> = ({ size = 64 }) => {
  const { profile, avatarOptions, getIconComponent } = useProfile();
  const Icon = getIconComponent(profile.avatarIcon ?? null);
  const bgColor = avatarOptions.find(opt => opt.icon === profile.avatarIcon)?.color ?? '#f0f0f0';
  const avatarSrc = profile.avatarImage || undefined;

  return (
    <Avatar
      src={avatarSrc}
      sx={{
        width: size,
        height: size,
        bgcolor: avatarSrc ? undefined : bgColor,
        color: '#fff',
        boxShadow: '0 4px 24px rgba(88,120,255,0.10)',
        border: '2px solid rgba(255,255,255,0.18)',
      }}
      alt={profile.name || 'avatar'}
    >
      {!avatarSrc && <Icon sx={{ color: '#fff' }} />}
    </Avatar>
  );
};

// --- ProfileCard (glassmorphism) ---
export const ProfileCard: FC<{ children?: ReactNode; sx?: any }> = ({ children, sx }) => (
  <Paper
    elevation={0}
    sx={{
      borderRadius: 3,
      overflow: 'hidden',
      position: 'relative',
      p: { xs: 2, md: 3 },
      background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 12px 60px rgba(24,32,80,0.28)',
      color: '#fff',
      ...sx,
    }}
  >
    {children}
  </Paper>
);

// --- StatsTiles (glassmorphism tiles) ---
type StatsTilesProps = {
  stats?: Stat[];
  minTilePx?: number;
  tileGapPx?: number;
};

export const StatsTiles: FC<StatsTilesProps> = ({ stats, minTilePx = 140, tileGapPx = 16 }) => {
  const items = stats ?? [];

  return (
    <Box sx={{ width: '100%', boxSizing: 'border-box', py: 2 }}>
      <Box
        sx={{
          display: 'flex',
          gap: `${tileGapPx}px`,
          flexWrap: 'wrap',
          alignItems: 'stretch',
          justifyContent: { xs: 'center', sm: 'flex-start' },
        }}
      >
        {items.map((stat, index) => (
          <Box
            key={index}
            sx={{
              minWidth: minTilePx,
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: { xs: '100%', sm: 'calc(50% - 8px)' },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              p: 2,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(88,120,255,0.08))',
              boxShadow: '0 2px 12px rgba(88,120,255,0.08)',
              textAlign: 'center',
              color: '#fff',
              mb: { xs: 1.5, sm: 0 },
            }}
          >
            <Box sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#3a3a3a' }}>{stat.value}</Box>
            <Box sx={{ fontSize: '0.85rem', color: '#666' }}>{stat.label}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};