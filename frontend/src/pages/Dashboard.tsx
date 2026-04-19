import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Sparkles, Loader2, FileDown, Wand2 } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import { SummaryCards } from '../components/SummaryCards';
import { ExtraStats } from '../components/ExtraStats';
import { CategoryChart } from '../components/CategoryChart';
import { CategoryPie } from '../components/CategoryPie';
import { DailyChart } from '../components/DailyChart';
import { TrendChart } from '../components/TrendChart';
import { AlertsBanner } from '../components/AlertsBanner';
import { AnomaliesBanner } from '../components/AnomaliesBanner';
import { UpcomingReminders } from '../components/UpcomingReminders';
import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { CashflowWaterfall } from '../components/CashflowWaterfall';
import { BalanceTimelineChart } from '../components/BalanceTimelineChart';
import { GoalsProgress } from '../components/GoalsProgress';
import { DailyBudget } from '../components/DailyBudget';
import { RecurringList } from '../components/RecurringList';
import { TodayWidget } from '../components/TodayWidget';
import { GamificationCard } from '../components/GamificationCard';
import { PriceIncreaseBanner } from '../components/PriceIncreaseBanner';
import { TransactionList } from '../components/TransactionList';
import { generateMonthlyReportPdf, downloadBlob } from '../lib/pdf';
import type { Summary, Transaction, MonthRef, Goal } from '../lib/types';

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
      const accounts = await api.listAccounts();
      const def = accounts.find((a) => a.isDefault) ?? accounts[0];
      await api.createManual({
        data: r.data,
        descricao: r.descricao,
        valor: r.valor,
        categoria: r.categoria,
        ...(def ? { accountId: def.id } : {}),
      });
      setNlText('');
      setNlOpen(false);
      setToast(`✓ "${r.descricao}" adicionado`);
      setTimeout(() => setToast(null), 3000);
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
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Olá, <span className="gradient-text">Bakeend</span>
          </h2>
          <p className="text-muted text-sm mt-1">Visão geral das suas movimentações</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            <span className="hidden sm:inline">Descrever</span>
          </button>
          <button
            onClick={recategorize}
            disabled={recategorizing || list.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-medium hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Rerrodar categorização IA neste mês"
          >
            {recategorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="hidden sm:inline">{recategorizing ? 'Categorizando…' : 'Recategorizar'}</span>
          </button>
          <MonthSelector value={ref} onChange={setRef} />
        </div>
      </motion.div>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 text-sm text-emerald-200"
        >
          {toast}
        </motion.div>
      )}

      {nlOpen && (
        <motion.div
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-4"
        >
          <div className="flex gap-2">
            <input
              autoFocus
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); if (e.key === 'Escape') setNlOpen(false); }}
              placeholder='ex: "gastei 50 no almoço hoje" ou "recebi 3000 de salário dia 5"'
              className="flex-1 bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-muted focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
            />
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

      {loading && !summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : summary ? (
        <SummaryCards data={summary} items={list} mes={ref.mes} ano={ref.ano} />
      ) : null}

      <TodayWidget />

      <GamificationCard />

      <PriceIncreaseBanner />

      <AlertsBanner mes={ref.mes} ano={ref.ano} />

      <UpcomingReminders />

      <AnomaliesBanner mes={ref.mes} ano={ref.ano} />

      {summary && <DailyBudget summary={summary} goals={goals} mes={ref.mes} ano={ref.ano} />}

      {summary && list.length > 0 && <ExtraStats summary={summary} items={list} mes={ref.mes} ano={ref.ano} />}

      <GoalsProgress mes={ref.mes} ano={ref.ano} />

      {list.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {summary && summary.porCategoria.length > 0 && <CategoryChart data={summary.porCategoria} />}
          {summary && summary.porCategoria.length > 0 && <CategoryPie data={summary.porCategoria} />}
          <DailyChart items={list} mes={ref.mes} ano={ref.ano} />
          <TrendChart mes={ref.mes} ano={ref.ano} />
          <CalendarHeatmap items={list} mes={ref.mes} ano={ref.ano} />
        </div>
      )}

      {list.length > 0 && <CashflowWaterfall mes={ref.mes} ano={ref.ano} />}

      <BalanceTimelineChart />

      <RecurringList />

      <TransactionList items={list} onChange={load} />
    </div>
  );
}
