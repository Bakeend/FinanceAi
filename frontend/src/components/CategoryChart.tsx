import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { Summary } from '../lib/types';

const COLORS = ['#8B5CF6', '#818cf8', '#a78bfa', '#f472b6', '#F472B6', '#fbbf24', '#9DE131', '#60a5fa'];

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { categoria, gasto } = payload[0].payload;
  return (
    <div className="glass rounded-lg px-3 py-2 text-sm shadow-card">
      <div className="text-slate-300 font-medium">{categoria}</div>
      <div className="text-rose-400 tabular-nums">{fmt(-gasto)}</div>
    </div>
  );
}

export function CategoryChart({ data }: { data: Summary['porCategoria'] }) {
  const chartData = data.map((d) => ({ categoria: d.categoria, gasto: Math.abs(d.total) }));
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 h-80"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-accent" />
        </div>
        <h3 className="text-slate-200 font-semibold">Gastos por categoria</h3>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <defs>
            {COLORS.map((c, i) => (
              <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={c} stopOpacity={0.9} />
                <stop offset="100%" stopColor={c} stopOpacity={0.5} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" horizontal={false} />
          <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
          <YAxis type="category" dataKey="categoria" stroke="#94a3b8" tick={{ fontSize: 12 }} width={100} />
          <Tooltip cursor={{ fill: 'rgba(56,189,248,0.05)' }} content={<CustomTooltip />} />
          <Bar dataKey="gasto" radius={[0, 8, 8, 0]} animationDuration={600}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={`url(#bar-grad-${i % COLORS.length})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
