import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { addDream } from '../../utils/api';

interface DreamEditorProps {
  onSave?: (text: string) => Promise<void>;
}

export const DreamEditor: React.FC<DreamEditorProps> = ({ onSave }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSave = async () => {
    if (!text.trim()) return;
  
    setLoading(true);
    try {
      await addDream(text.trim());
      setText('');
      navigate('/dreams');
    
      if (onSave) {
        await onSave(text);
      }
    } catch (error) {
      console.error('Error saving dream:', error);
      alert('Ошибка сохранения сна');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Опиши свой сон
      </Typography>
      <TextField
        label="Текст сна"
        multiline
        rows={10}
        fullWidth
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Опишите ваш сон подробно..."
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