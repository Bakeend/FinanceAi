import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import type { Summary } from '../lib/types';

const COLORS = ['#8B5CF6', '#818cf8', '#a78bfa', '#f472b6', '#F472B6', '#fbbf24', '#9DE131', '#60a5fa'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-card">
      <div className="text-slate-300 font-medium">{name}</div>
      <div className="text-rose-400 tabular-nums">{fmt(-value)}</div>
    </div>
  );
}

export function CategoryPie({ data }: { data: Summary['porCategoria'] }) {
  const chartData = data.map((d) => ({ name: d.categoria, value: Math.abs(d.total) }));
  const total = chartData.reduce((s, d) => s + d.value, 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.4 }}
      className="rounded-2xl border border-border bg-card p-5 h-80 flex flex-col"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <PieIcon className="w-4 h-4 text-violet-400" />
        </div>
        <h3 className="text-slate-200 font-semibold">Distribuição</h3>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-2 items-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value" animationDuration={600}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<Tip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-1 text-xs overflow-y-auto max-h-48 pr-2">
          {chartData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-slate-300 flex-1 truncate">{d.name}</span>
              <span className="text-muted tabular-nums">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
