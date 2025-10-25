// src/features/dreams/DreamsList.tsx
import React, { useEffect, useState } from 'react';
import { api, Dream } from '../../utils/api';
import {
  Box, Typography, List, ListItem, ListItemText, Paper, CircularProgress, Alert,
} from '@mui/material';

export const DreamsList: React.FC = () => {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDreams()
      .then(setDreams)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!dreams.length) return <Typography>Снов пока нет.</Typography>;

  return (
    <Paper sx={{ p: 2, mt: 4, maxWidth: 400, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>Твои сны</Typography>
      <List>
        {dreams.map(dream => (
          <ListItem key={dream.id}>
            <ListItemText
              primary={dream.text}
              secondary={new Date(dream.createdAt).toLocaleString()}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};