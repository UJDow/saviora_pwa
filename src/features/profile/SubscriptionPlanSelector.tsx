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
  const glassBorder = 'rgba(255,255,255,0.06)';
  const accentColor = 'rgba(88,120,255,0.95)';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          mt: '80px',
          p: 2,
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(88,120,255,0.10), rgba(138,92,255,0.06))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${glassBorder}`,
          color: '#fff',
          boxShadow: '0 8px 28px rgba(12,20,40,0.18)',
          ...dialogPaperSx,
        },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={onClose}
          aria-label="close"
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'rgba(255,255,255,0.9)',
            bgcolor: 'transparent',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
          }}
        >
          <CloseIcon />
        </IconButton>

        <Typography
          variant="h6"
          align="center"
          mb={2}
          sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}
        >
          Выберите тарифный план
        </Typography>

        <Swiper
          slidesPerView={3}
          spaceBetween={16}
          centeredSlides
          breakpoints={{
            0: { slidesPerView: 1.2 },
            480: { slidesPerView: 1.6 },
            768: { slidesPerView: 2.4 },
            1024: { slidesPerView: 3 },
          }}
          style={{ paddingBottom: 24 }}
        >
          {plans.map((plan) => {
            const isSelected = String(plan.id) === String(selectedPlanId);
            return (
              <SwiperSlide key={plan.id} style={{ cursor: 'pointer' }}>
                <Box
                  onClick={() => onSelectPlan(plan)}
                  title={`${plan.title} — ${plan.price}`}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 1.5,
                    borderRadius: 3,
                    minWidth: 140,
                    border: isSelected ? `2px solid ${accentColor}` : `1px solid transparent`,
                    backgroundColor: isSelected ? 'rgba(88,120,255,0.15)' : 'rgba(255,255,255,0.9)',
                    color: '#222',
                    userSelect: 'none',
                    transition: 'all 0.3s ease',
                    boxShadow: isSelected ? '0 0 12px rgba(88,120,255,0.5)' : 'none',
                    '&:hover': {
                      boxShadow: '0 0 10px rgba(88,120,255,0.3)',
                      backgroundColor: 'rgba(88,120,255,0.1)',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 64,
                      height: 64,
                      bgcolor: isSelected ? accentColor : 'rgba(200,200,200,0.3)',
                      color: isSelected ? '#fff' : '#555',
                      fontSize: '2rem',
                      mb: 1,
                    }}
                  >
                    {plan.emoji}
                  </Avatar>

                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, textAlign: 'center', mb: 0.5, color: '#222' }}
                  >
                    {plan.title}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{ color: '#555', textAlign: 'center', fontWeight: 600 }}
                  >
                    {plan.price}
                  </Typography>
                </Box>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </Box>
    </Dialog>
  );
};

export default SubscriptionPlanSelector;