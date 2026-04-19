import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Repeat, BellPlus, Check, X } from 'lucide-react';
import { api } from '../lib/api';
import type { RecurringItem, RecurringSuggestion } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function RecurringList() {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [suggestions, setSuggestions] = useState<RecurringSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('recurring-dismissed') ?? '[]')));
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.recurring().then(setItems).catch(() => setItems([]));
    api.recurringSuggestions().then(setSuggestions).catch(() => setSuggestions([]));
    api.listReminders().then((rs) => {
      // mark as dismissed any that are already reminders
      const keys = new Set(dismissed);
      for (const r of rs) keys.add(normKey(r.descricao));
      setDismissed(keys);
      localStorage.setItem('recurring-dismissed', JSON.stringify(Array.from(keys)));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSuggestions = suggestions.filter((s) => !dismissed.has(s.key));

  const confirmSuggestion = async (s: RecurringSuggestion) => {
    setBusy(s.key);
    try {
      await api.createReminder({
        descricao: s.descricao,
        valor: Math.abs(s.valorMedio),
        dia: s.diaTipico,
        categoria: s.categoria,
      });
      const next = new Set(dismissed);
      next.add(s.key);
      setDismissed(next);
      localStorage.setItem('recurring-dismissed', JSON.stringify(Array.from(next)));
      setToast(`"${s.descricao}" virou lembrete`);
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('Não foi possível criar o lembrete.');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setBusy(null);
    }
  };

  const dismiss = (s: RecurringSuggestion) => {
    const next = new Set(dismissed);
    next.add(s.key);
    setDismissed(next);
    localStorage.setItem('recurring-dismissed', JSON.stringify(Array.from(next)));
  };

  if (!items.length && !activeSuggestions.length) return null;

  const total = items.reduce((s, i) => s + i.valorMedio, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Repeat className="w-4 h-4 text-amber-400" />
        </div>
        <h3 className="text-slate-200 font-semibold">Gastos recorrentes</h3>
        <span className="ml-auto text-xs text-muted">{fmt(total)}/mês em média</span>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {items.slice(0, 6).map((r, i) => (
          <motion.div
            key={r.descricao}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="py-2 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200 truncate">{r.descricao}</div>
              <div className="text-[11px] text-muted">
                {r.mesesAtivos} meses · [{r.categoria}]
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-rose-400 tabular-nums">{fmt(r.valorMedio)}</div>
              <div className="text-[10px] text-muted">média/mês</div>
            </div>
          </motion.div>
        ))}
      </div>

      {activeSuggestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <BellPlus className="w-4 h-4 text-accent" />
            <span className="text-xs text-slate-200 font-semibold">Virar em lembrete?</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {activeSuggestions.slice(0, 3).map((s) => (
              <div key={s.key} className="rounded-xl border border-border bg-bg-soft/50 p-2 flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-slate-200 truncate">{s.descricao}</div>
                  <div className="text-[10px] text-muted">Dia {s.diaTipico} · {fmt(Math.abs(s.valorMedio))} · {s.categoria}</div>
                </div>
                <button
                  onClick={() => confirmSuggestion(s)}
                  disabled={busy === s.key}
                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 disabled:opacity-50"
                  title="Criar lembrete"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => dismiss(s)}
                  className="p-1.5 rounded-lg bg-card-hover/30 hover:bg-card-hover/60 text-muted"
                  title="Ignorar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          {toast && <div className="mt-2 text-[11px] text-emerald-300">{toast}</div>}
        </div>
      )}
    </motion.div>
  );
}

function normKey(desc: string): string {
  return desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\d+/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2).slice(0, 4).join(' ');
}
