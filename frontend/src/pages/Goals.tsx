import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Trash2, AlertCircle, Wallet, PiggyBank } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import type { Goal, MonthRef } from '../lib/types';
import { CATEGORIAS } from '../lib/categories';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function GoalsPage() {
  const today = new Date();
  const [ref, setRef] = useState<MonthRef>({ mes: today.getMonth() + 1, ano: today.getFullYear() });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tipo, setTipo] = useState<'limite' | 'poupanca'>('limite');
  const [newCat, setNewCat] = useState('Alimentação');
  const [newValor, setNewValor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.listGoals(ref.mes, ref.ano).then(setGoals).catch((e) => setError(friendlyError(e)));
  };
  useEffect(load, [ref.mes, ref.ano]);

  const add = async () => {
    setError(null);
    const v = Number(newValor.replace(',', '.'));
    if (Number.isNaN(v) || v <= 0) return setError('Valor inválido');
    if (tipo === 'limite' && goals.some((g) => g.tipo === 'limite' && g.categoria === newCat)) {
      return setError('Já existe meta de limite para essa categoria');
    }
    setBusy(true);
    try {
      await api.createGoal({ categoria: newCat, valor: v, mes: ref.mes, ano: ref.ano, tipo });
      setNewValor('');
      load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta meta?')) return;
    await api.deleteGoal(id);
    load();
  };

  const limites = goals.filter((g) => g.tipo === 'limite');
  const poupancas = goals.filter((g) => g.tipo === 'poupanca');

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">Metas</span>
          </h2>
          <p className="text-muted text-sm mt-1">Limites de gasto e objetivos de poupança</p>
        </div>
        <MonthSelector value={ref} onChange={setRef} />
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Nova meta</h3>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setTipo('limite')}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-all ${
              tipo === 'limite' ? 'border-rose-500/50 bg-rose-500/10 text-rose-300' : 'border-border bg-bg-soft text-muted hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">Limite de gasto</span>
          </button>
          <button
            onClick={() => setTipo('poupanca')}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-all ${
              tipo === 'poupanca' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-border bg-bg-soft text-muted hover:text-slate-200'
            }`}
          >
            <PiggyBank className="w-4 h-4" />
            <span className="text-sm font-medium">Objetivo de poupança</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
          >
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="flex items-center gap-2 bg-bg-soft border border-border rounded-xl px-3 py-2">
            <span className="text-muted text-sm">R$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={newValor}
              onChange={(e) => setNewValor(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm tabular-nums text-slate-100"
            />
          </div>
          <button
            onClick={add}
            disabled={busy}
            className="flex items-center justify-center gap-1 bg-accent-gradient text-slate-900 font-semibold px-4 py-2 rounded-xl disabled:opacity-50 shadow-glow-accent"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
          </div>
        )}
      </motion.div>

      {/* Limites */}
      {limites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm uppercase tracking-wider text-rose-300 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Limites de gasto
          </h3>
          <AnimatePresence initial={false}>
            {limites.map((g, i) => {
              const pct = Math.min(100, g.percentual);
              const over = g.percentual > 100;
              const nearing = g.percentual >= 80 && g.percentual <= 100;
              const bar = over ? 'bg-rose-gradient' : nearing ? 'bg-amber-400' : 'bg-accent-gradient';
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Target className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-100">{g.categoria}</div>
                      <div className="text-xs text-muted tabular-nums mt-0.5">{fmt(g.gasto)} de {fmt(g.valor)} · {g.percentual.toFixed(0)}%</div>
                    </div>
                    <button onClick={() => remove(g.id)} className="w-8 h-8 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-rose-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-2 rounded-full bg-bg-soft overflow-hidden mt-3">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full ${bar} rounded-full`} />
                  </div>
                  {over && <div className="text-[11px] text-rose-400 mt-1">Passou da meta em {fmt(g.gasto - g.valor)}</div>}
                  {nearing && !over && <div className="text-[11px] text-amber-400 mt-1">Quase atingindo o limite</div>}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}

      {/* Poupança */}
      {poupancas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm uppercase tracking-wider text-emerald-300 flex items-center gap-2">
            <PiggyBank className="w-4 h-4" /> Objetivos de poupança
          </h3>
          <AnimatePresence initial={false}>
            {poupancas.map((g, i) => {
              // Para poupança: "gasto" da categoria mostra quanto saiu — não é ideal. Melhor: medir entradas líquidas.
              // Aproximação: progresso = saldo positivo investido / objetivo. Como não temos isso, usa g.gasto como já acumulado inverso.
              const acumulado = Math.max(0, g.valor - g.gasto);
              const pct = Math.min(100, (acumulado / g.valor) * 100);
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <PiggyBank className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-100">{g.categoria}</div>
                      <div className="text-xs text-muted tabular-nums mt-0.5">Objetivo {fmt(g.valor)} · {pct.toFixed(0)}%</div>
                    </div>
                    <button onClick={() => remove(g.id)} className="w-8 h-8 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-rose-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-2 rounded-full bg-bg-soft overflow-hidden mt-3">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className="h-full bg-emerald-gradient rounded-full" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}

      {limites.length === 0 && poupancas.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted text-sm">
          Nenhuma meta cadastrada para este mês.
        </div>
      )}
    </div>
  );
}
