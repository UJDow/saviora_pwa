// MoodIcons.tsx
import React from 'react';
import SearchIcon from '@mui/icons-material/Search';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import MoodBadIcon from '@mui/icons-material/MoodBad';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FlashOnIcon from '@mui/icons-material/FlashOn';

export type MoodOption = {
  id: string;
  label: string;
  color: string; // rgba — пастельный стиль
  icon: React.ElementType;
};

/*
  Расширённый набор эмоций, разложенный по логике Панксеппа.
  Порядок — ориентировочно по кругу (чтобы в слайдере смежные иконки были семантически близки).
*/
export const MOODS: MoodOption[] = [
  // SEEKING (поиск / interest / anticipation)
  { id: 'seeking_interest',       label: 'Интерес / Поиск',           color: 'rgba(255,185,105,0.94)', icon: SearchIcon },
  { id: 'seeking_optimism',       label: 'Оптимизм',                  color: 'rgba(255,170,90,0.92)',  icon: WhatshotIcon },
  { id: 'seeking_vigilance',      label: 'Внимание / Бдительность',  color: 'rgba(245,160,90,0.90)',  icon: VisibilityIcon },

  // PLAY / Joy (игра / радость)
  { id: 'play_serenity',          label: 'Безмятежность',            color: 'rgba(255,235,160,0.94)', icon: WbSunnyIcon },
  { id: 'play_joy',               label: 'Радость',                  color: 'rgba(255,215,110,0.94)', icon: SentimentVerySatisfiedIcon },
  { id: 'play_ecstasy',           label: 'Экстаз / Восторг',         color: 'rgba(255,200,80,0.94)',  icon: EmojiEmotionsIcon },

  // CARE (забота / доверие)
  { id: 'care_admiration',        label: 'Восхищение / Доверие',     color: 'rgba(185,230,205,0.92)', icon: FavoriteIcon },
  { id: 'care_acceptance',        label: 'Принятие',                 color: 'rgba(200,235,200,0.90)', icon: FavoriteBorderIcon },

  // FEAR (страх / тревога)
  { id: 'fear_apprehension',      label: 'Тревога / Опасение',       color: 'rgba(150,215,190,0.90)', icon: MoodBadIcon },
  { id: 'fear_fear',              label: 'Страх',                    color: 'rgba(130,200,170,0.88)', icon: SentimentDissatisfiedIcon },
  { id: 'fear_terror',            label: 'Ужас',                     color: 'rgba(105,180,155,0.86)', icon: NightlightRoundIcon },

  // PANIC / GRIEF (паника, печаль, горе)
  { id: 'panic_grief_surprise',   label: 'Удивление/Отвращение',     color: 'rgba(160,185,230,0.90)', icon: FlashOnIcon },
  { id: 'panic_grief_grief',      label: 'Горе / Печаль',            color: 'rgba(135,160,215,0.90)', icon: SentimentDissatisfiedIcon },
  { id: 'panic_grief_pensiveness',label: 'Задумчивость',            color: 'rgba(145,165,205,0.88)', icon: SentimentNeutralIcon },

  // DISGUST / related
  { id: 'disgust_contempt',       label: 'Презрение',                color: 'rgba(175,140,185,0.86)', icon: SentimentVeryDissatisfiedIcon },
  { id: 'disgust_disgust',        label: 'Отвращение',               color: 'rgba(155,125,180,0.86)', icon: SentimentDissatisfiedIcon },

  // RAGE / ANGER
  { id: 'rage_annoyance',         label: 'Раздражение',              color: 'rgba(235,120,120,0.88)', icon: SentimentDissatisfiedIcon },
  { id: 'rage_anger',             label: 'Злость',                   color: 'rgba(215,90,100,0.88)',  icon: SentimentVeryDissatisfiedIcon },
  { id: 'rage_rage',              label: 'Ярость',                   color: 'rgba(195,70,90,0.86)',   icon: WhatshotIcon },

  // LUST / related
  { id: 'lust_attraction',        label: 'Влечение / Притяжение',    color: 'rgba(235,165,200,0.90)', icon: FavoriteIcon },
  { id: 'lust_lust',              label: 'Похоть',                   color: 'rgba(240,145,190,0.90)', icon: FavoriteBorderIcon },

  // ADDITIONAL PLAY / positive social
  { id: 'play_amazement',         label: 'Удивление / Восторг',      color: 'rgba(250,220,150,0.92)', icon: SportsEsportsIcon },
  { id: 'seeking_anticipation',   label: 'Ожидание / Предвкушение',  color: 'rgba(255,175,95,0.92)',  icon: WhatshotIcon },
];

export default MOODS;