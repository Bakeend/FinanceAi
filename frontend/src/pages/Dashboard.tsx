import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Sparkles, Loader2, FileDown, Wand2, ChevronDown, BarChart3, Zap, ListChecks } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import { SummaryCards } from '../components/SummaryCards';
import { ExtraStats } from '../components/ExtraStats';
import { SpendingHeatmap } from '../components/SpendingHeatmap';
import { SavingsGoalWidget } from '../components/SavingsGoalWidget';
import { AchievementsCard } from '../components/AchievementsCard';
import { LunaDailyCheckin } from '../components/LunaDailyCheckin';
import { VoiceInput } from '../components/VoiceInput';
import { CategoryChart } from '../components/CategoryChart';
import { CategoryPie } from '../components/CategoryPie';
import { DailyChart } from '../components/DailyChart';
import { TrendChart } from '../components/TrendChart';
import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { CashflowWaterfall } from '../components/CashflowWaterfall';
import { BalanceTimelineChart } from '../components/BalanceTimelineChart';
import { GoalsProgress } from '../components/GoalsProgress';
import { DailyBudget } from '../components/DailyBudget';
import { RecurringList } from '../components/RecurringList';
import { TodayWidget } from '../components/TodayWidget';
import { GamificationCard } from '../components/GamificationCard';
import { TransactionList } from '../components/TransactionList';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { NotificationsBell } from '../components/NotificationsBell';
import { generateMonthlyReportPdf, downloadBlob } from '../lib/pdf';
import { useAuth } from '../lib/auth';
import type { Summary, Transaction, MonthRef, Goal } from '../lib/types';

const WELCOME_SESSION_KEY = 'financeai-welcome-shown';
const WELCOME_PREF_KEY = 'financeai-welcome-enabled';

