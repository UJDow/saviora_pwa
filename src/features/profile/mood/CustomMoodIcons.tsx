import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';
import type { SvgIconProps } from '@mui/material/SvgIcon';

// ==========================================
// ГЛАВНЫЕ КАТЕГОРИИ (GROUPS)
// ==========================================

// 1. ТЯЖЕСТЬ (Heaviness)
export const HeavinessIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path 
      d="M4.5,18 L19.5,18 C20.5,18 21,17 20.5,16 C19,13 18,6 12,6 C6,6 5,13 3.5,16 C3,17 3.5,18 4.5,18 Z" 
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    />
    <path d="M6,15 L8,13 M9,16 L11,12 M13,16 L15,12 M16,15 L17,14" stroke="currentColor" strokeWidth="1" />
  </SvgIcon>
);

// 2. ШТОРМ (Storm)
export const StormIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path 
      d="M4,12 C4,12 6,4 12,4 C16,4 19,7 19,10 C19,12 17,13 16,13 C14,13 13,11 14,9 C14.5,8 15.5,7.5 16.5,8" 
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    />
    <path 
      d="M5,15 C6,18 9,20 13,20 C18,20 21,16 21,12" 
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" 
    />
    <path d="M2,10 L5,12 L2,14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </SvgIcon>
);

// 3. ОГОНЬ (Fire)
export const FireIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path 
      d="M12,22 C16.5,22 19,18 19,14 C19,9 16,7 15,2 C14,6 12,8 12,8 C12,8 10,6 9,2 C8,7 5,9 5,14 C5,18 7.5,22 12,22 Z" 
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    />
    <path d="M12,18 C13.5,18 14,16 14,14 C14,12 13,11 12,10 C11,11 10,12 10,14 C10,16 10.5,18 12,18 Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </SvgIcon>
);

// 4. ЯСНОСТЬ (Clarity)
export const ClarityIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <line x1="2" y1="16" x2="22" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path 
      d="M6,16 C6,10 8,6 12,6 C16,6 18,10 18,16" 
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    />
    <line x1="12" y1="2" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5" />
    <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" stroke="currentColor" strokeWidth="1.5" />
    <line x1="19.1" y1="4.9" x2="17.7" y2="6.3" stroke="currentColor" strokeWidth="1.5" />
  </SvgIcon>
);

// 5. ПОЛЕТ (Flight)
export const FlightIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path 
      d="M2,12 C5,12 8,8 12,8 C16,8 19,5 22,2" 
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    />
    <path 
      d="M12,8 C13,11 14,13 18,14 C20,14.5 22,14 22,14" 
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    />
    <path 
      d="M12,8 C10,10 8,11 4,11" 
      fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"
    />
  </SvgIcon>
);

// ==========================================
// ПОДКАТЕГОРИИ (SUB-CATEGORIES) - ПЕРВАЯ ВОЛНА
// ==========================================

// 1.1 ГРУСТЬ (Sadness) - Увядший цветок
export const SadnessIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12,21 L12,14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12,14 C9,14 7,12 7,9 C7,6.5 9,4 12,4 C15,4 17,6.5 17,9 C17,11 16,13 14,14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M17,9 C19,9 20,10 20,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7,9 C5,9 4,10 4,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9,18 L7,20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/> 
  </SvgIcon>
);

// 2.1 ТРЕВОГА (Anxiety) - Спутанный клубок
export const AnxietyIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path 
      d="M4,12 C4,8 7,5 10,5 C12,5 13,6 14,7 C15,6 17,5 19,7 C21,9 20,13 18,15 C16,17 13,16 12,14 C11,12 14,10 16,11 C18,12 17,15 15,17 C13,19 9,19 7,17 C5,15 5,13 6,11" 
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    />
  </SvgIcon>
);

// 3.1 ЗЛОСТЬ (Anger) - Вулкан/Вспышка
export const AngerIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M4,22 L20,22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6,22 L10,12 L14,12 L18,22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M12,12 L12,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12,6 L10,8 M12,6 L14,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9,5 L8,3 M15,5 L16,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </SvgIcon>
);

// 4.1 СПОКОЙСТВИЕ (Calm) - Лотос/Вода
export const CalmIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M2,18 C6,18 8,16 12,16 C16,16 18,18 22,18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12,16 C12,12 8,10 6,12 C6,12 7,6 12,6 C17,6 18,12 18,12 C16,10 12,12 12,16 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </SvgIcon>
);

// 5.1 РАДОСТЬ (Joy) - Солнце/Птица
export const JoyIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12,2 L12,4 M12,20 L12,22 M2,12 L4,12 M20,12 L22,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M4.9,4.9 L6.3,6.3 M17.7,17.7 L19.1,19.1 M4.9,19.1 L6.3,17.7 M17.7,6.3 L19.1,4.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </SvgIcon>
);