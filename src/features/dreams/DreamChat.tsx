import React, { useState } from 'react';
import { Box, Typography, TextField, Button, List, ListItem } from '@mui/material';

type Message = { id: string; text: string; from: 'user' | 'ai' };

export const DreamChat: React.FC<{
  blockText: string;
  messages: Message[];
  onSend: (msg: string) => void;
}> = ({ blockText, messages, onSend }) => {
  const [input, setInput] = useState('');

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Чат по блоку сна</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {blockText}
      </Typography>
      <List sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
        {messages.map(msg => (
          <ListItem key={msg.id} sx={{ justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start' }}>
            <Box
              sx={{
                bgcolor: msg.from === 'user' ? 'primary.main' : 'grey.200',
                color: msg.from === 'user' ? 'primary.contrastText' : 'text.primary',
                px: 2, py: 1, borderRadius: 2,
                maxWidth: '70%',
              }}
            >
              {msg.text}
            </Box>
          </ListItem>
        ))}
      </List>
      <Box component="form" onSubmit={e => { e.preventDefault(); if (input.trim()) { onSend(input); setInput(''); } }}>
        <TextField
          value={input}
          onChange={e => setInput(e.target.value)}
          fullWidth
          placeholder="Введите сообщение..."
        />
        <Button type="submit" variant="contained" sx={{ mt: 1 }} disabled={!input.trim()}>
          Отправить
        </Button>
      </Box>
    </Box>
  );
};