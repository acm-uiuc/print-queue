import { Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { PrintPage } from './pages/PrintPage';
import { QueuePage } from './pages/QueuePage';
import { QueueDemoPage } from './pages/QueueDemoPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProtectedRoute } from './auth/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route
        path="/print"
        element={
          <ProtectedRoute>
            <PrintPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/queue"
        element={
          <ProtectedRoute>
            <QueuePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/queue/demo"
        element={
          <ProtectedRoute>
            <QueueDemoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
