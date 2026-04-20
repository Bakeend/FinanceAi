import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { UndoProvider } from './lib/undo';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { ProfilePage } from './pages/Profile';
import { useEffect } from 'react';
import { DashboardPage } from './pages/Dashboard';
import { TransactionsPage } from './pages/Transactions';
import { ChatPage } from './pages/Chat';
import { AdicionarPage } from './pages/Adicionar';
import { PatrimonioPage } from './pages/Patrimonio';
import { PlanejamentoPage } from './pages/Planejamento';
import { AnalisePage } from './pages/Analise';
import { StatusPage } from './pages/Status';
// keep old routes alive for direct links / shortcuts
import { NewTransactionPage } from './pages/NewTransaction';
import { UploadPage } from './pages/Upload';
import { PastePage } from './pages/Paste';
import { GoalsPage } from './pages/Goals';
import { RemindersPage } from './pages/Reminders';
import { ComparePage } from './pages/Compare';
import { InsightsPage } from './pages/Insights';
import { AccountsPage } from './pages/Accounts';
import { BudgetsPage } from './pages/Budgets';
import { RulesPage } from './pages/Rules';
import { ReportsPage } from './pages/Reports';
import { TripsPage } from './pages/Trips';
import { InvestmentsPage } from './pages/Investments';
import { bindInstallPrompt } from './lib/pwa';
import { api } from './lib/api';
import './index.css';

bindInstallPrompt();

function AuthGate() {
  const { status, user, logout } = useAuth();

  useEffect(() => {
    const onExpired = () => { logout(); };
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, [logout]);

  useEffect(() => {
    if (status !== 'auth') return;
    const flush = () => api.flushQueue().then(({ synced }) => {
      if (synced > 0) console.info(`[offline-sync] ${synced} transações sincronizadas`);
    }).catch(() => {});
    if (navigator.onLine) flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }
  if (status !== 'auth' || !user) return <LoginPage />;

  return (
    <UndoProvider>
      <Routes>
        <Route element={<Layout />}>
          {/* Main routes */}
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="adicionar" element={<AdicionarPage />} />
          <Route path="patrimonio" element={<PatrimonioPage />} />
          <Route path="planejamento" element={<PlanejamentoPage />} />
          <Route path="analise" element={<AnalisePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {/* Legacy routes — keep working */}
          <Route path="new" element={<NewTransactionPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="paste" element={<PastePage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="investments" element={<InvestmentsPage />} />
        </Route>
      </Routes>
    </UndoProvider>
  );
}

function Root() {
  return (
    <Routes>
      <Route path="/status" element={<StatusPage />} />
      <Route
        path="*"
        element={
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        }
      />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
