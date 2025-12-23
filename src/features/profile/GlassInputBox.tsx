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
  placeholder?: string;
}

export const GlassInputBox: React.FC<GlassInputBoxProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  onClose,
  containerStyle = {},
  placeholder = 'Опиши свой сон',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const iconColor = 'rgba(255,255,255,0.85)';
  const maxHeight = 160;

  // авто‑высота textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const scrollHeight = inputRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, maxHeight) + 'px';
      if (inputRef.current.style.height !== newHeight) {
        inputRef.current.style.height = newHeight;
      }
      inputRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [value]);

  // инициализация SpeechRecognition
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
  }, [onChange, value]);

  const handleClickOutside = (e: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node) &&
      onClose
    ) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    } else if (e.key === 'Escape' && onClose) {
      onClose();
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
        position: 'relative',
        width: '100%',
        bgcolor: 'transparent',
        borderRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        padding: 0,
        zIndex: 1300,
        boxSizing: 'border-box',
        userSelect: 'none',
        ...containerStyle,
      }}
      aria-label="Ввод"
    >
      <TextField
        variant="filled"
        placeholder={placeholder}
        fullWidth
        multiline
        maxRows={10}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 4096))}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        inputRef={inputRef}
        // глобально для этого TextField
        sx={{
          '& .MuiInputBase-input::placeholder': {
            color: 'rgba(255,255,255,0.55)',
            opacity: 1,
          },
        }}
        InputProps={{
          disableUnderline: true,
          sx: {
            bgcolor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            color: 'white',
            fontSize: '1.1rem',
            px: 2,
            py: 1,
            overflowY: 'auto',
            '& .MuiInputBase-input': {
              padding: 0,
              lineHeight: '1.4em',
              color: 'white',
              WebkitTextFillColor: 'white',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              // плейсхолдер более прозрачный
              '&::placeholder': {
                color: 'rgba(255,255,255,0.55)',
                opacity: 1,
              },
              // скроллбар
              '&::-webkit-scrollbar': {
                width: '8px',
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255,255,255,0.3)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: 'rgba(255,255,255,0.5)',
              },
            },
          },
        }}
        inputProps={{
          style: { color: 'white' },
        }}
        autoFocus
      />

      {!value.trim() ? (
        <Tooltip title={listening ? 'Остановить запись' : 'Голосовой ввод'}>
          <IconButton
            onClick={toggleListening}
            aria-label="Голосовой ввод"
            sx={{ ml: 1, p: 0.5, minWidth: 36, minHeight: 36, color: iconColor }}
          >
            {listening ? <MicOffIcon /> : <MicIcon />}
          </IconButton>
        </Tooltip>
      ) : (
        <IconButton
          onClick={onSend}
          disabled={disabled}
          aria-label="Отправить"
          sx={{ ml: 1, p: 0.5, minWidth: 36, minHeight: 36, color: iconColor }}
        >
          <SendIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default GlassInputBox;