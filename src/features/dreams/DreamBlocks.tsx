import React from 'react';
import type { Block } from './types';

interface DreamBlocksProps {
  blocks: Block[];
  onSelect: (block: Block) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export const DreamBlocks: React.FC<DreamBlocksProps> = ({ blocks, onSelect, onAdd, onRemove }) => {
  return (
    <div>
      {blocks.map(block => (
        <div key={block.id} style={{ marginBottom: 8, border: '1px solid #ccc', padding: 8 }}>
          <p>{block.text}</p>
          <button onClick={() => onSelect(block)}>Выбрать</button>
          <button onClick={() => onRemove(block.id)}>Удалить</button>
        </div>
      ))}
      <button onClick={onAdd}>Добавить блок</button>
    </div>
  );
};