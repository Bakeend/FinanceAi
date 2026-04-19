import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
import { api, friendlyError } from '../lib/api';
import type { Account, Transaction } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function InvestmentsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.listAccounts(),
      api.listFiltered({ categoria: 'Investimentos' }),
    ]).then(([a, t]) => {
      setAccounts(a);
      setTxs(t);
    }).catch((e) => setError(friendlyError(e))).finally(() => setLoading(false));
  }, []);

  const contasInvestimento = accounts.filter((a) => a.tipo === 'investimento');
  const saldoTotal = contasInvestimento.reduce((s, a) => s + a.saldo, 0);

  const aportesPorMes = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const t of txs) {
      if (t.valor >= 0) continue;
      const key = t.data.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + (-t.valor));
    }
    return Array.from(byMonth.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-12).map(([k, v]) => {
      const [y, m] = k.split('-');
      return { label: `${m}/${y.slice(-2)}`, valor: v };
    });
  }, [txs]);

  const totalAportado = aportesPorMes.reduce((s, m) => s + m.valor, 0);
  const rendimentoEstimado = saldoTotal - totalAportado; // rough; só funciona bem se conta investimento tem histórico

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold tracking-tight">
          <span className="gradient-text">Investimentos</span>
        </h2>
        <p className="text-muted text-sm mt-1">Contas de investimento + aportes da categoria "Investimentos"</p>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted uppercase tracking-wider">Saldo em contas investimento</div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-emerald-300">{fmt(saldoTotal)}</div>
              <div className="text-xs text-muted mt-1">{contasInvestimento.length} {contasInvestimento.length === 1 ? 'conta' : 'contas'}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted uppercase tracking-wider">Aportes (12 meses)</div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-sky-300">{fmt(totalAportado)}</div>
              <div className="text-xs text-muted mt-1">{txs.length} transações</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted uppercase tracking-wider">Diferença (estimativa)</div>
              <div className={`text-2xl font-bold tabular-nums mt-1 ${rendimentoEstimado >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmt(rendimentoEstimado)}</div>
              <div className="text-[10px] text-muted mt-1">saldo − aportes (pode incluir transferências)</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" /> Aportes por mês
            </h3>
            {aportesPorMes.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Sem aportes registrados como "Investimentos" ainda.</p>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={aportesPorMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }} formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="valor" fill="#34d399" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {contasInvestimento.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent" /> Contas
              </h3>
              <div className="flex flex-col gap-2">
                {contasInvestimento.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-bg-soft/40">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${a.cor}25`, color: a.cor }}>
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">{a.nome}</div>
                      <div className="text-xs text-muted">{a.banco ?? 'Investimento'}</div>
                    </div>
                    <div className="tabular-nums font-semibold text-emerald-300">{fmt(a.saldo)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
