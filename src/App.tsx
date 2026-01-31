import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom';
import { AuthScreen } from './features/auth/AuthScreen';
import { DreamsScreen } from './features/dreams/DreamsScreen';
import { PrivateRoute } from './features/auth/PrivateRoute';
import { DreamChat } from './features/dreams/DreamChat';
import { DreamEditor } from './features/dreams/DreamEditor';
import { DreamFinalDialog } from './features/dreams/DreamFinalDialog';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { DreamsByDateScreen } from './features/dreams/DreamsByDateScreen';
import { MonthDashboardScreen } from './features/profile/MonthDashboardScreen';
import { MetricDetailScreen } from './features/profile/MetricDetailScreen';
import { DreamDetail } from './features/dreams/DreamDetail';
import { UserProfileScreen } from './features/profile/UserProfileScreen';
import { ProfileEditForm } from './features/profile/ProfileEditForm';
import { ProfileProvider } from './features/profile/ProfileContext';
import { SimilarArtworksScreen } from './features/dreams/SimilarArtworksScreen';
import { ArtworkChat } from './features/dreams/ArtworkChat';

import { FeedScreen } from 'src/features/feed/FeedScreen';

// Новые импорты для daily
import DailyConvoScreen from './features/daily/DailyConvoScreen';
import DailyConvoChat from './features/daily/DailyConvoChat';

function DreamBlocksRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/dreams" replace />;
  }
  return <Navigate to={`/dreams/${id}?view=blocks`} replace />;
}

function DreamEditorWrapper() {
  const handleSave = async (_text: string): Promise<void> => {
    // Логика сохранения
  };

  return <DreamEditor onSave={handleSave} />;
}

function App() {
  return (
    <ProfileProvider>
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

          {/* Daily list / entry points (ProfileScreen также умеет обрабатывать календарь/фильтрацию) */}
          <Route
            path="/daily"
            element={
              <PrivateRoute>
                {/* Можно заменить на Dedicated DailyListScreen при желании */}
                <ProfileScreen />
              </PrivateRoute>
            }
          />

          {/* Просмотр отдельной дневной записи */}
          <Route
            path="/daily/:id"
            element={
              <PrivateRoute>
                <DailyConvoScreen />
              </PrivateRoute>
            }
          />

          {/* Чат для дневной записи */}
          <Route
            path="/daily/:id/chat"
            element={
              <PrivateRoute>
                <DailyConvoChat />
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
            path="/feed"
            element={
              <PrivateRoute>
                <FeedScreen />
              </PrivateRoute>
            }
          />
          <Route
            path="/dreams/new"
            element={
              <PrivateRoute>
                <DreamEditorWrapper />
              </PrivateRoute>
            }
          />
          <Route
            path="/dreams/:id/blocks"
            element={
              <PrivateRoute>
                <DreamBlocksRedirect />
              </PrivateRoute>
            }
          />
          <Route
            path="/dreams/:id/chat"
            element={
              <PrivateRoute>
                <DreamChat />
              </PrivateRoute>
            }
          />
          <Route
            path="/dreams/:id/final"
            element={
              <PrivateRoute>
                <DreamFinalDialog open={false} onClose={() => {}} interpretation="" />
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
          <Route
            path="/dreams/:id"
            element={
              <PrivateRoute>
                <DreamDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/dreams/:id/similar"
            element={
              <PrivateRoute>
                <SimilarArtworksScreen />
              </PrivateRoute>
            }
          />
          <Route
            path="/dreams/:id/artwork-chat/:artworkIdx"
            element={
              <PrivateRoute>
                <ArtworkChat />
              </PrivateRoute>
            }
          />
          <Route
            path="/calendar/month"
            element={
              <PrivateRoute>
                <MonthDashboardScreen />
              </PrivateRoute>
            }
          />
          <Route
            path="/stats/:metricKey"
            element={
              <PrivateRoute>
                <MetricDetailScreen />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/user"
            element={
              <PrivateRoute>
                <UserProfileScreen />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <PrivateRoute>
                <ProfileEditForm />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProfileProvider>
  );
}

export default App;