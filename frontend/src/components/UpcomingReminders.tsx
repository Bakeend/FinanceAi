import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2 } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { UpcomingReminder } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function UpcomingReminders() {
  const [items, setItems] = useState<UpcomingReminder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .upcomingReminders()
      .then(setItems)
      .catch((e) => setError(friendlyError(e)));
  };

  useEffect(load, []);

  const markPaid = async (id: string) => {
    setBusy(id);
    try {
      await api.markReminderPaid(id);
      load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  const top = items.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Bell className="w-4 h-4 text-amber-300" />
        </div>
        <h3 className="text-slate-200 font-semibold text-sm">Contas próximas do vencimento</h3>
        <span className="ml-auto text-xs text-muted">{items.length} lembrete{items.length === 1 ? '' : 's'}</span>
      </div>

      {error && (
        <div className="mb-2 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2">{error}</div>
      )}

      <div className="flex flex-col gap-2">
        {top.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card-hover/30 p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-100 font-medium truncate">{r.descricao}</div>
              <div className="text-[11px] text-muted mt-0.5">
                {r.diasRestantes === 0
                  ? 'Vence hoje'
                  : r.diasRestantes === 1
                  ? 'Vence em 1 dia'
                  : `Vence em ${r.diasRestantes} dias`}
                {' · '}dia {r.dia}
              </div>
            </div>
            <div className="tabular-nums text-sm font-semibold text-slate-100 whitespace-nowrap">{fmt(r.valor)}</div>
            <button
              onClick={() => markPaid(r.id)}
              disabled={busy === r.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-emerald-600/40 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20 disabled:opacity-50 shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marcar pago</span>
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
