import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Download, Calendar, AlertCircle, Columns3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend,
} from 'recharts';
import { api, friendlyError } from '../lib/api';
import { CATEGORY_META } from '../lib/categories';
import type { CategoryEvolution, YearOverYear, YearlyReport } from '../lib/types';
import { exportSvgAsPng } from '../lib/exportImage';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0));

export function ReportsPage() {
  const today = new Date();
  const [ano, setAno] = useState(today.getFullYear());
  const [yearly, setYearly] = useState<YearlyReport | null>(null);
  const [evolution, setEvolution] = useState<CategoryEvolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'annual' | 'evolution' | 'yoy'>('annual');
  const [yoy, setYoy] = useState<YearOverYear[] | null>(null);
  const annualRef = useRef<HTMLDivElement>(null);
  const evolRef = useRef<HTMLDivElement>(null);
  const yoyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.yearlyReport(ano).then(setYearly).catch((e) => setError(friendlyError(e)));
  }, [ano]);

  useEffect(() => {
    api.categoryEvolution(today.getMonth() + 1, today.getFullYear(), 12).then(setEvolution).catch(() => {});
    api.yearOverYear(today.getMonth() + 1, today.getFullYear(), 3).then(setYoy).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topCatsForEvol = useMemo(() => evolution?.categorias.slice(0, 6) ?? [], [evolution]);
  const evolSeries = useMemo(() => {
    if (!evolution) return [];
    return evolution.meses.map((m) => {
      const r: Record<string, number | string> = { label: m.label };
      for (const c of topCatsForEvol) r[c] = m.porCategoria[c] ?? 0;
      return r;
    });
  }, [evolution, topCatsForEvol]);

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Relatórios <span className="gradient-text">avançados</span>
          </h2>
          <p className="text-muted text-sm mt-1">Visão anual e evolução por categoria</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('annual')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition ${tab === 'annual' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-card text-slate-300'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Anual
          </button>
          <button
            onClick={() => setTab('evolution')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition ${tab === 'evolution' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-card text-slate-300'}`}
          >
            <TrendingUp className="w-4 h-4" />
            Evolução
          </button>
          <button
            onClick={() => setTab('yoy')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition ${tab === 'yoy' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-card text-slate-300'}`}
          >
            <Columns3 className="w-4 h-4" />
            Ano × Ano
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {tab === 'annual' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAno(ano - 1)}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-slate-300 text-sm hover:border-accent/50"
              >
                ← {ano - 1}
              </button>
              <span className="text-lg font-semibold text-slate-100 inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-accent" /> {ano}
              </span>
              <button
                onClick={() => setAno(ano + 1)}
                disabled={ano >= today.getFullYear()}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-slate-300 text-sm hover:border-accent/50 disabled:opacity-50"
              >
                {ano + 1} →
              </button>
            </div>
            <button
              onClick={() => annualRef.current && exportSvgAsPng(annualRef.current, `financeai-anual-${ano}.png`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar PNG
            </button>
          </div>

          {yearly && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat title="Total gasto" value={fmt(yearly.totalGasto)} tone="rose" />
                <Stat title="Total entrada" value={fmt(yearly.totalEntrada)} tone="emerald" />
                <Stat title="Saldo do ano" value={fmt(yearly.saldo)} tone={yearly.saldo >= 0 ? 'emerald' : 'rose'} />
              </div>

              <div ref={annualRef} className="rounded-2xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Gastos × entradas por mês</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={yearly.months}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={fmtShort} />
                      <Tooltip
                        contentStyle={{ background: '#0B0B0F', border: '1px solid #1e293b', borderRadius: 12 }}
                        formatter={(v) => fmt(Number(v))}
                      />
                      <Legend />
                      <Bar dataKey="totalEntrada" fill="#9DE131" name="Entradas" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="totalGasto" fill="#EC4899" name="Gastos" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Categorias que mais pesaram no ano</h3>
                <div className="flex flex-col gap-2">
                  {yearly.topCategorias.slice(0, 10).map((c) => {
                    const meta = CATEGORY_META[c.categoria] ?? CATEGORY_META['Outros'];
                    const pct = yearly.totalGasto > 0 ? (c.valor / yearly.totalGasto) * 100 : 0;
                    return (
                      <div key={c.categoria} className="flex items-center gap-2">
                        <div className={`inline-flex items-center gap-1.5 text-xs ${meta.color} w-36`}>
                          <meta.Icon className="w-3.5 h-3.5" />
                          <span className="truncate">{c.categoria}</span>
                        </div>
                        <div className="flex-1 h-2 rounded-full bg-card-hover/50 overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <div className="tabular-nums text-xs text-slate-300 w-20 text-right">{fmt(c.valor)}</div>
                        <div className="text-[10px] text-muted w-10 text-right">{pct.toFixed(1)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'evolution' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-end">
            <button
              onClick={() => evolRef.current && exportSvgAsPng(evolRef.current, 'financeai-evolucao.png')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar PNG
            </button>
          </div>
          <div ref={evolRef} className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Evolução mensal — top 6 categorias (últimos 12 meses)</h3>
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                <LineChart data={evolSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={fmtShort} />
                  <Tooltip
                    contentStyle={{ background: '#0B0B0F', border: '1px solid #1e293b', borderRadius: 12 }}
                    formatter={(v) => fmt(Number(v))}
                  />
                  <Legend />
                  {topCatsForEvol.map((c, i) => {
                    const palette = ['#8B5CF6', '#a78bfa', '#f472b6', '#fbbf24', '#9DE131', '#EC4899'];
                    return <Line key={c} type="monotone" dataKey={c} stroke={palette[i % palette.length]} strokeWidth={2} dot={false} />;
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'yoy' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted">Mês atual comparado aos últimos 3 anos — bom pra sazonalidade.</p>
            <button
              onClick={() => yoyRef.current && exportSvgAsPng(yoyRef.current, 'financeai-yoy.png')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar PNG
            </button>
          </div>
          <div ref={yoyRef} className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Comparativo {yoy && yoy.length > 0 ? yoy[0].label.split('/')[0] : ''} em anos diferentes
            </h3>
            {!yoy || yoy.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Sem dados históricos suficientes.</p>
            ) : (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={yoy}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={fmtShort} />
                    <Tooltip contentStyle={{ background: '#0B0B0F', border: '1px solid #1e293b', borderRadius: 12 }} formatter={(v) => fmt(Number(v))} />
                    <Legend />
                    <Bar dataKey="totalEntrada" fill="#9DE131" name="Entradas" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="totalGasto" fill="#EC4899" name="Gastos" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: string; tone: 'rose' | 'emerald' | 'accent' }) {
  const toneClass = tone === 'rose' ? 'text-rose-300' : tone === 'emerald' ? 'text-emerald-300' : 'text-accent';
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted uppercase tracking-wider">{title}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
