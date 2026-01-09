import React from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';

// --- ИКОНКИ ГЛАВНЫХ КАТЕГОРИЙ (MUI) ---
import CloudIcon from '@mui/icons-material/Cloud';       // Тяжесть
import TsunamiIcon from '@mui/icons-material/Tsunami';   // Шторм
import WhatshotIcon from '@mui/icons-material/Whatshot'; // Огонь
import SpaIcon from '@mui/icons-material/Spa';           // Ясность
import HistoryEduIcon from '@mui/icons-material/HistoryEdu'; // Полет (Перо)

// --- ИКОНКИ ПОДКАТЕГОРИЙ (SVG/Custom) ---
import { 
  SadnessIcon, AnxietyIcon, AngerIcon, CalmIcon, JoyIcon
} from './CustomMoodIcons';

// --- ИКОНКИ ПОДКАТЕГОРИЙ (MUI Заглушки) ---
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HeartBrokenIcon from '@mui/icons-material/HeartBroken';
import ParkIcon from '@mui/icons-material/Park';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import SportsGymnasticsIcon from '@mui/icons-material/SportsGymnastics';
import ExploreOffIcon from '@mui/icons-material/ExploreOff';
import BugReportIcon from '@mui/icons-material/BugReport';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PestControlRodentIcon from '@mui/icons-material/PestControlRodent';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AnchorIcon from '@mui/icons-material/Anchor';
import HandshakeIcon from '@mui/icons-material/Handshake';
import StarIcon from '@mui/icons-material/Star';
import WeekendIcon from '@mui/icons-material/Weekend';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import KeyIcon from '@mui/icons-material/Key';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

export type MoodGroupId = 'heaviness' | 'storm' | 'fire' | 'clarity' | 'flight';

export type MoodGroup = {
  id: MoodGroupId;
  label: string;
  color: string;
  icon: React.ComponentType<SvgIconProps>;
};

export type MoodOption = {
  id: string;
  groupId: MoodGroupId;
  label: string;      
  fullLabel: string;  
  color: string;
  icon: React.ComponentType<SvgIconProps>;
};

// ГРУППЫ (Главный экран)
export const MOOD_GROUPS: MoodGroup[] = [
  { 
    id: 'heaviness', 
    label: 'Тяжесть', 
    color: '#37474F', // Насыщенный темный серо-синий
    icon: CloudIcon 
  },
  { 
    id: 'storm',     
    label: 'Шторм',   
    color: '#5C6BC0', // Индиго (Indigo 400) - Сине-фиолетовый, четко отличается от серого
    icon: TsunamiIcon 
  },
  { 
    id: 'fire',      
    label: 'Огонь',   
    color: '#FF8A65', // Пастельный Коралловый
    icon: WhatshotIcon 
  },
  { 
    id: 'clarity',   
    label: 'Ясность', 
    color: '#4DB6AC', // Пастельная Бирюза
    icon: SpaIcon 
  },
  { 
    id: 'flight',    
    label: 'Полет',   
    color: '#FFD54F', // Пастельный Золотой
    icon: HistoryEduIcon 
  },
];

