import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { useNavigate, useParams } from 'react-router-dom';
import { updateDream, deleteDream, getDreams } from '../../utils/api';
import type { Dream } from '../../utils/api';  // Импорт типа с type-only

const categories = [
  'Яркий',
  'Тревожный',
  'Спокойный',
  'Повторяющийся',
  'Ночной кошмар',
  'Осознанный',
  'Другой',
];

export function DreamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dream, setDream] = useState<Dream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedText, setEditedText] = useState('');
  const [editedDreamSummary, setEditedDreamSummary] = useState('');
  const [editedCategory, setEditedCategory] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    async function fetchDream() {
      try {
        setLoading(true);
        setError(null);
        const dreams = await getDreams();
        const found = dreams.find((d) => d.id === id);
        if (!found) {
          setError('Сон не найден');
          setDream(null);
        } else {
          setDream(found);
          setEditedTitle(found.title || '');
          setEditedText(found.dreamText);
          setEditedDreamSummary(found.dreamSummary || '');
          setEditedCategory(found.category || null);
        }
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
        setDream(null);
      } finally {
        setLoading(false);
      }
    }
    fetchDream();
  }, [id]);

  const handleSave = async () => {
    if (!dream) return;
    try {
      const updated = await updateDream(
        dream.id,
        editedText,
        editedTitle,
        undefined,
        null,
        editedDreamSummary || null,
        undefined,
        editedCategory || null
      );

      setDream({
        ...updated,
        title: editedTitle,
        dreamSummary: editedDreamSummary || null,
        category: editedCategory || null,
      });
      setEditing(false);
      setSnackbar({ open: true, message: 'Сон обновлён', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Ошибка обновления', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!dream) return;
    try {
      await deleteDream(dream.id);
      setDeleting(false);
      setSnackbar({ open: true, message: 'Сон удалён', severity: 'success' });
      navigate(-1);
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Ошибка удаления', severity: 'error' });
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!dream) return null;

  const dateStr = new Date(dream.date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', p: 3, position: 'relative' }}>
      <Box
        sx={{ cursor: 'pointer', mb: 2, display: 'inline-flex', alignItems: 'center', color: 'primary.main' }}
        onClick={() => navigate(-1)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate(-1);
        }}
        aria-label="Назад"
      >
        <ArrowBackIosNewIcon fontSize="small" sx={{ mr: 0.5 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          Назад
        </Typography>
      </Box>

      <Typography variant="h6" sx={{ mb: 2 }}>
        {dateStr}
      </Typography>

      <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
        <IconButton aria-label="Редактировать" onClick={() => setEditing(true)}>
          <EditIcon />
        </IconButton>
        <IconButton aria-label="Удалить" onClick={() => setDeleting(true)} color="error">
          <DeleteIcon />
        </IconButton>
      </Box>

      {!editing ? (
        <>
          {dream.title && (
            <Typography variant="h5" sx={{ mb: 1 }}>
              {dream.title}
            </Typography>
          )}
          {dream.category && (
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Категория: {dream.category}
            </Typography>
          )}
          {dream.dreamSummary && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
              Контекст: {dream.dreamSummary}
            </Typography>
          )}
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {dream.dreamText}
          </Typography>
        </>
      ) : (
        <Box component="form" sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Название сна"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            fullWidth
          />
          <Autocomplete
            freeSolo
            options={categories}
            value={editedCategory}
            onChange={(_, newValue) => setEditedCategory(newValue)}
            onInputChange={(_, newInputValue) => setEditedCategory(newInputValue)}
            renderInput={(params) => <TextField {...params} label="Категория сна" />}
          />
          <TextField
            label="Контекст сновидения"
            value={editedDreamSummary}
            onChange={(e) => setEditedDreamSummary(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
          <TextField
            label="Текст сна"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            multiline
            minRows={4}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={handleSave} disabled={!editedText.trim()}>
              Сохранить
            </Button>
            <Button variant="outlined" onClick={() => setEditing(false)}>
              Отмена
            </Button>
          </Box>
        </Box>
      )}

      <Dialog open={deleting} onClose={() => setDeleting(false)}>
        <DialogTitle>Удалить сон?</DialogTitle>
        <DialogContent>
          <Typography>Вы уверены, что хотите удалить этот сон? Это действие нельзя отменить.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(false)}>Отмена</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}