import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthScreen } from './features/auth/AuthScreen';
import { DreamsScreen } from './features/dreams/DreamsScreen';
import { PrivateRoute } from './features/auth/PrivateRoute';
import { DreamBlocks } from './features/dreams/DreamBlocks';
import { DreamChat } from './features/dreams/DreamChat';
import { DreamEditor } from './features/dreams/DreamEditor';
import { DreamFinalDialog } from './features/dreams/DreamFinalDialog';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { useDreams } from './features/dreams/useDreams';
import { DreamsByDateScreen } from './features/dreams/DreamsByDateScreen';
import { MonthDashboardScreen } from './features/profile/MonthDashboardScreen';
import { DreamDetail } from './features/dreams/DreamDetail'; // <-- импортируем новый компонент

function DreamChatWrapper() {
  const { id } = useParams<{ id: string }>();
  const {
    blocks,
    messages,
    handleSendMessage,
    selectedBlock,
  } = useDreams();

  const blockText = blocks.find(b => b.id === selectedBlock)?.text || 'Выберите блок';

  return (
    <DreamChat
      blockText={blockText}
      messages={messages}
      onSend={handleSendMessage}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthScreen />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <ProfileScreen />
            </PrivateRoute>
          }
        />
        <Route
          path="/dreams"
          element={
            <PrivateRoute>
              <DreamsScreen />
            </PrivateRoute>
          }
        />
        <Route
          path="/dreams/new"
          element={
            <PrivateRoute>
              <DreamEditor />
            </PrivateRoute>
          }
        />
        <Route
          path="/dreams/:id/blocks"
          element={
            <PrivateRoute>
              <DreamBlocks />
            </PrivateRoute>
          }
        />
        <Route
          path="/dreams/:id/chat"
          element={
            <PrivateRoute>
              <DreamChatWrapper />
            </PrivateRoute>
          }
        />
        <Route
          path="/dreams/:id/final"
          element={
            <PrivateRoute>
              <DreamFinalDialog
                open={false}
                onClose={() => {}}
                interpretation=""
              />
            </PrivateRoute>
          }
        />
        <Route
          path="/dreams/date/:date"
          element={
            <PrivateRoute>
              <DreamsByDateScreen />
            </PrivateRoute>
          }
        />
        {/* Новый роут для детального просмотра сна */}
        <Route
          path="/dreams/:id"
          element={
            <PrivateRoute>
              <DreamDetail />
            </PrivateRoute>
          }
        />
        {/* Новый роут для экрана с месячным календарём и дашбордом */}
        <Route
          path="/calendar/month"
          element={
            <PrivateRoute>
              <MonthDashboardScreen />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;