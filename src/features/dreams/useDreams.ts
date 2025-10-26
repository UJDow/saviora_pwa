// src/features/dreams/useDreams.ts
import { useState, useCallback } from 'react';

export type Block = { id: string; text: string };
export type Message = { id: string; text: string; from: 'user' | 'ai' };
export type Dream = {
  id: string;
  user: string;
  dreamText: string;
  title?: string;
  blocks?: Block[];
  globalFinalInterpretation?: string | null;
  dreamSummary?: string | null;
  similarArtworks?: any[];
  date: number;
};

const API_URL = import.meta.env.VITE_API_URL;

function getAuthHeaders() {
  const token = localStorage.getItem('saviora_jwt');
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
}

export function useDreams() {
  const [dreamText, setDreamText] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [interpretation, setInterpretation] = useState('');
  const [dreamsHistory, setDreamsHistory] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(false);

  // Получить все сны пользователя
  const fetchDreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dreams`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Ошибка загрузки истории снов');
      const data = await res.json();
      setDreamsHistory(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // Сохранить новый сон
  const handleSaveDream = useCallback(async (text: string) => {
    setDreamText(text);
    setLoading(true);
    try {
      // Разбиваем на блоки по точкам
      const rawBlocks = text
        .split('.')
        .map(t => t.trim())
        .filter(Boolean);
      const blocksArr = rawBlocks.map(t => ({ id: crypto.randomUUID(), text: t }));
      setBlocks(blocksArr);

      const res = await fetch(`${API_URL}/dreams`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          dreamText: text,
          blocks: blocksArr,
        }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения сна');
      const dream = await res.json();
      setDreamsHistory(prev => [dream, ...prev]);
      setSelectedBlock(null);
      setMessages([]);
      setInterpretation('');
    } finally {
      setLoading(false);
    }
  }, []);

  // Удалить сон
  const deleteDream = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dreams/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Ошибка удаления сна');
      setDreamsHistory(prev => prev.filter(d => d.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  // Добавить новый блок
  const handleAddBlock = useCallback(() => {
    setBlocks(prev => [...prev, { id: crypto.randomUUID(), text: 'Новый блок' }]);
  }, []);

  // Удалить блок
  const handleRemoveBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setMessages([]);
    if (selectedBlock === id) setSelectedBlock(null);
  }, [selectedBlock]);

  // Выбрать блок
  const handleSelectBlock = useCallback((block: Block) => {
    setSelectedBlock(block.id);
    setMessages([]); // очищаем чат при выборе нового блока
  }, []);

  // Отправить сообщение в чат (AI-анализ блока)
  const handleSendMessage = useCallback(async (msg: string) => {
    const userMsg = { id: crypto.randomUUID(), text: msg, from: 'user' as const };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      // Отправляем на /analyze
      const blockText = blocks.find(b => b.id === selectedBlock)?.text || '';
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          blockText,
          lastTurns: [
            ...messages.map(m => ({
              role: m.from === 'user' ? 'user' : 'assistant',
              content: m.text,
            })),
            { role: 'user', content: msg },
          ],
        }),
      });
      if (!res.ok) throw new Error('Ошибка анализа блока');
      const data = await res.json();
      const aiText = data?.choices?.[0]?.message?.content || 'Нет ответа';
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), text: aiText, from: 'ai' as const },
      ]);
    } finally {
      setLoading(false);
    }
  }, [blocks, selectedBlock, messages]);

  // Получить итоговое толкование сна
  const handleShowFinal = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/summarize`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          history: messages.map(m => ({
            role: m.from === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          blockText: dreamText,
        }),
      });
      if (!res.ok) throw new Error('Ошибка итогового толкования');
      const data = await res.json();
      setInterpretation(data.summary || 'Нет итогового толкования');
      setFinalDialogOpen(true);
    } finally {
      setLoading(false);
    }
  }, [messages, dreamText]);

  // Закрыть итоговое толкование
  const handleCloseFinal = useCallback(() => {
    setFinalDialogOpen(false);
  }, []);

  return {
    dreamText,
    setDreamText,
    blocks,
    setBlocks,
    selectedBlock,
    setSelectedBlock,
    messages,
    setMessages,
    finalDialogOpen,
    setFinalDialogOpen,
    interpretation,
    setInterpretation,
    dreamsHistory,
    loading,
    fetchDreams,
    handleSaveDream,
    deleteDream,
    handleAddBlock,
    handleRemoveBlock,
    handleSelectBlock,
    handleSendMessage,
    handleShowFinal,
    handleCloseFinal,
  };
}