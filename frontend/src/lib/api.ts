import type { Account, AccountTipo, AlertItem, AnomalyItem, BalancePoint, Budget, CashflowData, CategoryEvolution, ChatMessage, ForecastNext, Gamification, Goal, Invoice, MonthRef, PriceIncrease, RecurringItem, RecurringSuggestion, ReceiptExtracted, Reminder, Summary, TodaySummary, Transaction, TrendPoint, Trip, TxRule, UpcomingReminder, YearOverYear, YearlyProjection, YearlyReport } from './types';
import { enqueue } from './offlineQueue';

// Vazio = mesma origem (Vite faz proxy pros paths da API em dev, prod usa o mesmo host)
const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (() => { try { return localStorage.getItem('financeai-token'); } catch { return null; } })();
  const headers = new Headers(init?.headers ?? {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    try { localStorage.removeItem('financeai-token'); } catch {}
    if (typeof window !== 'undefined' && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  uploadFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<{ count: number; skipped: number; transactions: Transaction[]; aiWarning: string | null }>('/transactions/upload', { method: 'POST', body: fd });
  },
  listTransactions: (mes: number, ano: number) =>
    http<Transaction[]>(`/transactions?mes=${mes}&ano=${ano}`),
  listFiltered: (params: { mes?: number; ano?: number; categoria?: string; q?: string; tipo?: 'entrada' | 'gasto' | 'all'; accountId?: string }) => {
    const qs = new URLSearchParams();
    if (params.mes) qs.set('mes', String(params.mes));
    if (params.ano) qs.set('ano', String(params.ano));
    if (params.categoria) qs.set('categoria', params.categoria);
    if (params.q) qs.set('q', params.q);
    if (params.tipo && params.tipo !== 'all') qs.set('tipo', params.tipo);
    if (params.accountId) qs.set('accountId', params.accountId);
    const qstr = qs.toString();
    return http<Transaction[]>(`/transactions${qstr ? `?${qstr}` : ''}`);
  },
  createManual: async (data: { data: string; descricao: string; valor: number; categoria?: string; installments?: number; accountId?: string; isRecurring?: boolean; currency?: string; originalAmount?: number | null }) => {
    if (!navigator.onLine) {
      await enqueue(data as Record<string, unknown>);
      return { saved: null, skipped: 0, queued: true } as any;
    }
    return http<{ saved: Transaction | null; skipped: number }>('/transactions/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  flushQueue: async (): Promise<{ synced: number; failed: number }> => {
    const { getAll, remove } = await import('./offlineQueue');
    const items = await getAll();
    let synced = 0;
    let failed = 0;
    for (const { key, item } of items) {
      try {
        await http<unknown>('/transactions/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });
        await remove(key);
        synced++;
      } catch {
        failed++;
      }
    }
    return { synced, failed };
  },
  updateCategoria: (id: string, categoria: string) =>
    http<Transaction>(`/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoria }) }),
  updateTransaction: (
    id: string,
    patch: Partial<Pick<Transaction, 'data' | 'descricao' | 'valor' | 'categoria' | 'accountId'>> & { applyToInstallments?: boolean; attachment?: string | null },
  ) =>
    http<Transaction>(`/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  splitTransaction: (id: string, items: { valor: number; categoria: string; descricao?: string }[]) =>
    http<{ ok: boolean; children: Transaction[] }>(`/transactions/${id}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }),

  // Accounts
  listAccounts: () => http<Account[]>('/accounts'),
  createAccount: (a: { nome: string; tipo: AccountTipo; cor?: string; banco?: string; closingDay?: number; dueDay?: number; limite?: number }) =>
    http<Account>('/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }),
  updateAccount: (id: string, patch: { nome?: string; cor?: string; banco?: string | null; closingDay?: number | null; dueDay?: number | null; limite?: number | null }) =>
    http<Account>(`/accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  deleteAccount: (id: string) => http<{ ok: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),
  findOrCreateAccount: (nome: string) => http<{ account: Account; created: boolean }>('/accounts/find-or-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) }),
  accountInvoice: (id: string) => http<Invoice>(`/accounts/${id}/invoice`),
  transfer: (payload: { data: string; valor: number; fromAccountId: string; toAccountId: string; descricao?: string }) =>
    http<{ saved: Transaction[] }>('/transactions/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  ocrReceipt: (imageDataUrl: string) =>
    http<ReceiptExtracted>('/transactions/ocr-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl }),
    }),
  uploadReceipt: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<{ item: { data: string; descricao: string; valor: number; categoria: string; attachment: string }; aiWarning: string | null }>(
      '/transactions/upload-receipt',
      { method: 'POST', body: fd },
    );
  },

  // Budgets
  listBudgets: (mes: number, ano: number) => http<Budget[]>(`/budgets?mes=${mes}&ano=${ano}`),
  createBudget: (b: { categoria: string; mes: number; ano: number; valor: number }) =>
    http<Budget>('/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }),
  updateBudget: (id: string, patch: { valor?: number; categoria?: string }) =>
    http<Budget>(`/budgets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  deleteBudget: (id: string) => http<{ ok: boolean }>(`/budgets/${id}`, { method: 'DELETE' }),
  copyPreviousBudget: (mes: number, ano: number) =>
    http<{ copied: number }>('/budgets/copy-previous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, ano }),
    }),

  // Rules
  listRules: () => http<TxRule[]>('/rules'),
  createRule: (r: { pattern: string; categoria: string; priority?: number; active?: boolean }) =>
    http<TxRule>('/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }),
  updateRule: (id: string, patch: Partial<Pick<TxRule, 'pattern' | 'categoria' | 'priority' | 'active'>>) =>
    http<TxRule>(`/rules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  deleteRule: (id: string) => http<{ ok: boolean }>(`/rules/${id}`, { method: 'DELETE' }),
  applyRules: () => http<{ updated: number }>('/rules/apply', { method: 'POST' }),
  deleteTransaction: (id: string) =>
    http<{ ok: boolean }>(`/transactions/${id}`, { method: 'DELETE' }),
  recategorize: (ref?: { mes: number; ano: number }) =>
    http<{ updated: number; total?: number }>('/transactions/recategorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ref ?? {}),
    }),
  summary: (mes: number, ano: number) =>
    http<Summary>(`/dashboard/summary?mes=${mes}&ano=${ano}`),
  months: () => http<MonthRef[]>('/dashboard/months'),
  analyze: (mes: number, ano: number) =>
    http<{ texto: string }>('/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mes, ano }) }),
  forecast: (mes: number, ano: number) =>
    http<{ texto: string; valorEstimado: number | null }>('/ai/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mes, ano }) }),
  chat: (mensagem: string, historico: { role: 'user' | 'assistant'; content: string }[], ref?: { mes: number; ano: number }) =>
    http<{ resposta: string }>('/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem, historico, ...(ref ? { mes: ref.mes, ano: ref.ano } : {}) }),
    }),
  chatHistory: () => http<ChatMessage[]>('/ai/chat/history'),
  clearChatHistory: () => http<{ ok: boolean }>('/ai/chat/history', { method: 'DELETE' }),

  // Goals
  listGoals: (mes: number, ano: number) => http<Goal[]>(`/goals?mes=${mes}&ano=${ano}`),
  createGoal: (g: { categoria: string; valor: number; mes: number; ano: number; tipo?: 'limite' | 'poupanca' }) =>
    http<Goal>('/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g) }),
  updateGoal: (id: string, patch: { valor?: number; categoria?: string; tipo?: 'limite' | 'poupanca' }) =>
    http<Goal>(`/goals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  deleteGoal: (id: string) => http<{ ok: boolean }>(`/goals/${id}`, { method: 'DELETE' }),

  // Dashboard extras
  trend: (mes: number, ano: number) => http<TrendPoint[]>(`/dashboard/trend?mes=${mes}&ano=${ano}`),
  alerts: (mes: number, ano: number) => http<AlertItem[]>(`/dashboard/alerts?mes=${mes}&ano=${ano}`),
  recurring: () => http<RecurringItem[]>('/dashboard/recurring'),
  balanceTimeline: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const qstr = qs.toString();
    return http<BalancePoint[]>(`/dashboard/balance-timeline${qstr ? `?${qstr}` : ''}`);
  },
  cashflow: (mes: number, ano: number) =>
    http<CashflowData>(`/dashboard/cashflow?mes=${mes}&ano=${ano}`),
  anomalies: (mes: number, ano: number) =>
    http<AnomalyItem[]>(`/dashboard/anomalies?mes=${mes}&ano=${ano}`),
  yearlyProjection: (mes: number, ano: number) =>
    http<YearlyProjection>(`/dashboard/yearly-projection?mes=${mes}&ano=${ano}`),
  todaySummary: () => http<TodaySummary>('/dashboard/today'),
  yearlyReport: (ano: number) => http<YearlyReport>(`/dashboard/yearly?ano=${ano}`),
  categoryEvolution: (mes: number, ano: number, months = 12) =>
    http<CategoryEvolution>(`/dashboard/category-evolution?mes=${mes}&ano=${ano}&months=${months}`),
  recurringSuggestions: () => http<RecurringSuggestion[]>('/dashboard/recurring-suggestions'),
  yearOverYear: (mes: number, ano: number, years = 3) =>
    http<YearOverYear[]>(`/dashboard/year-over-year?mes=${mes}&ano=${ano}&years=${years}`),
  priceIncreases: () => http<PriceIncrease[]>('/dashboard/price-increases'),
  subscriptions: () => http<{ assinaturas: { descricao: string; categoria: string; mediaMensal: number; totalAnualEstimado: number; mesesDetectados: number }[]; totalMensal: number }>('/dashboard/subscriptions'),
  gamification: () => http<Gamification>('/dashboard/gamification'),
  forecastNext: (mes: number, ano: number) =>
    http<ForecastNext>(`/dashboard/forecast-next?mes=${mes}&ano=${ano}`),

  // Trips
  listTrips: () => http<Trip[]>('/trips'),
  activeTrip: () => http<Trip | null>('/trips/active-today'),
  createTrip: (t: { nome: string; inicio: string; fim: string; orcamento?: number; cor?: string }) =>
    http<Trip>('/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) }),
  updateTrip: (id: string, patch: Partial<{ nome: string; inicio: string; fim: string; orcamento: number | null; cor: string }>) =>
    http<Trip>(`/trips/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  deleteTrip: (id: string) => http<{ ok: boolean }>(`/trips/${id}`, { method: 'DELETE' }),

  // OCR & paste
  ocrScreenshot: (imageDataUrl: string) =>
    http<{ items: { data: string; descricao: string; valor: number; categoria: string }[] }>('/transactions/ocr-screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl }),
    }),
  pasteText: (text: string) =>
    http<{ items: { data: string; descricao: string; valor: number; categoria: string }[] }>('/transactions/paste-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),

  // Backup / Restore
  backupUrl: () => `${BASE}/backup`,
  restoreBackup: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<{ ok: boolean; message: string }>('/backup/restore', { method: 'POST', body: fd });
  },

  // Excel export
  exportXlsUrl: () => `${BASE}/transactions/export-xls`,

  // Auth
  authStatus: () => http<{ hasUsers: boolean }>('/auth/status'),
  authSignup: (payload: { username: string; password: string; pin?: string }) =>
    http<{ token: string; user: { id: string; username: string; hasPin: boolean } }>('/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  authLogin: (payload: { username: string; password: string }) =>
    http<{ token: string; user: { id: string; username: string; hasPin: boolean } }>('/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  authPinLogin: (payload: { username: string; pin: string }) =>
    http<{ token: string; user: { id: string; username: string; hasPin: boolean } }>('/auth/pin-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  authMe: () => http<{ id: string; username: string; hasPin: boolean; createdAt: string }>('/auth/me'),
  authChangePassword: (payload: { currentPassword: string; newPassword: string }) =>
    http<{ ok: boolean }>('/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  authSetPin: (payload: { password: string; pin: string }) =>
    http<{ ok: boolean }>('/auth/set-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  authRemovePin: () => http<{ ok: boolean }>('/auth/remove-pin', { method: 'POST' }),
  authLogoutAll: () => http<{ ok: boolean }>('/auth/logout-all', { method: 'POST' }),

  // Upload preview + confirm
  previewFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<{ items: { data: string; descricao: string; valor: number; categoria: string }[]; aiWarning: string | null }>('/transactions/preview', { method: 'POST', body: fd });
  },
  confirmUpload: (items: { data: string; descricao: string; valor: number; categoria?: string; attachment?: string }[]) =>
    http<{ count: number; skipped: number; transactions: Transaction[] }>('/transactions/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }),

  // Export
  exportUrl: () => `${BASE}/transactions/export`,

  // Tags
  updateTags: (id: string, tags: string[]) =>
    http<Transaction>(`/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) }),
  suggestTags: (id: string) =>
    http<{ tags: string[] }>(`/transactions/${id}/tag-suggestions`),

  // Bulk
  bulkUpdate: (ids: string[], patch: { categoria?: string; tags?: string[]; isTransfer?: boolean }) =>
    http<{ updated: number }>('/transactions/bulk/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ...patch }),
    }),
  bulkDelete: (ids: string[]) =>
    http<{ removed: number }>('/transactions/bulk/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),

  processRecurring: () =>
    http<{ created: number }>('/transactions/process-recurring', { method: 'POST' }),

  transactionHistory: (id: string) =>
    http<{ edits: { id: string; field: string; beforeValue: string | null; afterValue: string | null; createdAt: string }[] }>(
      `/transactions/${id}/history`,
    ),

  // AI memory
  getAiMemory: () => http<{ content: string }>('/ai/memory'),
  setAiMemory: (content: string) =>
    http<{ content: string }>('/ai/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),

  // Natural language
  parseTx: (text: string) =>
    http<{ data: string; descricao: string; valor: number; categoria: string; conta?: string } | { error: string }>('/ai/parse-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  aiSearch: (text: string) =>
    http<{
      filters: { mes?: number; ano?: number; categoria?: string; q?: string; tipo?: 'entrada' | 'gasto' | 'all'; from?: string; to?: string; resumo?: string };
      items: Transaction[];
      total: number;
      count: number;
    }>('/ai/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }),

  // Reminders
  listReminders: () => http<Reminder[]>('/reminders'),
  upcomingReminders: () => http<UpcomingReminder[]>('/reminders/upcoming'),
  createReminder: (r: { descricao: string; valor: number; dia: number; categoria?: string; accountId?: string | null; active?: boolean }) =>
    http<Reminder>('/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }),
  updateReminder: (id: string, patch: Partial<{ descricao: string; valor: number; dia: number; categoria: string; accountId: string | null; active: boolean }>) =>
    http<Reminder>(`/reminders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  deleteReminder: (id: string) => http<{ ok: boolean }>(`/reminders/${id}`, { method: 'DELETE' }),
  markReminderPaid: (id: string) =>
    http<Reminder>(`/reminders/${id}/paid`, { method: 'POST' }),
};

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 503) return 'A Luna tá ocupada demais no momento. Tenta de novo em alguns minutos.';
    if (e.status === 500 && e.message.includes('API key')) return e.message;
    return e.message;
  }
  return 'Erro de conexão com o backend (porta 3001).';
}
