import React, { useState } from 'react';

export interface WordBlock {
  id: string;
  start: number;
  end: number;
  text: string;
  label?: string;
}

interface DreamTextSelectorProps {
  text: string;
  onBlocksChange?: (blocks: WordBlock[]) => void;
}

export const DreamTextSelector: React.FC<DreamTextSelectorProps> = ({ text, onBlocksChange }) => {
  const [blocks, setBlocks] = useState<WordBlock[]>([]);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

  const words = text.split(' ');

  const handleWordClick = (index: number) => {
    if (selectionStart === null) {
      setSelectionStart(index);
    } else {
      const start = Math.min(selectionStart, index);
      const end = Math.max(selectionStart, index);
      const blockText = words.slice(start, end + 1).join(' ');

      const newBlock: WordBlock = { id: crypto.randomUUID(), start, end, text: blockText };
      const newBlocks = [...blocks, newBlock];
      setBlocks(newBlocks);
      setSelectionStart(null);
      if (onBlocksChange) onBlocksChange(newBlocks);
    }
  };

  const getBlockIndexForWord = (wordIndex: number) => {
    return blocks.findIndex(block => wordIndex >= block.start && wordIndex <= block.end);
  };

  const colors = ['#a0c4ff', '#b5ead7', '#ffb7b2', '#ffdac1', '#e2f0cb'];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {words.map((word, idx) => {
        const blockIndex = getBlockIndexForWord(idx);
        const isSelectedStart = selectionStart === idx;
        const isSelecting = selectionStart !== null;

        const style: React.CSSProperties = {
          padding: '4px 8px',
          borderRadius: 4,
          border: '1px solid #ccc',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: blockIndex >= 0 ? colors[blockIndex % colors.length] : isSelectedStart ? '#ffd6a5' : '#f0f0f0',
          fontWeight: isSelectedStart ? 'bold' : 'normal',
          transition: 'background-color 0.3s',
        };

        return (
          <span
            key={idx}
            style={style}
            onClick={() => handleWordClick(idx)}
            title={isSelecting && !isSelectedStart ? 'Выберите конец блока' : 'Выберите начало блока'}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};