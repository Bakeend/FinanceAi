import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { TrendPoint } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-card">
      <div className="text-slate-300 font-medium mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ mes, ano }: { mes: number; ano: number }) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [forecast, setForecast] = useState<{ totalGasto: number; totalEntrada: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.trend(mes, ano).then(setData).catch((e) => setError(friendlyError(e)));
    api.forecastNext(mes, ano).then((r) => {
      if (r.proximoMes) setForecast({ label: r.proximoMes.label, totalGasto: r.proximoMes.totalGasto, totalEntrada: r.proximoMes.totalEntrada });
    }).catch(() => setForecast(null));
  }, [mes, ano]);

  const enriched = forecast
    ? [
        ...data.map((p) => ({ ...p, gastoForecast: undefined as number | undefined, entradaForecast: undefined as number | undefined })),
        {
          label: forecast.label,
          mes: 0, ano: 0,
          totalGasto: undefined as unknown as number,
          totalEntrada: undefined as unknown as number,
          gastoForecast: forecast.totalGasto,
          entradaForecast: forecast.totalEntrada,
        },
      ]
    : data;

  // Bridge last real point to forecast
  if (forecast && data.length > 0 && Array.isArray(enriched)) {
    const lastReal = data[data.length - 1];
    (enriched[data.length - 1] as any).gastoForecast = lastReal.totalGasto;
    (enriched[data.length - 1] as any).entradaForecast = lastReal.totalEntrada;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.4 }}
      className="rounded-2xl border border-border bg-card p-5 h-72"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        </div>
        <h3 className="text-slate-200 font-semibold">Tendência (6 meses)</h3>
      </div>
      {error ? (
        <div className="text-xs text-muted">{error}</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={enriched as any} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
            <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} width={40} />
            <Tooltip content={<Tip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" />
            <Line type="monotone" dataKey="totalGasto" name="Gastos" stroke="#EC4899" strokeWidth={2} dot={{ r: 3 }} animationDuration={600} connectNulls={false} />
            <Line type="monotone" dataKey="totalEntrada" name="Entradas" stroke="#84CC16" strokeWidth={2} dot={{ r: 3 }} animationDuration={600} connectNulls={false} />
            {forecast && (
              <>
                <Line type="monotone" dataKey="gastoForecast" name="Previsão gasto" stroke="#EC4899" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#0B0B0F' }} animationDuration={600} connectNulls={false} />
                <Line type="monotone" dataKey="entradaForecast" name="Previsão entrada" stroke="#84CC16" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#0B0B0F' }} animationDuration={600} connectNulls={false} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
