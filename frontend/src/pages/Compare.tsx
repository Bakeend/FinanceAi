import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, Calendar, CalendarDays } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import type { MonthRef, Summary, YearlyReport } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function shiftMonth({ mes, ano }: MonthRef, delta: number): MonthRef {
  const total = ano * 12 + (mes - 1) + delta;
  return { mes: (total % 12) + 1, ano: Math.floor(total / 12) };
}

function Delta({ a, b }: { a: number; b: number }) {
  const delta = a - b;
  const pct = b !== 0 ? (delta / Math.abs(b)) * 100 : delta > 0 ? 100 : 0;
  const Icon = Math.abs(delta) < 0.01 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const color = Math.abs(delta) < 0.01 ? 'text-muted' : delta > 0 ? 'text-rose-400' : 'text-emerald-400';
  return (
    <span className={`inline-flex items-center gap-1 text-xs tabular-nums ${color}`}>
      <Icon className="w-3 h-3" />
      {delta >= 0 ? '+' : ''}{fmt(delta)} ({pct.toFixed(0)}%)
    </span>
  );
}

function YearPicker({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(value - 1)} className="w-8 h-8 rounded-lg bg-border/50 hover:bg-border text-slate-300 flex items-center justify-center text-sm font-bold transition-colors">−</button>
      <span className="text-2xl font-bold text-slate-100 tabular-nums w-16 text-center">{value}</span>
      <button onClick={() => onChange(value + 1)} className="w-8 h-8 rounded-lg bg-border/50 hover:bg-border text-slate-300 flex items-center justify-center text-sm font-bold transition-colors">+</button>
    </div>
  );
}

