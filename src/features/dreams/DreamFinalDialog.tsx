import React from 'react';

interface DreamFinalDialogProps {
  open: boolean;
  onClose: () => void;
  interpretation: string;
}

export const DreamFinalDialog: React.FC<DreamFinalDialogProps> = ({ open, onClose, interpretation }) => {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center',
    }}>
      <div style={{ backgroundColor: 'white', padding: 24, maxWidth: 500 }}>
        <h3>Итоговое толкование</h3>
        <p>{interpretation}</p>
        <button onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
};