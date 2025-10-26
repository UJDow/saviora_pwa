import React from 'react';
import { Box, Chip, Typography, Button } from '@mui/material';

type Block = { id: string; text: string };

export const DreamBlocks: React.FC<{
  blocks: Block[];
  onSelect: (block: Block) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}> = ({ blocks, onSelect, onAdd, onRemove }) => (
  <Box>
    <Typography variant="h6" gutterBottom>Блоки сна</Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
      {blocks.map(block => (
        <Chip
          key={block.id}
          label={block.text}
          onClick={() => onSelect(block)}
          onDelete={() => onRemove(block.id)}
          color="primary"
          variant="outlined"
        />
      ))}
    </Box>
    <Button variant="outlined" onClick={onAdd}>Добавить блок</Button>
  </Box>
);