export function ComparePage() {
  const today = new Date();
  const cur = { mes: today.getMonth() + 1, ano: today.getFullYear() };
  const [mode, setMode] = useState<'meses' | 'anos'>('meses');

  // Month mode state
  const [refA, setRefA] = useState<MonthRef>(shiftMonth(cur, -1));
  const [refB, setRefB] = useState<MonthRef>(cur);
  const [a, setA] = useState<Summary | null>(null);
  const [b, setB] = useState<Summary | null>(null);

  // Year mode state
  const [yearA, setYearA] = useState(today.getFullYear() - 1);
  const [yearB, setYearB] = useState(today.getFullYear());
  const [ya, setYa] = useState<YearlyReport | null>(null);
  const [yb, setYb] = useState<YearlyReport | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'meses') return;
    setError(null);
    Promise.all([api.summary(refA.mes, refA.ano), api.summary(refB.mes, refB.ano)])
      .then(([sa, sb]) => { setA(sa); setB(sb); })
      .catch((e) => setError(friendlyError(e)));
  }, [mode, refA.mes, refA.ano, refB.mes, refB.ano]);

  useEffect(() => {
    if (mode !== 'anos') return;
    setError(null);
    Promise.all([api.yearlyReport(yearA), api.yearlyReport(yearB)])
      .then(([ra, rb]) => { setYa(ra); setYb(rb); })
      .catch((e) => setError(friendlyError(e)));
  }, [mode, yearA, yearB]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of a?.porCategoria ?? []) set.add(c.categoria);
    for (const c of b?.porCategoria ?? []) set.add(c.categoria);
    return Array.from(set);
  }, [a, b]);

  const allYearCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of ya?.topCategorias ?? []) set.add(c.categoria);
    for (const c of yb?.topCategorias ?? []) set.add(c.categoria);
    return Array.from(set);
  }, [ya, yb]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Comparar <span className="gradient-text">{mode === 'meses' ? 'meses' : 'anos'}</span>
          </h2>
          <p className="text-muted text-sm mt-1">Veja as diferenças categoria por categoria</p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 self-start mt-1">
          <button
            onClick={() => setMode('meses')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'meses' ? 'bg-accent text-white shadow' : 'text-muted hover:text-slate-200'}`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Meses
          </button>
          <button
            onClick={() => setMode('anos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'anos' ? 'bg-accent text-white shadow' : 'text-muted hover:text-slate-200'}`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Anos
          </button>
        </div>
      </motion.div>

      {/* Month selectors */}
      {mode === 'meses' && (
        <motion.div key="meses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Mês A</div>
            <MonthSelector value={refA} onChange={setRefA} />
          </div>
          <ArrowLeftRight className="w-6 h-6 text-accent mx-auto hidden md:block" />
          <div className="rounded-2xl border border-accent/50 bg-accent/5 p-4">
            <div className="text-xs text-accent uppercase tracking-wider mb-2">Mês B</div>
            <MonthSelector value={refB} onChange={setRefB} />
          </div>
        </motion.div>
      )}

      {/* Year selectors */}
      {mode === 'anos' && (
        <motion.div key="anos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Ano A</div>
            <YearPicker value={yearA} onChange={setYearA} />
          </div>
          <ArrowLeftRight className="w-6 h-6 text-accent mx-auto hidden md:block" />
          <div className="rounded-2xl border border-accent/50 bg-accent/5 p-4">
            <div className="text-xs text-accent uppercase tracking-wider mb-2">Ano B</div>
            <YearPicker value={yearB} onChange={setYearB} />
          </div>
        </motion.div>
      )}

      {error && <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200">{error}</div>}

      {/* Month comparison results */}
      {mode === 'meses' && a && b && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Entradas', va: a.totalEntrada, vb: b.totalEntrada, color: 'text-emerald-400' },
              { label: 'Gastos', va: Math.abs(a.totalGasto), vb: Math.abs(b.totalGasto), color: 'text-rose-400' },
              { label: 'Saldo', va: a.saldo, vb: b.saldo, color: 'text-accent' },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }} className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs text-muted uppercase tracking-wider">{item.label}</div>
                <div className="flex items-baseline justify-between gap-2 mt-2 flex-wrap">
                  <div className="text-sm text-slate-400 tabular-nums">{MESES[refA.mes - 1]} {fmt(item.va)}</div>
                  <div className={`text-xl font-bold tabular-nums ${item.color}`}>{MESES[refB.mes - 1]} {fmt(item.vb)}</div>
                </div>
                <div className="mt-2"><Delta a={item.vb} b={item.va} /></div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-slate-200 font-semibold mb-3">Por categoria</h3>
            <div className="flex flex-col divide-y divide-border/60">
              {allCategories.length === 0 ? (
                <div className="text-sm text-muted py-4">Sem dados para comparar.</div>
              ) : (
                allCategories.map((cat) => {
                  const va = Math.abs(a.porCategoria.find((c) => c.categoria === cat)?.total ?? 0);
                  const vb = Math.abs(b.porCategoria.find((c) => c.categoria === cat)?.total ?? 0);
                  return (
                    <div key={cat} className="py-2.5">
                      <div className="md:hidden">
                        <div className="flex justify-between items-baseline gap-2">
                          <div className="text-sm text-slate-200 font-medium">{cat}</div>
                          <Delta a={vb} b={va} />
                        </div>
                        <div className="flex justify-between items-baseline mt-1 text-xs tabular-nums">
                          <span className="text-muted">{fmt(va)}</span>
                          <span className="text-slate-100 font-medium">{fmt(vb)}</span>
                        </div>
                      </div>
                      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                        <div className="text-sm text-slate-200">{cat}</div>
                        <div className="text-xs text-muted tabular-nums text-right w-24">{fmt(va)}</div>
                        <div className="text-sm text-slate-100 tabular-nums text-right font-medium w-28">{fmt(vb)}</div>
                        <div className="w-36 text-right"><Delta a={vb} b={va} /></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Year comparison results */}
      {mode === 'anos' && ya && yb && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Entradas', va: ya.totalEntrada, vb: yb.totalEntrada, color: 'text-emerald-400' },
              { label: 'Gastos', va: ya.totalGasto, vb: yb.totalGasto, color: 'text-rose-400' },
              { label: 'Saldo', va: ya.saldo, vb: yb.saldo, color: 'text-accent' },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }} className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs text-muted uppercase tracking-wider">{item.label}</div>
                <div className="flex items-baseline justify-between gap-2 mt-2 flex-wrap">
                  <div className="text-sm text-slate-400 tabular-nums">{yearA} {fmt(item.va)}</div>
                  <div className={`text-xl font-bold tabular-nums ${item.color}`}>{yearB} {fmt(item.vb)}</div>
                </div>
                <div className="mt-2"><Delta a={item.vb} b={item.va} /></div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-slate-200 font-semibold mb-3">Por categoria</h3>
            <div className="flex flex-col divide-y divide-border/60">
              {allYearCategories.length === 0 ? (
                <div className="text-sm text-muted py-4">Sem dados para comparar.</div>
              ) : (
                allYearCategories.map((cat) => {
                  const va = Math.abs(ya.topCategorias.find((c) => c.categoria === cat)?.valor ?? 0);
                  const vb = Math.abs(yb.topCategorias.find((c) => c.categoria === cat)?.valor ?? 0);
                  return (
                    <div key={cat} className="py-2.5">
                      <div className="md:hidden">
                        <div className="flex justify-between items-baseline gap-2">
                          <div className="text-sm text-slate-200 font-medium">{cat}</div>
                          <Delta a={vb} b={va} />
                        </div>
                        <div className="flex justify-between items-baseline mt-1 text-xs tabular-nums">
                          <span className="text-muted">{fmt(va)}</span>
                          <span className="text-slate-100 font-medium">{fmt(vb)}</span>
                        </div>
                      </div>
                      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                        <div className="text-sm text-slate-200">{cat}</div>
                        <div className="text-xs text-muted tabular-nums text-right w-24">{fmt(va)}</div>
                        <div className="text-sm text-slate-100 tabular-nums text-right font-medium w-28">{fmt(vb)}</div>
                        <div className="w-36 text-right"><Delta a={vb} b={va} /></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
