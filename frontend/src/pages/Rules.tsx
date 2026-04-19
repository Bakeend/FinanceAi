import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, AlertCircle, Play, Power, Zap } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { CategoryChip } from '../components/CategoryChip';
import { CATEGORIAS } from '../lib/categories';
import type { TxRule } from '../lib/types';

export function RulesPage() {
  const [items, setItems] = useState<TxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pattern, setPattern] = useState('');
  const [categoria, setCategoria] = useState('Alimentação');
  const [busy, setBusy] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.listRules().then(setItems).catch((e) => setError(friendlyError(e))).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async () => {
    setError(null);
    if (pattern.trim().length < 2) return setError('Padrão deve ter ao menos 2 caracteres');
    setBusy(true);
    try {
      await api.createRule({ pattern: pattern.trim(), categoria });
      setPattern('');
      load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta regra?')) return;
    await api.deleteRule(id);
    load();
  };

  const toggle = async (r: TxRule) => {
    await api.updateRule(r.id, { active: !r.active });
    load();
  };

  const applyAll = async () => {
    setBusy(true);
    setApplyResult(null);
    try {
      const { updated } = await api.applyRules();
      setApplyResult(updated ? `${updated} transações foram recategorizadas.` : 'Nenhuma transação em "Outros" correspondeu às regras.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Regras <span className="gradient-text">automáticas</span>
          </h2>
          <p className="text-muted text-sm mt-1">Categorização automática por padrão de descrição</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={applyAll}
          disabled={busy || !items.length}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          Aplicar agora
        </motion.button>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {applyResult && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-4 text-sm text-emerald-200 flex items-start gap-2">
          <Zap className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{applyResult}</span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Nova regra</h3>
        <p className="text-xs text-muted mb-3">
          Quando a descrição <em>contiver</em> o padrão, aplica a categoria. Use <code className="bg-card-hover/50 px-1 rounded">/regex/</code> para regex.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="ex: uber, ifood, netflix, /aluguel\s+.+/"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="flex-1 bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
          >
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={add}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </motion.button>
        </div>
      </motion.div>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted">Nenhuma regra cadastrada. Adicione padrões como "uber" → Transporte para categorização automática.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map((r, idx) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ delay: idx * 0.03 }}
                className={`rounded-2xl border bg-card p-3 flex items-center gap-3 ${r.active ? 'border-border' : 'border-border/50 opacity-60'}`}
              >
                <button onClick={() => toggle(r)} className={`p-2 rounded-lg ${r.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-card-hover/30 text-muted'}`} title={r.active ? 'Ativa' : 'Inativa'}>
                  <Power className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-slate-200 truncate">{r.pattern}</div>
                  <div className="mt-1"><CategoryChip categoria={r.categoria} size="sm" /></div>
                </div>
                <button onClick={() => remove(r.id)} className="text-muted hover:text-rose-300 p-2" aria-label="Remover">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
