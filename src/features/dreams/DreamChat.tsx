import React from 'react';
import type { Message } from './types';

interface DreamChatProps {
  blockText: string;
  messages: Message[];
  onSend: (text: string) => void;
}

export const DreamChat: React.FC<DreamChatProps> = ({ blockText, messages, onSend }) => {
  const [input, setInput] = React.useState('');

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, marginTop: 16 }}>
      <h4>Чат по блоку: {blockText}</h4>
      <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
            <p><b>{msg.sender}:</b> {msg.text}</p>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        style={{ width: '80%', marginRight: 8 }}
      />
      <button onClick={handleSend}>Отправить</button>
    </div>
  );
};