// src/screens/quiz/QuizModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  IconButton,
  Snackbar,
  Alert,
  Collapse,
  Card,
  CardActionArea,
  CardContent,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { motion, AnimatePresence } from 'framer-motion';

// === INTERFACES ===
export interface QuizQuestion {
  type: 'choice' | 'reflection';
  text: string;
  options?: string[];
  correctIndex?: number | null;
}

export interface QuizAnswer {
  questionIndex: number;
  userAnswer: string;
  disagreed?: boolean;
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  depthBonus: number;
}

interface QuizModalProps {
  quizId: string;
  questions: QuizQuestion[];
  contextTitle?: string;
  contextText?: string;
  onClose: () => void;
  onFinish: (result: QuizResult) => void;
  onSubmit: (quizId: string, answers: QuizAnswer[]) => Promise<QuizResult>;
  title?: string;
  subtitle?: string;
}

const StyledSnackbar = styled(Snackbar)(({ theme }) => ({
  '&.MuiSnackbar-anchorOriginBottomCenter': {
    bottom: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '420px',
  },
}));

export function QuizModal({
  quizId,
  questions,
  contextTitle,
  onClose,
  onFinish,
  onSubmit,
  title = 'Квиз',
  subtitle = 'Ответь на вопросы и получи бонусные очки глубины',
}: QuizModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'suggestion' | 'info'>('info');
  const [headerExpanded, setHeaderExpanded] = useState(true);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const softAzure = 'rgba(173, 216, 230, 0.8)';
  const softPurple = 'rgba(200, 162, 235, 0.7)';
  const glassWhite = 'rgba(255, 255, 255, 0.08)';
  const glassBorder = 'rgba(255, 255, 255, 0.15)';
  const softYellowGlass = 'rgba(255, 243, 205, 0.15)';

  const prevQuestion = currentIndex > 0 ? questions[currentIndex - 1] : null;
  const nextQuestion = currentIndex < questions.length - 1 ? questions[currentIndex + 1] : null;

  useEffect(() => {
    setSelectedOption(null);
    setReflectionText('');
  }, [currentIndex]);

  const handleNext = () => {
    if (!currentQuestion) return;
    if (currentQuestion.type === 'choice' && selectedOption === null) return;
    if (currentQuestion.type === 'reflection' && !reflectionText.trim()) return;

    const isChoice = currentQuestion.type === 'choice';
    const hasCorrectAnswer = currentQuestion.correctIndex !== undefined && currentQuestion.correctIndex !== null;
    const correct = isChoice && hasCorrectAnswer ? selectedOption === currentQuestion.correctIndex : true;

    const answer: QuizAnswer = {
      questionIndex: currentIndex,
      userAnswer: isChoice ? String(selectedOption) : reflectionText.trim(),
      disagreed: isChoice && hasCorrectAnswer && !correct,
    };

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (isChoice) {
      if (hasCorrectAnswer) {
        if (correct) {
          setSnackbarMessage('✅ Верно!');
          setSnackbarType('success');
        } else {
          setSnackbarMessage('Возможно, стоит вернуться и пересмотреть контекст вместе с Saviora.');
          setSnackbarType('suggestion');
        }
      } else {
        setSnackbarMessage('🧠 Глубокое наблюдение!');
        setSnackbarType('info');
      }
      setSnackbarOpen(true);
      setTimeout(() => {
        if (currentIndex < questions.length - 1) setCurrentIndex((prev) => prev + 1);
        else finishQuiz(newAnswers);
      }, 2000);
    } else {
      if (currentIndex < questions.length - 1) setCurrentIndex((prev) => prev + 1);
      else finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (finalAnswers: QuizAnswer[]) => {
    setIsSubmitting(true);
    try {
      const result = await onSubmit(quizId, finalAnswers);
      onFinish(result);
    } catch (e) {
      console.error('Quiz submission error:', e);
      setIsSubmitting(false);
    }
  };

  if (!currentQuestion) return null;

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: 520, 
      // ВАЖНО: Используем 100%, чтобы не вылезать за пределы родительского Dialog
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      // ВАЖНО: Просто большой отступ сверху.
      // 80px - база, + safe-area на всякий случай для айфонов
      pt: 'calc(80px + env(safe-area-inset-top))', 
    }}>
      {/* Шапка модалки */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, flexShrink: 0 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>{title}</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>{subtitle}</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}><CloseIcon /></IconButton>
      </Box>

      {/* Скролл-зона */}
      <Box sx={{ 
        flex: 1, 
        overflowY: 'auto', 
        px: 2, 
        pb: '150px', 
        display: 'block', 
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        '-ms-overflow-style': 'none',
      }}>
        
        {/* Заметка */}
        <Box sx={{ mb: 2, p: 1.25, background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', border: `1px solid ${glassBorder}`, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem' }}>
              {contextTitle || 'Заметка'}
            </Typography>
            <IconButton size="small" onClick={() => setHeaderExpanded(!headerExpanded)} sx={{ color: '#fff' }}>
              {headerExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={headerExpanded}>
            <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.4, mb: 1 }}>
              {currentQuestion.text}
            </Typography>
            {(prevQuestion || nextQuestion) && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: prevQuestion && nextQuestion ? '1fr 1fr' : '1fr' }, gap: 1 }}>
                {prevQuestion && (
                  <Card elevation={0} sx={{ background: 'rgba(255, 255, 255, 0.1)', border: `1px solid ${glassBorder}`, borderRadius: 2, color: '#fff' }}>
                    <CardActionArea onClick={() => setCurrentIndex(currentIndex - 1)}>
                      <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, py: 0.6, px: 1 }}>
                        <ArrowBackIcon sx={{ color: '#fff', opacity: 0.9, fontSize: 18, mt: '2px' }} />
                        <Typography variant="body2" sx={{ color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13 }}>
                          {prevQuestion.text}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                )}
                {nextQuestion && (
                  <Card elevation={0} sx={{ background: 'rgba(255, 255, 255, 0.1)', border: `1px solid ${glassBorder}`, borderRadius: 2, color: '#fff' }}>
                    <CardActionArea onClick={() => setCurrentIndex(currentIndex + 1)}>
                      <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, py: 0.6, px: 1 }}>
                        <ArrowForwardIcon sx={{ color: '#fff', opacity: 0.9, fontSize: 18, mt: '2px' }} />
                        <Typography variant="body2" sx={{ color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13 }}>
                          {nextQuestion.text}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                )}
              </Box>
            )}
          </Collapse>
        </Box>

        {/* Прогресс */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>Вопрос {currentIndex + 1} из {questions.length}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>{Math.round(progress)}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: softAzure, borderRadius: 3 } }} />
        </Box>

        {/* Вопрос */}
        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
            {currentQuestion.type === 'choice' && currentQuestion.options && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {currentQuestion.options.map((option, index) => (
                  <Button
                    key={index}
                    onClick={() => setSelectedOption(index)}
                    fullWidth
                    sx={{
                      textTransform: 'none', justifyContent: 'flex-start', textAlign: 'left', p: 2, borderRadius: 2,
                      border: `2px solid ${selectedOption === index ? softPurple : glassBorder}`,
                      bgcolor: selectedOption === index ? 'rgba(200, 162, 235, 0.15)' : glassWhite,
                      color: '#fff', backdropFilter: 'blur(10px)',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.95rem' }}>{option}</Typography>
                  </Button>
                ))}
              </Box>
            )}

            {currentQuestion.type === 'reflection' && (
              <Box component="textarea" value={reflectionText} onChange={(e: any) => setReflectionText(e.target.value)} placeholder="Твои мысли..."
                sx={{ width: '100%', minHeight: 120, p: 2, borderRadius: 2, border: `1px solid ${glassBorder}`, bgcolor: glassWhite, color: '#fff', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none', resize: 'none' }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Кнопка */}
        <Box sx={{ mt: 4 }}>
          <Button
            onClick={handleNext}
            disabled={(currentQuestion.type === 'choice' && selectedOption === null) || (currentQuestion.type === 'reflection' && !reflectionText.trim()) || isSubmitting}
            fullWidth
            sx={{ py: 2, borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: '1rem', background: softPurple, color: '#fff', '&:disabled': { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' } }}
          >
            {isSubmitting ? 'Сохраняем...' : (currentIndex < questions.length - 1 ? 'Далее' : 'Завершить')}
          </Button>
        </Box>
      </Box>

      {/* Snackbar */}
      <StyledSnackbar open={snackbarOpen} autoHideDuration={2500} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          icon={false} 
          sx={{ 
            width: '100%', color: '#fff', backdropFilter: 'blur(20px)', border: `1px solid ${glassBorder}`, borderRadius: 3, textAlign: 'center', justifyContent: 'center',
            background: snackbarType === 'suggestion' ? softYellowGlass : 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            '& .MuiAlert-message': { width: '100%', p: 1 }
          }}
        >
          {snackbarMessage}
        </Alert>
      </StyledSnackbar>
    </Box>
  );
}
