import { parseCurrency } from '../lib/utils';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, AlertCircle, Copy, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import { CategoryChip } from '../components/CategoryChip';
import { CATEGORIAS, CATEGORY_META } from '../lib/categories';
import type { Budget, MonthRef } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function BudgetsPage() {
  const today = new Date();
  const [ref, setRef] = useState<MonthRef>({ mes: today.getMonth() + 1, ano: today.getFullYear() });
  const [items, setItems] = useState<Budget[]>([]);
  const [newCat, setNewCat] = useState('Alimentação');
  const [newValor, setNewValor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.listBudgets(ref.mes, ref.ano).then(setItems).catch((e) => setError(friendlyError(e))).finally(() => setLoading(false));
  };
  useEffect(load, [ref.mes, ref.ano]);

  const add = async () => {
    setError(null);
    const v = parseCurrency(newValor);
    if (Number.isNaN(v) || v <= 0) return setError('Valor inválido');
    if (items.some((b) => b.categoria === newCat)) return setError('Já existe orçamento para essa categoria neste mês.');
    setBusy(true);
    try {
      await api.createBudget({ categoria: newCat, valor: v, mes: ref.mes, ano: ref.ano });
      setNewValor('');
      load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esse orçamento?')) return;
    await api.deleteBudget(id);
    load();
  };

  const copyPrev = async () => {
    setBusy(true);
    try {
      const { copied } = await api.copyPreviousBudget(ref.mes, ref.ano);
      if (!copied) setError('Nenhum orçamento novo para copiar do mês anterior.');
      load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const totalLimite = items.reduce((s, b) => s + b.valor, 0);
  const totalGasto = items.reduce((s, b) => s + b.gasto, 0);
  const pct = totalLimite > 0 ? (totalGasto / totalLimite) * 100 : 0;

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Orçamento <span className="gradient-text">mensal</span>
          </h2>
          <p className="text-muted text-sm mt-1">Defina limites por categoria e acompanhe em tempo real</p>
        </div>
        <MonthSelector value={ref} onChange={setRef} />
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-200">Total do mês</h3>
            <span className="text-xs text-muted">{items.length} {items.length === 1 ? 'orçamento' : 'orçamentos'}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tabular-nums ${pct > 100 ? 'text-rose-300' : pct >= 80 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {fmt(totalGasto)}
            </span>
            <span className="text-sm text-muted">de {fmt(totalLimite)}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-card-hover/50 overflow-hidden">
            <div
              className={`h-full transition-all ${pct > 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Adicionar orçamento</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
          >
            {CATEGORIAS.filter((c) => !['Salário', 'Renda extra', 'Transferência'].includes(c)).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={newValor}
            onChange={(e) => setNewValor(e.target.value)}
            className="flex-1 bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={add}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={copyPrev}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm disabled:opacity-50"
            title="Copiar orçamentos do mês anterior"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Copiar do mês anterior</span>
          </motion.button>
        </div>
      </motion.div>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted">Nenhum orçamento para este mês. Adicione um acima ou copie do anterior.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map((b, idx) => (
              <BudgetRow key={b.id} b={b} idx={idx} onRemove={() => remove(b.id)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function BudgetRow({ b, idx, onRemove }: { b: Budget; idx: number; onRemove: () => void }) {
  const meta = CATEGORY_META[b.categoria] ?? CATEGORY_META['Outros'];
  const pct = Math.min(100, b.percentual);
  const overflow = b.percentual > 100;
  const barColor =
    b.status === 'estourado' ? 'bg-rose-500' : b.status === 'alerta' ? 'bg-amber-500' : 'bg-emerald-500';
  const StatusIcon = b.status === 'estourado' ? AlertTriangle : b.status === 'alerta' ? TrendingDown : CheckCircle2;
  const statusColor = b.status === 'estourado' ? 'text-rose-300' : b.status === 'alerta' ? 'text-amber-300' : 'text-emerald-300';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ delay: idx * 0.03 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <CategoryChip categoria={b.categoria} />
          <div className={`inline-flex items-center gap-1 text-xs ${statusColor}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            <span className="font-medium">{Math.round(b.percentual)}%</span>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-muted hover:text-rose-300 p-1"
          aria-label="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-sm tabular-nums">
          <span className={meta.color}>{fmt(b.gasto)}</span>
          <span className="text-muted"> / {fmt(b.valor)}</span>
        </span>
        <span className={`text-xs tabular-nums ${b.restante < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
          {b.restante < 0 ? `-${fmt(-b.restante)}` : fmt(b.restante)} restante
        </span>
      </div>
      <div className="h-2 rounded-full bg-card-hover/50 overflow-hidden">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
        {overflow && (
          <div className="h-full bg-rose-900/40" style={{ marginTop: '-0.5rem', width: `${Math.min(100, b.percentual - 100)}%`, marginLeft: '100%' }} />
        )}
      </div>
      <p className={`text-xs mt-2 ${statusColor}`}>{b.mensagem}</p>
    </motion.div>
  );
}
