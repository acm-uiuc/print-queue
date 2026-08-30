import { lazy, Suspense } from "react";
import { Center, Loader } from "@mantine/core";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useRuntimeConfig } from "./runtimeConfig";
const LoginPage = lazy(() =>
  import("./screens/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const UnauthorizedPage = lazy(() =>
  import("./screens/UnauthorizedPage").then((module) => ({
    default: module.UnauthorizedPage,
  })),
);
const PrintPage = lazy(() =>
  import("./screens/PrintPage").then((module) => ({
    default: module.PrintPage,
  })),
);
const QueuePage = lazy(() =>
  import("./screens/QueuePage").then((module) => ({
    default: module.QueuePage,
  })),
);
const QueueDemoPage = lazy(() =>
  import("./screens/QueueDemoPage").then((module) => ({
    default: module.QueueDemoPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./screens/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);

function App() {
  const { enableDemoRoutes } = useRuntimeConfig();
  return (
    <Suspense
      fallback={
        <Center mih="50vh">
          <Loader />
        </Center>
      }
    >
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<LoginPage />} />
        <Route path="/logout" element={<LoginPage />} />
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
        {enableDemoRoutes ? (
          <Route
            path="/queue/demo"
            element={
              <ProtectedRoute>
                <QueueDemoPage />
              </ProtectedRoute>
            }
          />
        ) : null}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
