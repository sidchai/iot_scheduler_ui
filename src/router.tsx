import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import AppsPage from '@/pages/Apps';
import JobsPage from '@/pages/Jobs';
import AlertRulesPage from '@/pages/AlertRules';
import AlertChannelsPage from '@/pages/AlertChannels';
import AlertBindingsPage from '@/pages/AlertBindings';
import AlertEventsPage from '@/pages/AlertEvents';
import AuditPage from '@/pages/Audit';
import PendingChangesPage from '@/pages/PendingChanges';
import RunsPage from '@/pages/Runs';
import WorkersPage from '@/pages/Workers';
import UsersPage from '@/pages/Users';
import { useAuthStore } from '@/stores/auth';
import type { JSX } from 'react';

/**
 * ProtectedRoute：未登录用户访问受保护路由时跳转 /login，并把当前路径写入 location.state.from，
 * 登录成功后回到原路径。
 */
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  const location = useLocation();
  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'apps', element: <AppsPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'runs', element: <RunsPage /> },
      { path: 'workers', element: <WorkersPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'alerts/rules', element: <AlertRulesPage /> },
      { path: 'alerts/channels', element: <AlertChannelsPage /> },
      { path: 'alerts/bindings', element: <AlertBindingsPage /> },
      { path: 'alerts/events', element: <AlertEventsPage /> },
      { path: 'pending-changes', element: <PendingChangesPage /> },
      { path: 'audit', element: <AuditPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
