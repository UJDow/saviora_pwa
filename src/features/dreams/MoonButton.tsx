import React, { useEffect, useRef, useState, useMemo } from 'react';
import { IconButton, Popover, MenuItem, Box, Snackbar, Tooltip } from '@mui/material';

interface MoonButtonProps {
  illumination: number; // 0..1 (0 — новолуние, 1 — полная ЖЁЛТАЯ луна)
  onInterpret: () => void;
  onFinalInterpret: () => void;
  disabled?: boolean;
  // Для Северного полушария:
  // 'waxing' — растущая (буква "Р"): рожки налево, свет прибавляется справа налево.
  // 'waning' — убывающая (буква "С"): рожки направо, свет уходит слева направо.
  direction?: 'waxing' | 'waning';
  size?: number; // размер иконки (по умолчанию 32)
}

interface MoonPhaseIconProps {
  illumination: number; // 0..1
  size?: number;
  direction?: 'waxing' | 'waning';
}

/**
 * Луна по твоей логике:
 * - Серый базовый диск.
 * - Жёлтая освещённая часть — полупрозрачная, мягкий градиент.
 * - При росте illumination жёлтая площадь РАСТЁТ.
 * - illumination=1 => вся луна ЖЁЛТАЯ.
 * - Северное полушарие:
 *   waxing ("Р") — свет добавляется справа налево,
 *   waning ("С") — свет уходит слева направо.
 */
