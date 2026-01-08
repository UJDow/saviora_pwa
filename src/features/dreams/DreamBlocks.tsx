// DreamBlocks.tsx
import React, { useMemo, useCallback, useState } from 'react';
import { Box, Paper, Typography, IconButton, Snackbar, Alert } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import type { WordBlock } from './DreamTextSelector';

const glassBorder = 'rgba(255,255,255,0.06)';

interface DreamBlocksProps {
  text: string;
  blocks: WordBlock[];
  onBlocksChange: (blocks: WordBlock[]) => void;

  onBack: () => void;
  hideInternalBackButton?: boolean;

  activeBlockId?: string | null;
  onActiveBlockChange?: (blockId: string | null) => void;

  hideHeader?: boolean;
}

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

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
  'rgba(201, 193, 183, 0.78)',
];

export const DreamBlocks: React.FC<DreamBlocksProps> = ({
  text,
  blocks,
  onBlocksChange,
  onBack,
  hideInternalBackButton = false,
  activeBlockId,
  onActiveBlockChange,
  hideHeader = false,
}) => {
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Слова — разделяем, но сохраняем порядок. Фильтруем лишние пустые.
  const words = useMemo(() => (text ? text.split(/\s+/).filter(Boolean) : []), [text]);

  // Отсортированные блоки
  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => (a.start ?? 0) - (b.start ?? 0)), [blocks]);

  // Цвет для блока по его порядку
  const blockColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sortedBlocks.forEach((b, idx) => map.set(b.id, BLOCK_COLORS[idx % BLOCK_COLORS.length]));
    return map;
  }, [sortedBlocks]);

  // Подготовка сегментов: либо слово (index), либо целый блок (block)
  type Segment = { type: 'word'; index: number } | { type: 'block'; block: WordBlock };
  const segments: Segment[] = useMemo(() => {
    const byStart = new Map<number, WordBlock>();
    sortedBlocks.forEach((b) => {
      if (typeof b.start === 'number') byStart.set(b.start, b);
    });

    const res: Segment[] = [];
    let i = 0;
    while (i < words.length) {
      const b = byStart.get(i);
      if (b) {
        res.push({ type: 'block', block: b });
        i = (b.end ?? b.start ?? i) + 1;
      } else {
        res.push({ type: 'word', index: i });
        i += 1;
      }
    }
    return res;
  }, [sortedBlocks, words]);

  // Новые стили для слов внутри блоков (по индексам start/end — как у тебя было)
  const wordStyles = useMemo(() => {
    const styles: Record<number, { backgroundColor: string }> = {};
    sortedBlocks.forEach((block) => {
      const color = blockColorMap.get(block.id) || 'transparent';
      if (typeof block.start === 'number' && typeof block.end === 'number') {
        styles[block.start] = { backgroundColor: color };
        styles[block.end] = { backgroundColor: color };
      }
    });
    return styles;
  }, [sortedBlocks, blockColorMap]);

  const getBlockForWord = useCallback(
    (idx: number) =>
      blocks.find(
        (b) =>
          typeof b.start === 'number' &&
          typeof b.end === 'number' &&
          idx >= b.start &&
          idx <= b.end,
      ),
    [blocks],
  );

  const handleWordClick = (index: number) => {
    const found = getBlockForWord(index);
    if (found) {
      onActiveBlockChange?.(found.id);
      setSelectionStart(null);
      return;
    }

    if (selectionStart === null) {
      setSelectionStart(index);
      return;
    }

    const start = Math.min(selectionStart, index);
    const end = Math.max(selectionStart, index);

    // проверка пересечения
    const intersects = blocks.some((b) => {
      const s = b.start ?? Number.MAX_SAFE_INTEGER;
      const e = b.end ?? Number.MIN_SAFE_INTEGER;
      return start <= e && end >= s;
    });

    if (intersects) {
      setSnackbar({ open: true, message: 'Новый блок пересекается с существующим', severity: 'error' });
      setSelectionStart(null);
      return;
    }

    const textSlice = words.slice(start, end + 1).join(' ');
    const newBlock: WordBlock = {
      id:
        typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      start,
      end,
      text: textSlice,
    };

    const updated = [...blocks, newBlock].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
    onBlocksChange(updated);
    onActiveBlockChange?.(newBlock.id);
    setSelectionStart(null);
  };

  // Визуал: компактный inline-рендеринг.
  const renderSegments = () =>
    segments.map((seg, idx) => {
      if (seg.type === 'block') {
        const b = seg.block;
        const color = blockColorMap.get(b.id) ?? 'rgba(255,255,255,0.12)';
        const active = b.id === activeBlockId;

        return (
          <Box
            component="span"
            key={`block-${b.id}-${idx}`}
            onClick={() => onActiveBlockChange?.(b.id)}
            sx={{
              display: 'inline-block',
              padding: '3px 8px',
              marginRight: '6px',
              marginBottom: '4px',
              borderRadius: '14px',
              backgroundColor: active ? color.replace(/0\.(\d+)/, '0.92') : color,
              color: '#fff',
              fontSize: '0.95rem',
              lineHeight: 1.1,
              cursor: 'pointer',
              userSelect: 'none',
              maxWidth: '100%',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              boxShadow: active ? '0 6px 18px rgba(0,0,0,0.18)' : 'none',
              border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
            }}
          >
            {b.text}{' '}
          </Box>
        );
      }

      const wordIndex = seg.index;
      const word = words[wordIndex] ?? '';
      const isPending = selectionStart === wordIndex;
      const style = wordStyles[wordIndex] || {};

      return (
        <Box
          component="span"
          key={`word-${wordIndex}-${idx}`}
          onClick={() => handleWordClick(wordIndex)}
          sx={{
            display: 'inline-block',
            padding: '2px 7px',
            marginRight: '5px',
            marginBottom: '4px',
            borderRadius: '999px',
            backgroundColor: isPending ? 'rgba(88,120,255,0.55)' : style.backgroundColor || 'transparent',
            color: '#fff',
            fontSize: '0.92rem',
            lineHeight: 1.1,
            cursor: 'pointer',
            userSelect: 'none',
            border: isPending ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
          }}
        >
          {word}{' '}
        </Box>
      );
    });

  if (!text) {
    return <Typography sx={{ color: '#fff' }}>Текст сна пуст</Typography>;
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 820,
        mx: 'auto',
      }}
    >
      {/* Верх: заголовок */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {!hideInternalBackButton && (
          <IconButton
            onClick={onBack}
            size="small"
            sx={{
              color: '#fff',
              bgcolor: 'transparent',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
            }}
            aria-label="Назад"
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
        )}

        {!hideHeader && (
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
            Выделите блоки в тексте сна
          </Typography>
        )}

        <Box sx={{ flex: 1 }} />

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
          Блоков: {blocks.length}
        </Typography>
      </Box>

      {/* Основной контейнер */}
      <Paper
        sx={{
          p: 2,
          borderRadius: 2,
          background: 'transparent',
          border: 'none',
          color: '#fff',
          boxShadow: 'none',

          // важно: больше НЕ скроллим тут (скролл только у DialogContent в родителе)
          maxHeight: 'none',
          overflow: 'visible',
        }}
      >
        <Box
          sx={{
            width: '100%',
            lineHeight: 1.45,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            overflowX: 'hidden',
          }}
        >
          {renderSegments()}
        </Box>
      </Paper>

      {/* Уведомления */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setSnackbar((s) => ({ ...s, open: false }));
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '&.MuiSnackbar-root': {
            bottom: 32,
          },
        }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          icon={false}
          variant="outlined"
          sx={{
            width: '100%',
            px: 2.4,
            py: 1.4,
            borderRadius: 2.5,
            display: 'flex',
            alignItems: 'center',
            border: `1px solid ${glassBorder}`,
            background: 'linear-gradient(135deg, rgba(16,24,48,0.92), rgba(40,56,96,0.92))',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            boxShadow: 'none',
            color: '#fff',
            '& .MuiAlert-message': {
              fontSize: '1.05rem',
              padding: 0,
            },
            ...(snackbar.severity === 'error'
              ? {
                  borderColor: 'rgba(255,120,120,0.9)',
                  background: 'linear-gradient(135deg, rgba(40,8,16,0.96), rgba(88,24,40,0.94))',
                }
              : {}),
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DreamBlocks;