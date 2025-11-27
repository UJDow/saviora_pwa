import React, { useEffect, useRef, useState } from 'react';
import { Box, TextField, IconButton, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface GlassInputBoxProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onClose?: () => void;
  containerStyle?: React.CSSProperties;
}

export const GlassInputBox: React.FC<GlassInputBoxProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  onClose,
  containerStyle = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const accentColor = 'rgba(88, 120, 255, 0.85)'; // цвет из логотипа
  const maxHeight = 160; // Максимальная высота поля ввода

  // Автоматическая подстройка высоты textarea с оптимизацией
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'; // сброс высоты
      const scrollHeight = inputRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, maxHeight) + 'px';
      if (inputRef.current.style.height !== newHeight) {
        inputRef.current.style.height = newHeight;
      }
      inputRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [value]);

  useEffect(() => {
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
  const transcript = event.results[0][0].transcript;
  onChange(value ? value + ' ' + transcript : transcript);
};

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, [onChange]);

  const handleClickOutside = (e: MouseEvent) => {
  if (
    containerRef.current &&
    !containerRef.current.contains(e.target as Node) &&
    onClose
  ) {
    onClose(); // <-- вызываем только если передан
  }
};

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative', // изменено с sticky на relative
        margin: '0 auto',
        width: 'calc(100% - 32px)',
        maxWidth: 600,
        bgcolor: 'transparent',
        borderRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        padding: '0',
        zIndex: 1300,
        boxSizing: 'border-box',
        userSelect: 'none',
        ...containerStyle,
      }}
      aria-label="Ввод сновидения"
    >
      <TextField
        variant="filled"
        placeholder="Опиши свой сон"
        fullWidth
        multiline
        maxRows={10} // ограничение по количеству строк (альтернатива maxHeight)
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 4096))}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        inputRef={inputRef}
        InputProps={{
          disableUnderline: true,
          sx: {
            bgcolor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            color: accentColor,
            fontSize: '1.1rem',
            px: 2,
            py: 1,
            overflowY: 'auto',
            '& .MuiInputBase-input': {
              padding: 0,
              lineHeight: '1.4em',
              color: accentColor,
              WebkitTextFillColor: accentColor,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            },
          },
        }}
        inputProps={{
          style: { color: accentColor },
        }}
        autoFocus
      />

      {!value.trim() ? (
        <Tooltip title={listening ? 'Остановить запись' : 'Голосовой ввод'}>
          <IconButton
            onClick={toggleListening}
            aria-label="Голосовой ввод"
            sx={{ ml: 1, p: 0.5, minWidth: 36, minHeight: 36, color: accentColor }}
          >
            {listening ? <MicOffIcon /> : <MicIcon />}
          </IconButton>
        </Tooltip>
      ) : (
        <IconButton
          onClick={onSend}
          disabled={disabled}
          aria-label="Отправить сон"
          sx={{ ml: 1, p: 0.5, minWidth: 36, minHeight: 36, color: accentColor }}
        >
          <SendIcon />
        </IconButton>
      )}
    </Box>
  );
};