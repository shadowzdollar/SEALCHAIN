import { StrictMode, lazy, Suspense, type LazyExoticComponent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AuthProvider, useAuth } from './auth';
import { AppLayout } from './components/Layout';
import { PageLoader } from './components/ui';
import { Landing } from './pages/Landing';
import { MarketingLayout } from './marketing/Chrome';
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
import { Billing, PaymentReturn, SandboxCheckout } from './pages/Billing';
import { NotificationsPage } from './pages/Notifications';
import { Company } from './pages/Company';
import { Reports } from './pages/Reports';

const Compliance = lazy(() => import('./pages/Compliance').then((m) => ({ default: m.Compliance })));

// Public-site pages load on demand so the app bundle stays small.
const page = <K extends string>(load: () => Promise<Record<K, () => ReactNode>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const ProductPage = page(() => import('./marketing/pages/Product'), 'ProductPage');
const SolutionsPage = page(() => import('./marketing/pages/Solutions'), 'SolutionsPage');
const PricingPage = page(() => import('./marketing/pages/Pricing'), 'PricingPage');
const CorridorsPage = page(() => import('./marketing/pages/Corridors'), 'CorridorsPage');
const SecurityPage = page(() => import('./marketing/pages/Security'), 'SecurityPage');
const DevelopersPage = page(() => import('./marketing/pages/Developers'), 'DevelopersPage');
const ContactPage = page(() => import('./marketing/pages/Contact'), 'ContactPage');
const AboutPage = page(() => import('./marketing/pages/Company'), 'AboutPage');
const ChangelogPage = page(() => import('./marketing/pages/Company'), 'ChangelogPage');
const StatusPage = page(() => import('./marketing/pages/Company'), 'StatusPage');
const PrivacyPage = page(() => import('./marketing/pages/Company'), 'PrivacyPage');
const TermsPage = page(() => import('./marketing/pages/Company'), 'TermsPage');
const NotFoundPage = page(() => import('./marketing/pages/Company'), 'NotFoundPage');
const CreditsPage = page(() => import('./marketing/pages/Company'), 'CreditsPage');
const HelpIndex = page(() => import('./marketing/pages/Help'), 'HelpIndex');
const HelpArticle = page(() => import('./marketing/pages/Help'), 'HelpArticle');

const lazyEl = (C: LazyExoticComponent<() => ReactNode>) => (
  <Suspense fallback={<div className="min-h-[60vh]" />}>
    <C />
  </Suspense>
);

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
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/product" element={lazyEl(ProductPage)} />
              <Route path="/solutions" element={<Navigate to="/solutions/exporters" replace />} />
              <Route path="/solutions/:segment" element={lazyEl(SolutionsPage)} />
              <Route path="/pricing" element={lazyEl(PricingPage)} />
              <Route path="/corridors" element={lazyEl(CorridorsPage)} />
              <Route path="/security" element={lazyEl(SecurityPage)} />
              <Route path="/developers" element={lazyEl(DevelopersPage)} />
              <Route path="/about" element={lazyEl(AboutPage)} />
              <Route path="/contact" element={lazyEl(ContactPage)} />
              <Route path="/changelog" element={lazyEl(ChangelogPage)} />
              <Route path="/status" element={lazyEl(StatusPage)} />
              <Route path="/legal/privacy" element={lazyEl(PrivacyPage)} />
              <Route path="/legal/terms" element={lazyEl(TermsPage)} />
              <Route path="/credits" element={lazyEl(CreditsPage)} />
              <Route path="/help" element={lazyEl(HelpIndex)} />
              <Route path="/help/:slug" element={lazyEl(HelpArticle)} />
              <Route path="*" element={lazyEl(NotFoundPage)} />
            </Route>
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
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="company" element={<Company />} />
              <Route path="reports" element={<Reports />} />
              <Route path="billing" element={<Billing />} />
              <Route path="billing/sandbox/:id" element={<SandboxCheckout />} />
              <Route path="billing/return" element={<PaymentReturn />} />
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
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
