// AvatarSelector.tsx
import React from 'react';
import { Dialog, Box, Avatar, IconButton, Typography } from '@mui/material';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import CloseIcon from '@mui/icons-material/Close';
import type { AvatarOption, Profile } from './ProfileContext';

type AvatarSelectorProps = {
  open: boolean;
  onClose: () => void;
  avatarOptions: AvatarOption[];
  profile: Profile;
  // Разрешаем null/undefined, чтобы совпадало с ProfileContext.getIconComponent
  getIconComponent: (iconName?: string | null) => React.ComponentType<any>;
  updateAvatar: (avatarId: string) => void;
  updateAvatarImage?: (imageUrl: string | null) => void; // опционально, не используется здесь
  dialogPaperSx?: object;
};

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  open,
  onClose,
  avatarOptions,
  profile,
  getIconComponent,
  updateAvatar,
  dialogPaperSx,
}) => {
  const handleSelect = (id: string) => {
    updateAvatar(id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
      <Box sx={{ position: 'relative', p: 2 }}>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: '#fff' }}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>

        <Typography variant="h6" align="center" mb={2} sx={{ color: '#fff' }}>
          Выбрать аватарку
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          {profile.avatarImage ? (
            <Avatar src={profile.avatarImage} sx={{ width: 96, height: 96 }} />
          ) : (
            (() => {
              const IconComp = getIconComponent(profile.avatarIcon ?? null);
              const currentAvatarOption = avatarOptions.find(opt => opt.icon === profile.avatarIcon);
              return (
                <Avatar sx={{ width: 96, height: 96, bgcolor: currentAvatarOption?.color ?? '#f0f0f0' }}>
                  <IconComp />
                </Avatar>
              );
            })()
          )}
        </Box>

        <Box sx={{ px: 1 }}>
          <Swiper slidesPerView={3} centeredSlides spaceBetween={12}>
            {avatarOptions.map(opt => {
              const IconComp = getIconComponent(opt.icon);
              return (
                <SwiperSlide key={opt.id}>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Box
                      onClick={() => handleSelect(opt.id)}
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        background: opt.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: 3,
                      }}
                      title={opt.name}
                    >
                      <IconComp sx={{ color: '#fff' }} />
                    </Box>
                  </Box>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </Box>
      </Box>
    </Dialog>
  );
};

export default AvatarSelector;