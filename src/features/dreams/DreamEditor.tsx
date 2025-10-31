import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';

interface DreamEditorProps {
  onSave: (text: string) => Promise<void>;
}

export const DreamEditor: React.FC<DreamEditorProps> = ({ onSave }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(text);
      setText('');
    } finally {
      setLoading(false);
    }
  };

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
        onClick={handleSave}
        disabled={!text.trim() || loading}
      >
        {loading ? 'Сохраняем...' : 'Сохранить сон'}
      </Button>
    </Box>
  );
};