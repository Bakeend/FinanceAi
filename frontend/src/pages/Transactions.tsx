import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ArrowDownRight, ArrowUpRight, List, Download } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { TransactionList } from '../components/TransactionList';
import type { Account, Transaction } from '../lib/types';
import { CATEGORIAS } from '../lib/categories';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TransactionsPage() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState<'all' | 'entrada' | 'gasto'>('all');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>('');

  useEffect(() => {
    api.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    api.listFiltered({
      q: q || undefined,
      categoria: categoria || undefined,
      tipo,
      accountId: accountId || undefined,
    })
      .then(setItems)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [q, categoria, tipo, accountId]);

  const totals = useMemo(() => {
    const gasto = items.filter((t) => t.valor < 0).reduce((s, t) => s + t.valor, 0);
    const entrada = items.filter((t) => t.valor > 0).reduce((s, t) => s + t.valor, 0);
    return { gasto, entrada, saldo: gasto + entrada };
  }, [items]);

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gerenciar <span className="gradient-text">transações</span>
          </h2>
          <p className="text-muted text-sm mt-1">Busque, filtre e edite todas as suas entradas e saídas</p>
        </div>
        <a
          href={api.exportUrl()}
          download
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm text-slate-200 hover:border-accent/50 hover:bg-card-hover transition-colors"
        >
          <Download className="w-4 h-4 text-accent" />
          Exportar CSV
        </a>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-4 flex flex-col md:flex-row gap-3 md:items-center"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por descrição…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-bg-soft border border-border rounded-xl text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Filter className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 bg-bg-soft border border-border rounded-xl text-sm text-slate-100 cursor-pointer focus:border-accent focus:outline-none"
            >
              <option value="">Todas categorias</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex rounded-xl border border-border overflow-hidden bg-bg-soft">
            {([
              { v: 'all', l: 'Tudo', I: List },
              { v: 'entrada', l: 'Entradas', I: ArrowUpRight },
              { v: 'gasto', l: 'Gastos', I: ArrowDownRight },
            ] as const).map(({ v, l, I }) => (
              <button
                key={v}
                onClick={() => setTipo(v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  tipo === v ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <I className="w-3.5 h-3.5" />
                {l}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {accounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        >
          <button
            onClick={() => setAccountId('')}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all ${
              accountId === ''
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-border bg-card text-slate-300 hover:text-slate-100'
            }`}
          >
            Todas contas
          </button>
          {accounts.map((a) => {
            const active = accountId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all ${
                  active
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-border bg-card text-slate-300 hover:text-slate-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.cor }} />
                <span className="truncate max-w-[140px]">{a.nome}</span>
              </button>
            );
          })}
        </motion.div>
      )}

      {/* Totals strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3"
      >
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted">Entradas</div>
          <div className="text-sm font-semibold text-emerald-400 tabular-nums mt-1">{fmt(totals.entrada)}</div>
        </div>
        <div className="rounded-xl border border-rose-700/30 bg-rose-500/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted">Gastos</div>
          <div className="text-sm font-semibold text-rose-400 tabular-nums mt-1">{fmt(totals.gasto)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted">Saldo do filtro</div>
          <div className={`text-sm font-semibold tabular-nums mt-1 ${totals.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(totals.saldo)}</div>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200">{error}</div>
      )}

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : (
        <TransactionList items={items} onChange={load} />
      )}
    </div>
  );
}
