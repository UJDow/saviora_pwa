// src/features/dreams/useDreams.ts
import { useState, useCallback } from 'react';
import { request } from 'src/utils/api';
import type { Block, Message, Dream } from './types';

export function useDreams() {
  const [dreamText, setDreamText] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [interpretation, setInterpretation] = useState('');
  const [dreamsHistory, setDreamsHistory] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDreams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<Dream[]>('/dreams', {}, true);
      setDreamsHistory(data);
    } catch (error) {
      console.error('Ошибка загрузки истории снов', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveDream = useCallback(async (text: string) => {
    setDreamText(text);
    setLoading(true);
    try {
      const rawBlocks = text
        .split('.')
        .map(t => t.trim())
        .filter(Boolean);
      const blocksArr = rawBlocks.map(t => ({ id: crypto.randomUUID(), text: t }));
      setBlocks(blocksArr);

      const dream = await request<Dream>('/dreams', {
        method: 'POST',
        body: JSON.stringify({
          dreamText: text,
          blocks: blocksArr,
        }),
      }, true);

      setDreamsHistory(prev => [dream, ...prev]);
      setSelectedBlock(null);
      setMessages([]);
      setInterpretation('');
    } catch (error) {
      console.error('Ошибка сохранения сна', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteDream = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await request(`/dreams/${id}`, {
        method: 'DELETE',
      }, true);
      setDreamsHistory(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Ошибка удаления сна', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddBlock = useCallback(() => {
    setBlocks(prev => [...prev, { id: crypto.randomUUID(), text: 'Новый блок' }]);
  }, []);

  const handleRemoveBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setMessages([]);
    if (selectedBlock === id) setSelectedBlock(null);
  }, [selectedBlock]);

  const handleSelectBlock = useCallback((block: Block) => {
    setSelectedBlock(block.id);
    setMessages([]);
  }, []);

  const handleSendMessage = useCallback(async (msg: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), text: msg, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const blockText = blocks.find(b => b.id === selectedBlock)?.text || '';
      const data = await request<any>('/analyze', {
        method: 'POST',
        body: JSON.stringify({
          blockText,
          lastTurns: [
            ...messages.map(m => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              content: m.text,
            })),
            { role: 'user', content: msg },
          ],
        }),
      }, true);

      const aiText = data?.choices?.[0]?.message?.content || 'Нет ответа';
      const aiMsg: Message = { id: crypto.randomUUID(), text: aiText, sender: 'bot' };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Ошибка анализа блока', error);
    } finally {
      setLoading(false);
    }
  }, [blocks, selectedBlock, messages]);

  const handleShowFinal = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<{ summary: string }>('/summarize', {
        method: 'POST',
        body: JSON.stringify({
          history: messages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          blockText: dreamText,
        }),
      }, true);

      setInterpretation(data.summary || 'Нет итогового толкования');
      setFinalDialogOpen(true);
    } catch (error) {
      console.error('Ошибка итогового толкования', error);
    } finally {
      setLoading(false);
    }
  }, [messages, dreamText]);

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