export const MOODS: MoodOption[] = [
  // --- 1. HEAVINESS (#37474F) ---
  {
    id: 'heaviness_sadness',
    groupId: 'heaviness',
    label: 'Грусть',
    fullLabel: 'Хочется плакать или побыть в тишине',
    color: '#37474F',
    icon: SadnessIcon,
  },
  {
    id: 'heaviness_fatigue',
    groupId: 'heaviness',
    label: 'Усталость',
    fullLabel: 'Нет сил, батарейка на нуле',
    color: '#37474F',
    icon: HourglassEmptyIcon,
  },
  {
    id: 'heaviness_emptiness',
    groupId: 'heaviness',
    label: 'Пустота',
    fullLabel: 'Ничего не чувствую, дыра внутри',
    color: '#37474F',
    icon: HeartBrokenIcon,
  },
  {
    id: 'heaviness_loneliness',
    groupId: 'heaviness',
    label: 'Одиночество',
    fullLabel: 'Меня никто не понимает',
    color: '#37474F',
    icon: ParkIcon,
  },
  {
    id: 'heaviness_powerless',
    groupId: 'heaviness',
    label: 'Бессилие',
    fullLabel: 'Не могу ни на что повлиять',
    color: '#37474F',
    icon: ContentCutIcon,
  },

  // --- 2. STORM (#5C6BC0) ---
  {
    id: 'storm_anxiety',
    groupId: 'storm',
    label: 'Тревога',
    fullLabel: 'Фоновое беспокойство, ожидание беды',
    color: '#5C6BC0',
    icon: AnxietyIcon,
  },
  {
    id: 'storm_fear',
    groupId: 'storm',
    label: 'Страх',
    fullLabel: 'Боюсь чего-то конкретного',
    color: '#5C6BC0',
    icon: VisibilityIcon,
  },
  {
    id: 'storm_panic',
    groupId: 'storm',
    label: 'Паника',
    fullLabel: 'Теряю контроль, хаос мыслей',
    color: '#5C6BC0',
    icon: BlurOnIcon,
  },
  {
    id: 'storm_stress',
    groupId: 'storm',
    label: 'Стресс',
    fullLabel: 'Давление обстоятельств, перегруз',
    color: '#5C6BC0',
    icon: SportsGymnasticsIcon,
  },
  {
    id: 'storm_confusion',
    groupId: 'storm',
    label: 'Растерянность',
    fullLabel: 'Не знаю, куда идти и что делать',
    color: '#5C6BC0',
    icon: ExploreOffIcon,
  },

  // --- 3. FIRE (#FF8A65) ---
  {
    id: 'fire_anger',
    groupId: 'fire',
    label: 'Злость',
    fullLabel: 'Хочется разрушать или кричать',
    color: '#FF8A65',
    icon: AngerIcon,
  },
  {
    id: 'fire_irritation',
    groupId: 'fire',
    label: 'Раздражение',
    fullLabel: 'Все бесит, колючее состояние',
    color: '#FF8A65',
    icon: BugReportIcon,
  },
  {
    id: 'fire_resentment',
    groupId: 'fire',
    label: 'Обида',
    fullLabel: 'Горькое чувство несправедливости',
    color: '#FF8A65',
    icon: ReportProblemIcon,
  },
  {
    id: 'fire_jealousy',
    groupId: 'fire',
    label: 'Ревность',
    fullLabel: 'Сравнение себя с другими не в свою пользу',
    color: '#FF8A65',
    icon: PestControlRodentIcon,
  },
  {
    id: 'fire_passion',
    groupId: 'fire',
    label: 'Страсть',
    fullLabel: 'Горение идеей или человеком, азарт',
    color: '#FF8A65',
    icon: FavoriteIcon,
  },

  // --- 4. CLARITY (#4DB6AC) ---
  {
    id: 'clarity_calm',
    groupId: 'clarity',
    label: 'Спокойствие',
    fullLabel: 'Внутренняя тишина и баланс',
    color: '#4DB6AC',
    icon: CalmIcon,
  },
  {
    id: 'clarity_confidence',
    groupId: 'clarity',
    label: 'Уверенность',
    fullLabel: 'Твердая почва под ногами',
    color: '#4DB6AC',
    icon: AnchorIcon,
  },
  {
    id: 'clarity_gratitude',
    groupId: 'clarity',
    label: 'Благодарность',
    fullLabel: 'Теплое чувство к миру или людям',
    color: '#4DB6AC',
    icon: HandshakeIcon,
  },
  {
    id: 'clarity_hope',
    groupId: 'clarity',
    label: 'Надежда',
    fullLabel: 'Свет в конце туннеля',
    color: '#4DB6AC',
    icon: StarIcon,
  },
  {
    id: 'clarity_relax',
    groupId: 'clarity',
    label: 'Расслабленность',
    fullLabel: 'Тело и ум отдыхают',
    color: '#4DB6AC',
    icon: WeekendIcon,
  },

  // --- 5. FLIGHT (#FFD54F) ---
  {
    id: 'flight_joy',
    groupId: 'flight',
    label: 'Радость',
    fullLabel: 'Легкость и улыбка',
    color: '#FFD54F',
    icon: JoyIcon,
  },
  {
    id: 'flight_inspiration',
    groupId: 'flight',
    label: 'Вдохновение',
    fullLabel: 'Поток идей, желание творить',
    color: '#FFD54F',
    icon: LightbulbIcon,
  },
  {
    id: 'flight_love',
    groupId: 'flight',
    label: 'Любовь',
    fullLabel: 'Сердце открыто',
    color: '#FFD54F',
    icon: VolunteerActivismIcon,
  },
  {
    id: 'flight_curiosity',
    groupId: 'flight',
    label: 'Любопытство',
    fullLabel: 'Интерес к новому, исследователь',
    color: '#FFD54F',
    icon: KeyIcon,
  },
  {
    id: 'flight_pride',
    groupId: 'flight',
    label: 'Гордость',
    fullLabel: 'Довольство собой и своими успехами',
    color: '#FFD54F',
    icon: EmojiEventsIcon,
  },
];

export default MOODS;