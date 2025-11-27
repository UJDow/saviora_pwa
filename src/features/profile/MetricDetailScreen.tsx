// MetricDetailScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Chip,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { request } from 'src/utils/api'; // <-- adjust path if needed

type DreamPayload = {
  id: string;
  title?: string;
  date?: string; // ISO
  text?: string;
  dreamSummary?: string | null;
  globalFinalInterpretation?: string | null;
  similarArtworks?: string | null; // possibly JSON stringified array or URLs
  messages?: Array<{ role: 'assistant' | 'user' | string; text: string; ts?: string }>;
  interpreted?: boolean;
  tags?: string[];
  // any other fields from your API
};

export const MetricDetailScreen: React.FC = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // If dashboard navigated with state: { dream }
  const initialDream = (location.state as any)?.dream as DreamPayload | undefined;

  const [dream, setDream] = useState<DreamPayload | null>(initialDream ?? null);
  const [loading, setLoading] = useState<boolean>(!initialDream && !!routeId);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [shareSnackbarOpen, setShareSnackbarOpen] = useState(false);

  const fetchDream = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<DreamPayload>(`/dreams/${encodeURIComponent(id)}`, {}, true);
      // assume server returns dream object or { error }
      if ((data as any)?.error) {
        throw new Error((data as any).message || 'Server error');
      }
      setDream(data);
    } catch (e: any) {
      console.error('fetchDream error', e);
      setError(e?.message || 'Не удалось загрузить запись');
      setDream(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!dream && routeId) {
      fetchDream(routeId);
    }
  }, [dream, routeId, fetchDream]);

  // Delete handler
  const handleDelete = async () => {
    if (!dream?.id) return;
    setConfirmDeleteOpen(false);
    setLoading(true);
    try {
      const res = await request(`/dreams/${encodeURIComponent(dream.id)}`, { method: 'DELETE' }, true);
      if ((res as any)?.error) throw new Error((res as any).message || 'Ошибка при удалении');
      navigate(-1);
    } catch (e: any) {
      console.error('delete error', e);
      setError(e?.message || 'Не удалось удалить запись');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const link = `${window.location.origin}/metric/${dream?.id}`;
    navigator.clipboard?.writeText(link).then(() => {
      setShareSnackbarOpen(true);
    }).catch(() => {
      setShareSnackbarOpen(true);
    });
  };

  const parseArtworks = (raw?: string | null): string[] => {
    if (!raw) return [];
    try {
      // If it's JSON stringified array of urls
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // not JSON — maybe comma-separated or a single url
      if (raw.includes(',')) return raw.split(',').map(s => s.trim());
      return [raw];
    }
    return [];
  };

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: '#fff' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Детали записи
          </Typography>

          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Tooltip title="Редактировать">
              <IconButton
                color="inherit"
                onClick={() => {
                  if (dream?.id) navigate(`/dreams/${dream.id}/edit`, { state: { dream } });
                }}
                disabled={!dream}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Поделиться ссылкой">
              <IconButton color="inherit" onClick={handleShare} disabled={!dream}>
                <ShareIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Удалить">
              <IconButton color="inherit" onClick={() => setConfirmDeleteOpen(true)} disabled={!dream}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Paper sx={{ p: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress color="inherit" />
            </Box>
          ) : error ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>
              <Button variant="contained" onClick={() => routeId ? fetchDream(routeId) : window.location.reload()}>Попробовать снова</Button>
            </Box>
          ) : dream ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.06)', width: 72, height: 72 }}>
                  <ImageIcon />
                </Avatar>

                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                    {dream.title ?? `Запись ${dream.id?.slice(0, 6)}`}
                  </Typography>

                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {formatDate(dream.date)}
                  </Typography>

                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {dream.interpreted && <Chip icon={<CheckCircleIcon />} label="Проанализировано" size="small" color="success" />}
                    {(dream.tags ?? []).map(t => <Chip key={t} label={t} size="small" />)}
                    {dream.similarArtworks && <Chip icon={<ImageIcon />} label="Арт" size="small" />}
                    {(dream.messages && dream.messages.length > 0) && <Chip icon={<ChatBubbleIcon />} label={`${dream.messages.length} диалог(а)`} size="small" />}
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mb: 2 }} />

              {/* Основной текст */}
              {dream.text && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>Текст сна</Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-wrap' }}>{dream.text}</Typography>
                </Box>
              )}

              {/* Summary / Interpretation */}
              {(dream.dreamSummary || dream.globalFinalInterpretation) && (
                <Box sx={{ mb: 2 }}>
                  {dream.dreamSummary && (
                    <>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>Краткое резюме</Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>{dream.dreamSummary}</Typography>
                    </>
                  )}

                  {dream.globalFinalInterpretation && (
                    <>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>Интерпретация</Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>{dream.globalFinalInterpretation}</Typography>
                    </>
                  )}
                </Box>
              )}

              {/* Artworks */}
              {dream.similarArtworks && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>Арт-работы (похожие)</Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                      },
                    }}
                  >
                    {parseArtworks(dream.similarArtworks).map((src, i) => (
                      <Paper
                        key={i}
                        onClick={() => window.open(src, '_blank')}
                        sx={{
                          cursor: 'pointer',
                          height: 140,
                          backgroundImage: `url(${src})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: 1,
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                        aria-label={`art-${i}`}
                        elevation={0}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Messages / Dialog */}
              {dream.messages && dream.messages.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>Диалог с ассистентом</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {dream.messages.map((m, idx) => (
                      <Box key={idx} sx={{
                        alignSelf: m.role === 'assistant' ? 'flex-start' : 'flex-end',
                        maxWidth: '85%',
                        p: 1.25, borderRadius: 1,
                        background: m.role === 'assistant' ? 'rgba(255,255,255,0.04)' : 'linear-gradient(90deg, rgba(88,120,255,0.12), rgba(139,92,246,0.12))'
                      }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>{m.role}</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)' }}>{m.text}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" onClick={() => navigate(`/dreams/${dream.id}/edit`, { state: { dream } })} startIcon={<EditIcon />}>Редактировать</Button>
                <Button variant="outlined" color="error" onClick={() => setConfirmDeleteOpen(true)} startIcon={<DeleteIcon />}>Удалить</Button>
                <Button variant="outlined" onClick={handleShare} startIcon={<ShareIcon />}>Поделиться</Button>
              </Box>
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>Запись не найдена</Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Confirm delete dialog */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>Удалить запись?</DialogTitle>
        <DialogContent>
          <Typography>Вы действительно хотите удалить эту запись? Действие необратимо.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Отмена</Button>
          <Button color="error" onClick={handleDelete}>Удалить</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={shareSnackbarOpen} autoHideDuration={3500} onClose={() => setShareSnackbarOpen(false)}>
        <Alert severity="success" sx={{ width: '100%' }} onClose={() => setShareSnackbarOpen(false)}>Ссылка скопирована в буфер обмена</Alert>
      </Snackbar>
    </Box>
  );
};

export default MetricDetailScreen;