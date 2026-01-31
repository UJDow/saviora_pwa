import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Skeleton,
} from '@mui/material';

const glassBg = 'rgba(255, 255, 255, 0.06)';
const glassBorder = 'rgba(255, 255, 255, 0.10)';
const cardShadow = '0 8px 24px rgba(11,8,36,0.16)';

export const DreamCardSkeleton: React.FC = () => {
  return (
    <Card
      sx={{
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        borderRadius: 4,
        boxShadow: cardShadow,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={1.5} mb={2}>
          <Skeleton
            variant="circular"
            width={40}
            height={40}
            sx={{
              bgcolor: 'rgba(255,255,255,0.1)',
            }}
          />
          <Box flex={1}>
            <Skeleton
              variant="text"
              width="40%"
              height={20}
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
            />
            <Skeleton
              variant="text"
              width="25%"
              height={16}
              sx={{ bgcolor: 'rgba(255,255,255,0.08)' }}
            />
          </Box>
        </Box>

        {/* Title */}
        <Skeleton
          variant="text"
          width="70%"
          height={28}
          sx={{ bgcolor: 'rgba(255,255,255,0.12)', mb: 1.5 }}
        />

        {/* Summary */}
        <Skeleton
          variant="text"
          width="100%"
          height={20}
          sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 0.5 }}
        />
        <Skeleton
          variant="text"
          width="85%"
          height={20}
          sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 1.5 }}
        />

        {/* Text */}
        <Skeleton
          variant="rectangular"
          width="100%"
          height={80}
          sx={{
            bgcolor: 'rgba(255,255,255,0.08)',
            borderRadius: 2,
            mb: 1.5,
          }}
        />

        {/* Tags */}
        <Box display="flex" gap={0.75}>
          <Skeleton
            variant="rounded"
            width={70}
            height={22}
            sx={{ bgcolor: 'rgba(139,92,246,0.15)', borderRadius: 999 }}
          />
        </Box>
      </CardContent>

      <CardActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.5 }}>
        <Box display="flex" gap={2}>
          <Skeleton
            variant="circular"
            width={40}
            height={40}
            sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
          />
          <Skeleton
            variant="circular"
            width={40}
            height={40}
            sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
          />
        </Box>
      </CardActions>
    </Card>
  );
};
