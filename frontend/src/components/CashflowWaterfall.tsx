import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, CartesianGrid, ComposedChart, Dot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Waves } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { CashflowData } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? '-' : ''}R$${(abs / 1000).toFixed(1)}k`;
  return `${n < 0 ? '-' : ''}R$${abs.toFixed(0)}`;
};

type Step = {
  name: string;
  saldo: number;
  delta: number;
  kind: 'opening' | 'entrada' | 'gasto' | 'closing';
};

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Step;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-card min-w-[120px]">
      <div className="text-slate-300 font-medium mb-1">{row.name}</div>
      {row.kind !== 'opening' && row.kind !== 'closing' && (
        <div className={row.kind === 'gasto' ? 'text-rose-400 tabular-nums' : 'text-emerald-400 tabular-nums'}>
          {row.kind === 'gasto' ? '-' : '+'}{fmt(Math.abs(row.delta))}
        </div>
      )}
      <div className="text-sky-400 tabular-nums mt-0.5">Saldo: {fmt(row.saldo)}</div>
    </div>
  );
}

function StepDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const r: Step = payload;
  const color =
    r.kind === 'opening' || r.kind === 'closing'
      ? '#8B5CF6'
      : r.kind === 'entrada'
      ? '#84CC16'
      : '#EC4899';
  const bigger = r.kind === 'opening' || r.kind === 'closing';
  return <Dot cx={cx} cy={cy} r={bigger ? 6 : 4.5} fill={color} stroke="#0B0B0F" strokeWidth={2} />;
}

export function CashflowWaterfall({ mes, ano }: { mes: number; ano: number }) {
  const [data, setData] = useState<CashflowData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .cashflow(mes, ano)
      .then(setData)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [mes, ano]);

  const steps = useMemo<Step[]>(() => {
    if (!data) return [];
    const out: Step[] = [];
    let running = data.opening;
    out.push({ name: 'Abertura', saldo: running, delta: data.opening, kind: 'opening' });
    if (data.entrada > 0) {
      running += data.entrada;
      out.push({ name: 'Entradas', saldo: running, delta: data.entrada, kind: 'entrada' });
    }
    for (const g of data.gastosPorCategoria) {
      const v = Math.abs(g.valor);
      if (v === 0) continue;
      running -= v;
      out.push({ name: g.categoria, saldo: running, delta: v, kind: 'gasto' });
    }
    out.push({ name: 'Fechamento', saldo: data.closing, delta: data.closing, kind: 'closing' });
    return out;
  }, [data]);

  const totalGasto = data ? data.gastosPorCategoria.reduce((s, g) => s + Math.abs(g.valor), 0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.4 }}
      className="rounded-2xl border border-border bg-card p-5 h-[24rem]"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <Waves className="w-4 h-4 text-sky-400" />
        </div>
        <h3 className="text-slate-200 font-semibold">Cashflow do mês</h3>
        <span className="ml-auto text-[10px] text-muted">Evolução do saldo durante o mês</span>
      </div>
      {error ? (
        <div className="text-xs text-muted">{error}</div>
      ) : loading || !data ? (
        <div className="h-[78%] flex items-center justify-center text-sm text-muted">Carregando…</div>
      ) : steps.length <= 2 ? (
        <div className="h-[78%] flex items-center justify-center text-sm text-muted">Sem dados para este mês</div>
      ) : (
        <ResponsiveContainer width="100%" height="78%">
          <ComposedChart data={steps} margin={{ left: 0, right: 20, top: 16, bottom: 32 }}>
            <defs>
              <linearGradient id="cashflow-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#64748b"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} width={52} />
            <Tooltip content={<Tip />} cursor={{ stroke: '#8B5CF6', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area
              type="stepAfter"
              dataKey="saldo"
              stroke="#8B5CF6"
              strokeWidth={2}
              fill="url(#cashflow-grad)"
              animationDuration={600}
              dot={<StepDot />}
              activeDot={{ r: 7, stroke: '#0B0B0F', strokeWidth: 2, fill: '#8B5CF6' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      {data && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          <span>Abertura: <span className="text-sky-400 tabular-nums">{fmtShort(data.opening)}</span></span>
          <span>Entradas: <span className="text-emerald-400 tabular-nums">+{fmtShort(data.entrada)}</span></span>
          <span>Gastos: <span className="text-rose-400 tabular-nums">-{fmtShort(totalGasto)}</span></span>
          <span>Fechamento: <span className="text-sky-400 tabular-nums">{fmtShort(data.closing)}</span></span>
        </div>
      )}
    </motion.div>
  );
}
