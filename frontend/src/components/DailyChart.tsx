import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';
import type { Transaction } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-card">
      <div className="text-slate-300 font-medium">Dia {label}</div>
      <div className="text-rose-400 tabular-nums mt-0.5">{fmt(-payload[0].value)}</div>
    </div>
  );
}

export function DailyChart({ items, mes, ano }: { items: Transaction[]; mes: number; ano: number }) {
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const byDay = new Map<number, number>();
  for (let d = 1; d <= daysInMonth; d++) byDay.set(d, 0);
  for (const t of items) {
    if (t.valor >= 0) continue;
    const day = Number(t.data.slice(8, 10));
    byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(t.valor));
  }
  const data = Array.from(byDay.entries()).map(([dia, gasto]) => ({ dia, gasto }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="rounded-2xl border border-border bg-card p-5 h-64"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <Activity className="w-4 h-4 text-emerald-400" />
        </div>
        <h3 className="text-slate-200 font-semibold">Gastos ao longo do mês</h3>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="daily-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="dia" stroke="#64748b" tick={{ fontSize: 11 }} interval={Math.ceil(daysInMonth / 10)} />
          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} width={40} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8B5CF6', strokeWidth: 1, strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="gasto" stroke="#8B5CF6" strokeWidth={2} fill="url(#daily-grad)" animationDuration={600} />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
