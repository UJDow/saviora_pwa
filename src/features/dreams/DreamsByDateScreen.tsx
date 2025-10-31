import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, Paper } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { useParams, useNavigate } from 'react-router-dom';

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const dayNames = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
  'Четверг', 'Пятница', 'Суббота'
];

type Dream = {
  id: string;
  dreamText: string;
  date: number;
  title?: string; // Добавлено поле title
};

interface DreamsByDateScreenProps {
  date?: string;
  onBack?: () => void;
  usePaper?: boolean;
  dreams?: Dream[];
}

function DateHeader({ date, onBack }: { date: Date; onBack?: () => void }) {
  const navigate = useNavigate();

  const monthName = monthNames[date.getMonth()];
  const dayName = dayNames[date.getDay()];
  const dayNumber = date.getDate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <Box
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        width: 'fit-content',
        color: 'primary.main',
        '&:hover': { opacity: 0.8 },
        mb: 2,
      }}
      onClick={handleBack}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleBack();
      }}
      aria-label="Назад"
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <ArrowBackIosNewIcon fontSize="small" sx={{ mr: 0.5 }} />
        <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
          {monthName}
        </Typography>
      </Box>
      <Typography variant="subtitle1" sx={{ ml: 3 }}>
        {dayName} — {dayNumber}
      </Typography>
    </Box>
  );
}

export function DreamsByDateScreen({ date: propDate, onBack, usePaper = true, dreams = [] }: DreamsByDateScreenProps) {
  const params = useParams<{ date: string }>();
  const date = propDate || params.date;
  const navigate = useNavigate();

  const [day, month, year] = date ? date.split('.') : ['01', '01', '1970'];
  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));

  return (
    <Box
      component={usePaper ? Paper : 'div'}
      elevation={usePaper ? 4 : 0}
      sx={{
        p: { xs: 2, sm: 4 },
        mt: usePaper ? 2 : 0,
        background: usePaper ? 'rgba(255,255,255,0.85)' : 'transparent',
        borderRadius: usePaper ? 3 : 0,
        maxWidth: 700,
        width: '100%',
        mx: 'auto',
      }}
    >
      <DateHeader date={dateObj} onBack={onBack} />

      {dreams.length === 0 ? (
        <Typography>Снов за эту дату нет.</Typography>
      ) : (
        <List disablePadding>
          {dreams.map((dream) => (
            <ListItem
              key={dream.id}
              sx={{
                textAlign: 'left',
                borderRadius: 2,
                mb: 1.5,
                p: { xs: 1.5, sm: 2 },
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                backgroundColor: 'background.paper',
                transition: 'box-shadow 0.3s ease',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  backgroundColor: 'background.default',
                },
                minHeight: 44,
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/dreams/${dream.id}`)}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="body1"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: { xs: 1, sm: 2 },
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'normal',
                      fontWeight: dream.title ? 'bold' : 'normal',
                    }}
                  >
                    {dream.title && dream.title.trim() !== '' ? dream.title : dream.dreamText}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}