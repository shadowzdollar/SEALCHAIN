import { StrictMode, lazy, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AuthProvider, useAuth } from './auth';
import { AppLayout } from './components/Layout';
import { PageLoader } from './components/ui';
import { Landing } from './pages/Landing';
import { AcceptInvite, ForgotPassword, Login, Register, ResetPassword, SignupComplete } from './pages/Auth';
import { Team } from './pages/Team';
import { SharedBundle } from './pages/SharedBundle';
import { Authority } from './pages/Authority';
import { Dashboard } from './pages/Dashboard';
import { Shipments } from './pages/Shipments';
import { ShipmentEditor } from './pages/ShipmentEditor';
import { ShipmentView } from './pages/ShipmentView';
import { Verify } from './pages/Verify';
import { Check } from './pages/Check';
import { Parties } from './pages/Parties';
import { Billing } from './pages/Billing';

const Compliance = lazy(() => import('./pages/Compliance').then((m) => ({ default: m.Compliance })));

// Apply the saved theme before first paint.
try {
  const saved = localStorage.getItem('sc-theme');
  const dark = saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', !!dark);
} catch {
  /* ignore */
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

/** Authorities land on their review queue; businesses on the dashboard. */
function HomeForOrg() {
  const { me } = useAuth();
  return me?.org.kind === 'authority' ? <Navigate to="/app/authority" replace /> : <Dashboard />;
}

function Home() {
  const { me, loading } = useAuth();
  if (loading) return <PageLoader />;
  return me ? <Navigate to="/app" replace /> : <Landing />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/signup/complete" element={<SignupComplete />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/v/:id" element={<Verify />} />
            <Route path="/s/:token" element={<SharedBundle />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<HomeForOrg />} />
              <Route path="authority" element={<Authority />} />
              <Route path="shipments" element={<Shipments />} />
              <Route path="shipments/new" element={<ShipmentEditor />} />
              <Route path="shipments/:id" element={<ShipmentView />} />
              <Route path="shipments/:id/edit" element={<ShipmentEditor />} />
              <Route path="check" element={<Check />} />
              <Route path="parties" element={<Parties />} />
              <Route path="billing" element={<Billing />} />
              <Route path="team" element={<Team />} />
              <Route
                path="compliance"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Compliance />
                  </Suspense>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
