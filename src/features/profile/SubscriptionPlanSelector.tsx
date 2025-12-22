// src/features/profile/SubscriptionPlanSelector.tsx
import React from 'react';
import type { Plan } from 'src/utils/api';
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Avatar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

type Props = {
  open: boolean;
  onClose: () => void;
  plans: Plan[];
  selectedPlanId: string | null;
  onSelectPlan: (plan: Plan) => void;
  dialogPaperSx?: object;
};

const SubscriptionPlanSelector: React.FC<Props> = ({
  open,
  onClose,
  plans,
  selectedPlanId,
  onSelectPlan,
  dialogPaperSx,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          mt: '80px',
          p: 3,
          borderRadius: 3,
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid rgba(255, 255, 255, 0.08)`,
          color: '#fff',
          ...dialogPaperSx,
        },
      }}
    >
      <Box>
        {/* Header: close button + centered title + right spacer */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton
            onClick={onClose}
            aria-label="Закрыть"
            sx={{
              color: 'rgba(255,255,255,0.9)',
              bgcolor: 'transparent',
              borderRadius: '50%',
              p: 1,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
            }}
            size="large"
          >
            <CloseIcon />
          </IconButton>

          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: '#fff', userSelect: 'none', lineHeight: 1.2 }}
            >
              Выберите план
            </Typography>
          </Box>

          {/* Invisible spacer same width as IconButton */}
          <Box sx={{ width: 48, height: 1 }} />
        </Box>

        <Swiper
          slidesPerView={3}
          spaceBetween={8}
          centeredSlides
          breakpoints={{
            0: { slidesPerView: 1.1 },
            480: { slidesPerView: 1.5 },
            768: { slidesPerView: 2.2 },
            1024: { slidesPerView: 3 },
          }}
          style={{ paddingBottom: 12 }}
        >
          {plans.map((plan) => {
            const planIdStr = String(plan.id ?? '');
            const isSelected = planIdStr === String(selectedPlanId ?? '');

            return (
              <SwiperSlide key={planIdStr} style={{ cursor: 'pointer' }}>
                <Box
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectPlan(plan);
                    }
                  }}
                  onClick={() => onSelectPlan(plan)}
                  title={plan.title ?? 'Тариф'}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: 12,
                    border: isSelected
                      ? '1px solid rgba(255,255,255,0.32)'
                      : '0.8px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    userSelect: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease, transform 160ms ease',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.4)',
                      transform: 'translateY(-3px)',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 72,
                      height: 72,
                      bgcolor: 'transparent',
                      color: '#fff',
                      fontSize: '3rem',
                      mb: 1,
                      userSelect: 'none',
                    }}
                  >
                    {plan.emoji ?? '★'}
                  </Avatar>

                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      textAlign: 'center',
                      color: '#fff',
                      userSelect: 'none',
                    }}
                  >
                    {plan.title}
                  </Typography>
                </Box>
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Compact italic explanation below plans, centered */}
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.5)',
            mt: 1,
            userSelect: 'none',
            fontWeight: 400,
            letterSpacing: 0.2,
            textAlign: 'center',
            px: 1,
            maxWidth: 320,
            mx: 'auto',
            fontStyle: 'italic',
          }}
        >
          Это поможет нам понять ваш интерес к приложению
        </Typography>
      </Box>
    </Dialog>
  );
};

export default SubscriptionPlanSelector;