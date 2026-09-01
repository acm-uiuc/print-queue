import { lazy, Suspense } from "react";
import { Center, Loader } from "@mantine/core";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";

const LoginPage = lazy(() => import("./screens/LoginPage"));
const PrintPage = lazy(() => import("./screens/PrintPage"));
const ProfilePage = lazy(() => import("./screens/ProfilePage"));
const UnauthorizedPage = lazy(() => import("./screens/UnauthorizedPage"));

function App() {
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
        <Route element={<ProtectedRoute />}>
          <Route path="/print" element={<PrintPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
