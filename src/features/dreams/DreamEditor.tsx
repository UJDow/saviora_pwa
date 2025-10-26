import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';

export const DreamEditor: React.FC<{ onSave: (text: string) => void }> = ({ onSave }) => {
  const [text, setText] = useState('');

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Опиши свой сон</Typography>
      <TextField
        label="Текст сна"
        multiline
        rows={6}
        fullWidth
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2 }}
        onClick={() => onSave(text)}
        disabled={!text.trim()}
      >
        Сохранить сон
      </Button>
    </Box>
  );
};