const MoonPhaseIcon: React.FC<MoonPhaseIconProps> = ({
  illumination,
  size = 32,
  direction = 'waxing',
}) => {
  const s = size;
  const r = s * 0.47;
  const cx = s / 2;
  const cy = s / 2;

  const illum = Math.min(1, Math.max(0, illumination));
  const softIllum = 0.02 + illum * 0.96;

  // Для Северного полушария:
  // waxing: жёлтая растёт справа налево => вычитывающий (тёмный) круг стартует справа и сходит на нет
  // waning: наоборот, стартует слева
  const side = direction === 'waxing' ? 1 : -1;

  // Чем меньше освещённость, тем дальше "тень" от центра.
  const dx = (1 - softIllum) * r * 1.6;
  const darkCx = cx + side * dx;

  const ids = useMemo(() => {
    const base = Math.random().toString(36).slice(2);
    return {
      maskYellow: `moon-yellow-mask-${base}`,
      gradYellow: `moon-yellow-grad-${base}`,
      shadow: `moon-shadow-${base}`,
      limb: `moon-limb-${base}`,
      grain: `moon-grain-${base}`,
      craterMask: `moon-crater-mask-${base}`,
    };
  }, []);

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} role="img" aria-label="moon">
      <defs>
        {/* Мягкий жёлтый (не слепит) */}
        <radialGradient id={ids.gradYellow} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#ffeaa7" stopOpacity="0.75" />
          <stop offset="60%" stopColor="#ffdf70" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#ffd24d" stopOpacity="0.55" />
        </radialGradient>

        <filter id={ids.shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.0" floodColor="#000000" floodOpacity="0.28" />
        </filter>

        <radialGradient id={ids.limb} cx="50%" cy="50%" r="50%">
          <stop offset="75%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.20)" />
        </radialGradient>

        <filter id={ids.grain} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed="21" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0 0.05 0" />
          </feComponentTransfer>
          <feBlend mode="overlay" in2="SourceGraphic" />
        </filter>

        {/* Маска жёлтой освещённой части:
           - Белым открываем весь диск (жёлтый).
           - Чёрным смещённым кругом вычитаем ТЕМНОТУ (с нужной стороны).
           - При росте illumination чёрный круг сдвигается к центру и исчезает —
             => жёлтая площадь увеличивается. */}
        <mask id={ids.maskYellow}>
          <rect x="0" y="0" width={s} height={s} fill="black" />
          <circle cx={cx} cy={cy} r={r} fill="white" />
          <circle cx={darkCx} cy={cy} r={r} fill="black" />
        </mask>

        {/* Кратеры: слегка заметны, на свету чуть сильнее (но не ярче жёлтого) */}
        <mask id={ids.craterMask}>
          <rect x="0" y="0" width={s} height={s} fill="black" />
          <circle cx={cx} cy={cy} r={r} fill="white" opacity="0.18" />
          <g mask={`url(#${ids.maskYellow})`}>
            <circle cx={cx} cy={cy} r={r} fill="white" opacity="0.36" />
          </g>
        </mask>
      </defs>

      {/* Серый базовый диск */}
      <circle cx={cx} cy={cy} r={r} fill="#b9bdc6" filter={`url(#${ids.shadow})`} />
      {/* Виньетка по краю */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${ids.limb})`} />

      {/* Жёлтая освещённая часть (полупрозрачная) */}
      <g mask={`url(#${ids.maskYellow})`}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${ids.gradYellow})`} />
      </g>

      {/* Кратеры и легкая текстура */}
      <g mask={`url(#${ids.craterMask})`} filter={`url(#${ids.grain})`} opacity={0.9}>
        <circle cx={cx - r * 0.30} cy={cy - r * 0.22} r={r * 0.13} fill="#9fa4ad" />
        <circle cx={cx + r * 0.18} cy={cy + r * 0.06} r={r * 0.09} fill="#9ca1a9" />
        <circle cx={cx - r * 0.08} cy={cy + r * 0.27} r={r * 0.065} fill="#979da6" />
        <circle cx={cx + r * 0.30} cy={cy - r * 0.18} r={r * 0.055} fill="#9ea3ab" />
        <circle cx={cx - r * 0.24} cy={cy + r * 0.06} r={r * 0.045} fill="#9ea3ac" />
        <circle cx={cx + r * 0.05} cy={cy - r * 0.15} r={r * 0.035} fill="#9fa4ad" />
        <circle cx={cx - r * 0.15} cy={cy + r * 0.02} r={r * 0.028} fill="#9fa4ad" />
      </g>

      {/* Контур */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#8c9099" strokeWidth={Math.max(1, s * 0.04)} />
    </svg>
  );
};

export const MoonButton: React.FC<MoonButtonProps> = ({
  illumination,
  onInterpret,
  onFinalInterpret,
  disabled,
  direction = 'waxing', // Северное полушарие: растущая — "Р"
  size = 32,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showHint, setShowHint] = useState(false);
  const hintShownRef = useRef(false);

  // Плавная анимация освещённости
  const prevIllumRef = useRef(illumination);
  const [animatedIllumination, setAnimatedIllumination] = useState(illumination);

  useEffect(() => {
    const from = prevIllumRef.current;
    const to = Math.min(1, Math.max(0, illumination));
    if (Math.abs(from - to) < 0.001) {
      setAnimatedIllumination(to);
      prevIllumRef.current = to;
      return;
    }

    const duration = 220; // ms
    const start = performance.now();
    const animate = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // easeInOutCubic
      const val = from + (to - from) * ease;
      setAnimatedIllumination(val);
      if (p < 1) requestAnimationFrame(animate);
      else prevIllumRef.current = to;
    };
    const raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [illumination]);

  // Автовыплывающий хинт на 3 секунды (не вечно!)
  useEffect(() => {
    if (animatedIllumination >= 0.999 && !hintShownRef.current) {
      setShowHint(true);
      hintShownRef.current = true;
      const timer = setTimeout(() => setShowHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [animatedIllumination]);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const isFull = animatedIllumination >= 0.999;

  return (
    <>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Tooltip title={isFull ? 'Луна полная — доступно толкование' : 'Заполните 7 пар для толкования'}>
          <span>
            <IconButton
              onClick={handleClick}
              sx={{
                ml: 1,
                background: 'rgba(255,255,255,0.12)',
                boxShadow: isFull ? '0 0 16px 6px #ffe066' : 'none',
                transition: 'box-shadow 0.3s',
                pointerEvents: disabled ? 'none' : 'auto',
              }}
              disabled={disabled}
              aria-label="Лунная кнопка"
            >
              <MoonPhaseIcon
                illumination={animatedIllumination}
                direction={direction}
                size={size}
              />
            </IconButton>
          </span>
        </Tooltip>

        <Snackbar
        open={showHint}
        message="Вы можете получить толкование"
        autoHideDuration={3000}
        onClose={() => setShowHint(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 2000 }}
        />
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box>
          <MenuItem
            onClick={() => { handleClose(); onInterpret(); }}
            disabled={!isFull}
          >
            Толкование блока
          </MenuItem>
          <MenuItem
            onClick={() => { handleClose(); onFinalInterpret(); }}
            disabled={!isFull}
          >
            Итоговое толкование
          </MenuItem>
        </Box>
      </Popover>
    </>
  );
};