/* ── Collapsible Section ── */
function Section({
  id,
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const storageKey = `dash-section-${id}`;
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? saved === '1' : defaultOpen;
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(storageKey, next ? '1' : '0');
  };

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-card-hover/30 transition-colors group"
      >
        <span className="text-accent">{icon}</span>
        <span className="text-sm font-semibold text-slate-200 flex-1">{title}</span>
        {badge && (
          <span className="text-[10px] font-medium bg-accent/15 text-accent px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 flex flex-col gap-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DashboardPage() {
  const today = new Date();
  const location = useLocation();
  const fromUpload = location.state as MonthRef | null;
  const [ref, setRef] = useState<MonthRef>(fromUpload ?? { mes: today.getMonth() + 1, ano: today.getFullYear() });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [list, setList] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recategorizing, setRecategorizing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nlText, setNlText] = useState('');
  const [nlBusy, setNlBusy] = useState(false);
  const [nlOpen, setNlOpen] = useState(false);
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    const enabled = localStorage.getItem(WELCOME_PREF_KEY) !== 'false';
    const alreadyShown = sessionStorage.getItem(WELCOME_SESSION_KEY) === '1';
    const tourDone = localStorage.getItem('financeai-luna-tour-done') === '1';
    return enabled && !alreadyShown && tourDone;
  });

  useEffect(() => {
    const onTourDone = () => {
      const enabled = localStorage.getItem(WELCOME_PREF_KEY) !== 'false';
      const alreadyShown = sessionStorage.getItem(WELCOME_SESSION_KEY) === '1';
      if (enabled && !alreadyShown) setShowWelcome(true);
    };
    window.addEventListener('financeai:luna-tour-done', onTourDone);
    return () => window.removeEventListener('financeai:luna-tour-done', onTourDone);
  }, []);

  const load = () => {
    setError(null);
    setLoading(true);
    Promise.all([
      api.summary(ref.mes, ref.ano),
      api.listTransactions(ref.mes, ref.ano),
      api.listGoals(ref.mes, ref.ano),
    ])
      .then(([s, l, g]) => {
        setSummary(s);
        setList(l);
        setGoals(g);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [ref.mes, ref.ano]);

  useEffect(() => {
    api.processRecurring().catch(() => {});
  }, []);

  const downloadPdf = () => {
    if (!summary) return;
    const blob = generateMonthlyReportPdf({ summary, items: list, mes: ref.mes, ano: ref.ano });
    downloadBlob(blob, `financeai-${ref.ano}-${String(ref.mes).padStart(2, '0')}.pdf`);
  };

  const quickAdd = async () => {
    const text = nlText.trim();
    if (!text) return;
    setNlBusy(true);
    setError(null);
    try {
      const r = await api.parseTx(text);
      if ('error' in r) { setError(r.error); return; }
      let accountId: string | undefined;
      let accountCreatedMsg = '';
      if (r.conta) {
        const { account, created } = await api.findOrCreateAccount(r.conta);
        accountId = account.id;
        if (created) accountCreatedMsg = ` · Conta "${account.nome}" criada`;
      } else {
        const accounts = await api.listAccounts();
        const def = accounts.find((a: any) => a.isDefault) ?? accounts[0];
        if (def) accountId = def.id;
      }
      await api.createManual({
        data: r.data,
        descricao: r.descricao,
        valor: r.valor,
        categoria: r.categoria,
        ...(accountId ? { accountId } : {}),
      });
      setNlText('');
      setNlOpen(false);
      setToast(`✓ "${r.descricao}" adicionado${accountCreatedMsg}`);
      setTimeout(() => setToast(null), 4000);
      load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setNlBusy(false);
    }
  };

  const recategorize = async () => {
    setRecategorizing(true);
    setError(null);
    try {
      const r = await api.recategorize(ref);
      setToast(`${r.updated} transação(ões) recategorizada(s)`);
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRecategorizing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {showWelcome && (
        <WelcomeScreen
          name={user?.username ?? 'você'}
          onPick={(mode) => {
            sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
            setShowWelcome(false);
            if (mode === 'today') {
              let tries = 0;
              const scroll = () => {
                const el = document.querySelector('[data-today-widget]') as HTMLElement | null;
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  el.animate(
                    [
                      { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0)' },
                      { boxShadow: '0 0 0 4px rgba(139, 92, 246, 0.45)' },
                      { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0)' },
                    ],
                    { duration: 1200, easing: 'ease-out' },
                  );
                } else if (tries++ < 10) {
                  setTimeout(scroll, 150);
                }
              };
              setTimeout(scroll, 250);
            } else {
              window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            }
          }}
        />
      )}

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Olá, <span className="gradient-text">{user?.username ?? 'você'}</span>
          </h2>
          <p className="text-muted text-sm mt-1">Visão geral das suas movimentações</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2 md:mx-0 md:px-0">
          <NotificationsBell mes={ref.mes} ano={ref.ano} summary={summary} items={list} />
          <button
            onClick={downloadPdf}
            disabled={!summary || list.length === 0}
            title="Baixar relatório do mês em PDF"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-card-hover text-sm text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown className="w-4 h-4 text-accent" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={() => setNlOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              nlOpen
                ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                : 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
            }`}
            title="Adicionar transação por texto"
          >
            <Wand2 className="w-4 h-4" />
            <span className="hidden sm:inline">Pedir pra Luna</span>
          </button>
          <button
            onClick={recategorize}
            disabled={recategorizing || list.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-medium hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Pedir pra Luna recategorizar este mês"
          >
            {recategorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="hidden sm:inline">{recategorizing ? 'Categorizando…' : 'Recategorizar'}</span>
          </button>
          <MonthSelector value={ref} onChange={setRef} />
        </div>
      </motion.div>

      {/* ── Toast ── */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 text-sm text-emerald-200"
        >
          {toast}
        </motion.div>
      )}

      {/* ── NL Quick-add ── */}
      {nlOpen && (
        <motion.div
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-4"
        >
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg-soft border border-border rounded-xl pl-3 pr-2 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20">
              <input
                autoFocus
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); if (e.key === 'Escape') setNlOpen(false); }}
                placeholder='ex: "gastei 50 no almoço hoje" ou "recebi 3000 de salário dia 5"'
                className="flex-1 bg-transparent py-2 text-sm text-slate-100 placeholder:text-muted outline-none"
              />
              <VoiceInput
                onTranscript={(t) => setNlText(t)}
                onAutoSubmit={(t) => { setNlText(t); setTimeout(quickAdd, 0); }}
                size="sm"
              />
            </div>
            <button
              onClick={quickAdd}
              disabled={nlBusy || !nlText.trim()}
              className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50 shadow-[0_0_30px_-10px_rgba(167,139,250,0.6)]"
            >
              <Sparkles className="w-4 h-4" />
              {nlBusy ? 'Lendo…' : 'Preencher'}
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Error ── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-3 rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* ═══════════════ ALWAYS VISIBLE: Summary Cards ═══════════════ */}
      {loading && !summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : summary ? (
        <SummaryCards data={summary} items={list} mes={ref.mes} ano={ref.ano} />
      ) : null}

      {/* ═══════════════ ALWAYS VISIBLE: Budget + Today ═══════════════ */}
      {summary && <DailyBudget summary={summary} goals={goals} mes={ref.mes} ano={ref.ano} />}
      <div data-today-widget><TodayWidget /></div>


      {/* ═══════════════ SECTION: Luna & Insights ═══════════════ */}
      <Section id="insights" title="Luna e Insights" icon={<Zap className="w-4 h-4" />} defaultOpen={false}>
        <LunaDailyCheckin summary={summary} items={list} mes={ref.mes} ano={ref.ano} />
        <GamificationCard />
        {summary && list.length > 0 && <ExtraStats summary={summary} items={list} mes={ref.mes} ano={ref.ano} />}
        {summary && <SavingsGoalWidget summary={summary} />}
        {summary && list.length > 0 && (
          <AchievementsCard items={list} summary={summary} mes={ref.mes} ano={ref.ano} />
        )}
        <GoalsProgress mes={ref.mes} ano={ref.ano} />
      </Section>

      {/* ═══════════════ SECTION: Gráficos ═══════════════ */}
      {list.length > 0 && (
        <Section id="charts" title="Gráficos e Análises" icon={<BarChart3 className="w-4 h-4" />} defaultOpen={false} badge={`${list.length} transações`}>
          {list.length > 0 && <SpendingHeatmap items={list} mes={ref.mes} ano={ref.ano} />}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {summary && summary.porCategoria.length > 0 && <CategoryChart data={summary.porCategoria} />}
            {summary && summary.porCategoria.length > 0 && <CategoryPie data={summary.porCategoria} />}
            <DailyChart items={list} mes={ref.mes} ano={ref.ano} />
            <TrendChart mes={ref.mes} ano={ref.ano} />
            <CalendarHeatmap items={list} mes={ref.mes} ano={ref.ano} />
          </div>
          <CashflowWaterfall mes={ref.mes} ano={ref.ano} />
          <BalanceTimelineChart />
        </Section>
      )}

      {/* ═══════════════ SECTION: Detalhamento ═══════════════ */}
      <Section id="details" title="Transações e Recorrentes" icon={<ListChecks className="w-4 h-4" />} defaultOpen={true} badge={list.length > 0 ? `${list.length}` : undefined}>
        <RecurringList />
        <TransactionList items={list} onChange={load} />
      </Section>
    </div>
  );
}
