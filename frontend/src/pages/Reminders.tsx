import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Plus, Trash2, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { Reminder } from '../lib/types';
import { CATEGORIAS } from '../lib/categories';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function RemindersPage() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState('5');
  const [categoria, setCategoria] = useState('Moradia');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .listReminders()
      .then(setItems)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async () => {
    setError(null);
    const v = Number(valor.replace(',', '.'));
    const d = Number(dia);
    if (!descricao.trim()) return setError('Descrição obrigatória');
    if (Number.isNaN(v) || v <= 0) return setError('Valor inválido');
    if (Number.isNaN(d) || d < 1 || d > 31) return setError('Dia deve estar entre 1 e 31');
    setBusy(true);
    try {
      await api.createReminder({ descricao: descricao.trim(), valor: v, dia: d, categoria });
      setDescricao('');
      setValor('');
      setDia('5');
      load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: Reminder) => {
    try {
      await api.updateReminder(r.id, { active: !r.active });
      load();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este lembrete?')) return;
    try {
      await api.deleteReminder(id);
      load();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const markPaid = async (id: string) => {
    try {
      await api.markReminderPaid(id);
      load();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const today = new Date().getDate();
  const isNear = (d: number) => Math.abs(d - today) <= 3 || (d < today && today - d <= 3);

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Lembretes de contas recorrentes</h2>
          <p className="text-muted text-sm mt-0.5">Aluguel, streaming, academia — avisos automáticos antes do vencimento.</p>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* New reminder form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-accent" />
          <h3 className="text-slate-200 font-semibold text-sm">Novo lembrete</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] text-muted uppercase tracking-wider">Descrição</span>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Aluguel, Netflix…"
              className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted uppercase tracking-wider">Valor</span>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 tabular-nums focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted uppercase tracking-wider">Dia do mês</span>
            <input
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              type="number"
              min={1}
              max={31}
              className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 tabular-nums focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2 md:col-span-3">
            <span className="text-[10px] text-muted uppercase tracking-wider">Categoria</span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 cursor-pointer focus:border-accent focus:outline-none"
            >
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button
            onClick={add}
            disabled={busy}
            className="md:col-span-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold disabled:opacity-50 shadow-glow-accent text-sm"
          >
            <Plus className="w-4 h-4" />
            {busy ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </motion.div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted text-sm">
          Nenhum lembrete criado ainda. Adicione o primeiro acima.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence initial={false}>
            {items.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`rounded-2xl border p-4 flex flex-col gap-3 ${r.active ? 'border-border bg-card' : 'border-border bg-card opacity-60'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">{r.descricao}</div>
                    <div className="text-xs text-muted mt-0.5">Todo dia {r.dia} · {r.categoria}</div>
                    {r.lastPaid && (
                      <div className="text-[10px] text-emerald-400 mt-0.5">Último pago: {r.lastPaid.split('-').reverse().join('/')}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums text-sm font-semibold text-slate-100">{fmt(r.valor)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <span className={`relative inline-flex w-9 h-5 rounded-full transition-colors ${r.active ? 'bg-accent/70' : 'bg-slate-600'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${r.active ? 'translate-x-4' : ''}`} />
                    </span>
                    <input type="checkbox" className="sr-only" checked={r.active} onChange={() => toggleActive(r)} />
                    <span>{r.active ? 'Ativo' : 'Inativo'}</span>
                  </label>

                  {r.active && isNear(r.dia) && (
                    <button
                      onClick={() => markPaid(r.id)}
                      className="ml-auto inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-emerald-600/40 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Marcar pago
                    </button>
                  )}

                  <button
                    onClick={() => remove(r.id)}
                    className={`${r.active && isNear(r.dia) ? '' : 'ml-auto'} inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-rose-700/50 text-rose-400 hover:bg-rose-900/20`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
