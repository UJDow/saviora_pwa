// mood/MoodIcons.tsx
import React from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
// Иконки
import SearchIcon from '@mui/icons-material/Search';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import MoodBadIcon from '@mui/icons-material/MoodBad';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

export type MoodGroupId = 'seeking' | 'joy' | 'bond' | 'fear' | 'sadness' | 'anger';

export type MoodOption = {
  id: string;
  groupId: MoodGroupId;
  label: string;      // Короткое для слайдера / подписи под иконкой
  fullLabel: string;  // Пояснение (короткая фраза, НЕ повторяет название)
  color: string;
  icon: React.ComponentType<SvgIconProps>;
};

export const MOOD_GROUPS: { id: MoodGroupId; label: string; color: string }[] = [
  { id: 'seeking', label: 'Интерес', color: 'rgba(255,175,95,0.9)' },
  { id: 'joy',     label: 'Радость', color: 'rgba(255,215,110,0.9)' },
  { id: 'bond',    label: 'Тепло',   color: 'rgba(185,230,205,0.9)' },
  { id: 'fear',    label: 'Тревога', color: 'rgba(125,160,210,0.9)' },
  { id: 'sadness', label: 'Печаль',  color: 'rgba(135,160,215,0.9)' },
  { id: 'anger',   label: 'Злость',  color: 'rgba(215,90,100,0.9)' },
];

export const MOODS: MoodOption[] = [
  // INEREST / SEEKING (оранжевые оттенки)
  {
    id: 'seeking_interest',
    groupId: 'seeking',
    label: 'Любопытство',
    fullLabel: 'Желание узнать новое, исследовать мир',
    color: 'rgba(255,185,105,0.94)',
    icon: SearchIcon,
  },
  {
    id: 'seeking_azart',
    groupId: 'seeking',
    label: 'Азарт',
    fullLabel: 'Возбуждение и энергия перед важным событием или вызовом',
    color: 'rgba(255,155,80,0.94)',
    icon: WhatshotIcon,
  },

  // JOY / RADOST (жёлтые)
  {
    id: 'play_serenity',
    groupId: 'joy',
    label: 'Покой',
    fullLabel: 'Умиротворение и внутренний баланс',
    color: 'rgba(255,235,160,0.94)',
    icon: WbSunnyIcon,
  },
  {
    id: 'play_happiness',
    groupId: 'joy',
    label: 'Счастье',
    fullLabel: 'Чувство удовлетворения и радости жизни',
    color: 'rgba(255,215,110,0.94)',
    icon: SentimentVerySatisfiedIcon,
  },
  {
    id: 'play_ecstasy',
    groupId: 'joy',
    label: 'Восторг',
    fullLabel: 'Сильный эмоциональный подъём и экстаз',
    color: 'rgba(255,200,80,0.94)',
    icon: EmojiEmotionsIcon,
  },

  // BOND / WARMTH (зелёные — позитивные)
  {
    id: 'care_acceptance',
    groupId: 'bond',
    label: 'Принятие',
    fullLabel: 'Ощущение безопасности и поддержки',
    color: 'rgba(200,235,200,0.90)',
    icon: FavoriteBorderIcon,
  },
  {
    id: 'care_trust',
    groupId: 'bond',
    label: 'Доверие',
    fullLabel: 'Уверенность и спокойствие рядом с близкими людьми',
    color: 'rgba(185,230,205,0.92)',
    icon: FavoriteIcon,
  },

  // FEAR / ANXIETY (индиго / серо-синие)
  {
    id: 'fear_apprehension',
    groupId: 'fear',
    label: 'Опасение',
    fullLabel: 'Лёгкое беспокойство и настороженность',
    color: 'rgba(145,175,215,0.90)',
    icon: MoodBadIcon,
  },
  {
    id: 'fear_fear',
    groupId: 'fear',
    label: 'Страх',
    fullLabel: 'Чувство угрозы и неуверенности',
    color: 'rgba(120,155,205,0.90)',
    icon: SentimentDissatisfiedIcon,
  },
  {
    id: 'fear_panic',
    groupId: 'fear',
    label: 'Паника',
    fullLabel: 'Острый стресс и потеря контроля',
    color: 'rgba(100,130,190,0.86)',
    icon: NightlightRoundIcon,
  },

  // SADNESS / MELANCHOLY (синие)
  {
    id: 'sadness_ pensiveness',
    groupId: 'sadness',
    label: 'Грусть',
    fullLabel: 'Лёгкая меланхолия и задумчивость',
    color: 'rgba(145,165,205,0.88)',
    icon: SentimentNeutralIcon,
  },
  {
    id: 'sadness_grief',
    groupId: 'sadness',
    label: 'Тоска',
    fullLabel: 'Глубокое чувство утраты и сожаления',
    color: 'rgba(115,140,200,0.90)',
    icon: SentimentDissatisfiedIcon,
  },

  // ANGER (красные)
  {
    id: 'anger_annoyance',
    groupId: 'anger',
    label: 'Досада',
    fullLabel: 'Раздражение и недовольство мелочами',
    color: 'rgba(235,120,120,0.88)',
    icon: SentimentDissatisfiedIcon,
  },
  {
    id: 'anger_rage',
    groupId: 'anger',
    label: 'Ярость',
    fullLabel: 'Интенсивный и почти неконтролируемый гнев',
    color: 'rgba(195,70,90,0.86)',
    icon: WhatshotIcon,
  },
];

export default MOODS;