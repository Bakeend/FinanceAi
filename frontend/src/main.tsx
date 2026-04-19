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
import { UploadPage } from './pages/Upload';
import { TransactionsPage } from './pages/Transactions';
import { NewTransactionPage } from './pages/NewTransaction';
import { GoalsPage } from './pages/Goals';
import { ComparePage } from './pages/Compare';
import { InsightsPage } from './pages/Insights';
import { ChatPage } from './pages/Chat';
import { AccountsPage } from './pages/Accounts';
import { RemindersPage } from './pages/Reminders';
import { BudgetsPage } from './pages/Budgets';
import { RulesPage } from './pages/Rules';
import { ReportsPage } from './pages/Reports';
import { TripsPage } from './pages/Trips';
import { PastePage } from './pages/Paste';
import { InvestmentsPage } from './pages/Investments';
import { bindInstallPrompt } from './lib/pwa';
import './index.css';

bindInstallPrompt();

function AuthGate() {
  const { status, user, logout } = useAuth();

  useEffect(() => {
    const onExpired = () => { logout(); };
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, [logout]);

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
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="new" element={<NewTransactionPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="paste" element={<PastePage />} />
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </UndoProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
