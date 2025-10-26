import React from 'react';
import { DreamEditor } from './DreamEditor';
import { DreamBlocks } from './DreamBlocks';
import { DreamChat } from './DreamChat';
import { DreamFinalDialog } from './DreamFinalDialog';
import { useDreams } from './useDreams';

export const DreamsScreen: React.FC = () => {
  const {
    dreamText,
    blocks,
    selectedBlock,
    messages,
    finalDialogOpen,
    interpretation,
    loading,
    handleSaveDream,
    handleAddBlock,
    handleRemoveBlock,
    handleSelectBlock,
    handleSendMessage,
    handleShowFinal,
    handleCloseFinal,
  } = useDreams();

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <DreamEditor onSave={handleSaveDream} />
      {blocks.length > 0 && (
        <DreamBlocks
          blocks={blocks}
          onSelect={handleSelectBlock}
          onAdd={handleAddBlock}
          onRemove={handleRemoveBlock}
        />
      )}
      {selectedBlock && (
        <DreamChat
          blockText={blocks.find(b => b.id === selectedBlock)?.text || ''}
          messages={messages}
          onSend={handleSendMessage}
        />
      )}
      {blocks.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button onClick={handleShowFinal} disabled={loading}>
            {loading ? 'Загрузка...' : 'Показать итоговое толкование'}
          </button>
        </div>
      )}
      <DreamFinalDialog
        open={finalDialogOpen}
        onClose={handleCloseFinal}
        interpretation={interpretation}
      />
    </div>
  );
};