// DreamBlocks.tsx
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Box, Paper, Typography, IconButton, Snackbar, Alert } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { getDreams, updateDream } from '../../utils/api';
import type { Dream } from '../../utils/api';
import type { WordBlock } from './DreamTextSelector';

interface DreamBlocksProps {
  text: string;
  blocks: WordBlock[];
  onBlocksChange: (blocks: WordBlock[]) => void;
  dreamId: string;
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
  dreamId,
  onBack,
  hideInternalBackButton = false,
  activeBlockId,
  onActiveBlockChange,
  hideHeader = false,
}) => {
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [dream, setDream] = useState<Dream | null>(null);
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

  // Новые стили для слов внутри блоков
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

  useEffect(() => {
    // подгружаем данные сна, если нужно
    async function load() {
      try {
        const list = await getDreams();
        const found = list.find((d) => d.id === dreamId);
        if (found) {
          setDream(found);
          if (Array.isArray(found.blocks) && found.blocks.length) {
            onBlocksChange(found.blocks as WordBlock[]);
          }
        }
      } catch (err) {
        console.error('Dream load error', err);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreamId]);

  useEffect(() => {
    if (!dream) return;
    // автосохранение блоков
    const save = async () => {
      try {
        await updateDream(
          dreamId,
          dream.dreamText,
          dream.title,
          blocks,
          dream.globalFinalInterpretation,
          dream.dreamSummary,
          dream.similarArtworks,
          dream.category,
          dream.date,
        );
      } catch (err) {
        setSnackbar({ open: true, message: 'Ошибка сохранения блоков', severity: 'error' });
      }
    };
    void save();
  }, [blocks, dream, dreamId]);

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
      id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      start,
      end,
      text: textSlice,
    };

    const updated = [...blocks, newBlock].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
    onBlocksChange(updated);
    onActiveBlockChange?.(newBlock.id);
    setSelectionStart(null);
    setSnackbar({ open: true, message: 'Блок создан', severity: 'success' });
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
              padding: '6px 10px',
              marginRight: '8px',
              marginBottom: '8px',
              borderRadius: '14px',
              backgroundColor: active ? color.replace(/0\.(\d+)/, '0.92') : color,
              color: '#fff',
              fontSize: '0.95rem',
              lineHeight: 1.2,
              cursor: 'pointer',
              userSelect: 'none',
              maxWidth: '100%',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              // лёгкая тень для читаемости
              boxShadow: active ? '0 6px 18px rgba(0,0,0,0.18)' : 'none',
              border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
            }}
          >
            {b.text}
            {' '}
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
            padding: '4px 8px',
            marginRight: '6px',
            marginBottom: '8px',
            borderRadius: '999px',
            backgroundColor: isPending ? 'rgba(88,120,255,0.55)' : style.backgroundColor || 'transparent',
            color: '#fff',
            fontSize: '0.92rem',
            lineHeight: 1.3,
            cursor: 'pointer',
            userSelect: 'none',
            border: isPending ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
          }}
        >
          {word}
          {' '}
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

        {/* Показываем внутренний заголовок только если не передан hideHeader */}
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
          maxHeight: '72vh',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: 'none',
          '&::-webkit-scrollbar': { width: 0, height: 0 },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
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
        autoHideDuration={2600}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DreamBlocks;