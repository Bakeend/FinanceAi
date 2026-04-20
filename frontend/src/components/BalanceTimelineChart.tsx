import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { BalancePoint } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmtShort(date: string) {
  const m = Number(date.slice(5, 7)) - 1;
  const yy = date.slice(2, 4);
  if (m < 0 || m > 11) return date;
  return `${MONTHS[m]}/${yy}`;
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-card">
      <div className="text-slate-300 font-medium mb-1">{label}</div>
      <div className="text-sky-400 tabular-nums">Saldo: {fmt(payload[0].value)}</div>
    </div>
  );
}

export function BalanceTimelineChart() {
  const [data, setData] = useState<BalancePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .balanceTimeline()
      .then((d) => setData(d))
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(
    () =>
      data.map((p) => ({
        date: p.date,
        label: fmtShort(p.date),
        saldo: p.saldo,
      })),
    [data],
  );

  const isEmpty = !loading && chartData.length < 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="rounded-2xl border border-border bg-card p-5 h-80"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <LineChartIcon className="w-4 h-4 text-sky-400" />
        </div>
        <h3 className="text-slate-200 font-semibold">Linha do tempo de saldo</h3>
      </div>
      {error ? (
        <div className="text-xs text-muted">{error}</div>
      ) : isEmpty ? (
        <div className="h-[85%] flex items-center justify-center text-sm text-muted">Sem histórico suficiente</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={chartData} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="balance-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              minTickGap={28}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              width={48}
            />
            <Tooltip content={<Tip />} cursor={{ stroke: '#8B5CF6', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="saldo"
              stroke="#8B5CF6"
              strokeWidth={2}
              fill="url(#balance-grad)"
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
