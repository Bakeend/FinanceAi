import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Wallet, CreditCard, Banknote, TrendingUp, X, Trash2, Save, AlertCircle, Star, ArrowLeftRight, Receipt, CalendarClock } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { Account, AccountTipo, Invoice } from '../lib/types';
import { CategoryChip } from '../components/CategoryChip';

const TIPO_OPTIONS: { value: AccountTipo; label: string; Icon: typeof Wallet }[] = [
  { value: 'conta', label: 'Conta corrente', Icon: Wallet },
  { value: 'cartao', label: 'Cartão de crédito', Icon: CreditCard },
  { value: 'dinheiro', label: 'Dinheiro', Icon: Banknote },
  { value: 'investimento', label: 'Investimento', Icon: TrendingUp },
];

const COLOR_SWATCHES = [
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#34d399', // emerald
  '#f472b6', // pink
  '#fbbf24', // amber
  '#f87171', // rose
];

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function iconFor(tipo: AccountTipo) {
  const o = TIPO_OPTIONS.find((t) => t.value === tipo);
  return o ? o.Icon : Wallet;
}

function labelFor(tipo: AccountTipo) {
  const o = TIPO_OPTIONS.find((t) => t.value === tipo);
  return o ? o.label : tipo;
}

export function AccountsPage() {
  const [items, setItems] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.listAccounts()
      .then(setItems)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Contas e <span className="gradient-text">cartões</span>
          </h2>
          <p className="text-muted text-sm mt-1">Gerencie suas contas, cartões e formas de pagamento</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setTransferring(true)}
            disabled={items.length < 2}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 font-semibold text-sm disabled:opacity-50"
            title={items.length < 2 ? 'Cadastre pelo menos 2 contas' : 'Transferência entre contas'}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="hidden sm:inline">Transferência</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar conta</span>
          </motion.button>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Wallet className="w-10 h-10 text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">Você ainda não tem contas cadastradas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((a, idx) => {
            const Icon = iconFor(a.tipo);
            return (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ y: -2 }}
                onClick={() => {
                  if (a.tipo === 'cartao' && a.closingDay) {
                    api.accountInvoice(a.id).then(setInvoice).catch((e) => setError(friendlyError(e)));
                  } else {
                    setEditing(a);
                  }
                }}
                className="relative text-left rounded-2xl border border-border bg-card p-4 overflow-hidden hover:border-accent/40 transition-colors group"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    background: `radial-gradient(120% 80% at 0% 0%, ${a.cor}40, transparent 60%)`,
                  }}
                />
                <div className="relative flex items-start justify-between gap-2 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${a.cor}25`, color: a.cor }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  {a.isDefault && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                      <Star className="w-3 h-3 fill-amber-300" />
                      padrão
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="text-sm font-semibold text-slate-100 truncate">{a.nome}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {labelFor(a.tipo)}
                    {a.banco ? ` · ${a.banco}` : ''}
                  </div>
                  <div
                    className={`text-lg font-bold tabular-nums mt-3 ${
                      a.saldo >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {fmt(a.saldo)}
                  </div>
                </div>
                <div
                  className="absolute left-0 right-0 bottom-0 h-1"
                  style={{ backgroundColor: a.cor }}
                />
              </motion.button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {creating && (
          <AccountModal
            mode="create"
            onClose={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              load();
            }}
          />
        )}
        {editing && (
          <AccountModal
            mode="edit"
            account={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        )}
        {transferring && (
          <TransferModal
            accounts={items}
            onClose={() => setTransferring(false)}
            onSaved={() => { setTransferring(false); load(); }}
          />
        )}
        {invoice && (
          <InvoiceModal
            invoice={invoice}
            onClose={() => setInvoice(null)}
            onEdit={() => { setEditing(invoice.conta); setInvoice(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TransferModal({ accounts, onClose, onSaved }: { accounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const [from, setFrom] = useState(accounts[0]?.id ?? '');
  const [to, setTo] = useState(accounts[1]?.id ?? '');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const v = Number(valor.replace(',', '.'));
    if (Number.isNaN(v) || v <= 0) return setError('Valor inválido');
    if (from === to) return setError('Origem e destino precisam ser diferentes');
    setBusy(true);
    try {
      await api.transfer({ data, valor: v, fromAccountId: from, toAccountId: to, descricao: descricao.trim() || undefined });
      onSaved();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-t-2xl md:rounded-2xl w-full max-w-md border border-border shadow-card p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-slate-100">Transferência entre contas</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-card-hover/50 flex items-center justify-center text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">De</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Para</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Valor</span>
              <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$ 0,00"
                className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Data</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Descrição (opcional)</span>
            <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Transferência"
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none" />
          </label>
        </div>

        {error && <div className="mt-3 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2">{error}</div>}

        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold disabled:opacity-50 shadow-glow-accent">
            <ArrowLeftRight className="w-4 h-4" />
            <span className="text-sm">{busy ? 'Enviando…' : 'Transferir'}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InvoiceModal({ invoice, onClose, onEdit }: { invoice: Invoice; onClose: () => void; onEdit: () => void }) {
  const { conta, faturaAtual, periodo, vencimento, transacoes, limiteDisponivel } = invoice;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-t-2xl md:rounded-2xl w-full max-w-lg border border-border shadow-card p-5 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5" style={{ color: conta.cor }} />
              {conta.nome}
            </h3>
            <p className="text-xs text-muted mt-0.5">Fatura atual</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-card-hover/50 flex items-center justify-center text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl border border-border bg-bg-soft/50 p-4 mb-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted uppercase tracking-wider">Total da fatura</span>
            <span className="text-2xl font-bold tabular-nums text-rose-300">{fmt(faturaAtual)}</span>
          </div>
          {periodo && (
            <p className="text-xs text-muted mt-2">Período: {periodo.from} → {periodo.to}</p>
          )}
          {vencimento && (
            <p className="text-xs text-amber-300 mt-1 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" /> Vence em {vencimento}
            </p>
          )}
          {limiteDisponivel != null && (
            <p className="text-xs text-muted mt-1">
              Limite disponível: <span className={limiteDisponivel < 0 ? 'text-rose-300' : 'text-emerald-300'}>{fmt(limiteDisponivel)}</span>
              {conta.limite != null && <span> / {fmt(conta.limite)}</span>}
            </p>
          )}
        </div>

        <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Receipt className="w-4 h-4" />
          Transações ({transacoes.length})
        </h4>
        {transacoes.length === 0 ? (
          <p className="text-sm text-muted py-4">Nenhuma transação neste ciclo.</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {transacoes.map((t) => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card/60 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-slate-200 truncate">{t.descricao}</div>
                  <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                    <span>{t.data}</span>
                    <CategoryChip categoria={t.categoria} size="sm" />
                  </div>
                </div>
                <div className="tabular-nums text-rose-300 shrink-0">{fmt(t.valor)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-slate-200 hover:bg-card-hover/50">
            <span className="text-sm">Editar conta</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AccountModal({
  mode,
  account,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  account?: Account;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(account?.nome ?? '');
  const [tipo, setTipo] = useState<AccountTipo>(account?.tipo ?? 'conta');
  const [cor, setCor] = useState(account?.cor ?? COLOR_SWATCHES[0]);
  const [banco, setBanco] = useState(account?.banco ?? '');
  const [closingDay, setClosingDay] = useState<string>(account?.closingDay ? String(account.closingDay) : '');
  const [dueDay, setDueDay] = useState<string>(account?.dueDay ? String(account.dueDay) : '');
  const [limite, setLimite] = useState<string>(account?.limite != null ? String(account.limite) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!nome.trim()) return setError('Nome obrigatório');
    setBusy(true);
    setError(null);
    try {
      const isCard = tipo === 'cartao';
      const closingNum = isCard && closingDay ? Number(closingDay) : null;
      const dueNum = isCard && dueDay ? Number(dueDay) : null;
      const limiteNum = isCard && limite ? Number(limite.replace(',', '.')) : null;
      if (isCard && closingNum && (closingNum < 1 || closingNum > 31)) return setError('Dia de fechamento entre 1 e 31');
      if (isCard && dueNum && (dueNum < 1 || dueNum > 31)) return setError('Dia de vencimento entre 1 e 31');
      if (mode === 'create') {
        await api.createAccount({
          nome: nome.trim(),
          tipo,
          cor,
          banco: banco.trim() || undefined,
          closingDay: closingNum ?? undefined,
          dueDay: dueNum ?? undefined,
          limite: limiteNum ?? undefined,
        });
      } else if (account) {
        await api.updateAccount(account.id, {
          nome: nome.trim(),
          cor,
          banco: banco.trim() || null,
          closingDay: closingNum,
          dueDay: dueNum,
          limite: limiteNum,
        });
      }
      onSaved();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!account) return;
    if (account.isDefault) {
      setError('Conta padrão não pode ser excluída.');
      return;
    }
    if (!confirm(`Excluir a conta "${account.nome}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(account.id);
      onSaved();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-t-2xl md:rounded-2xl w-full max-w-md border border-border shadow-card p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-slate-100">
            {mode === 'create' ? 'Nova conta' : 'Editar conta'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-card-hover/50 flex items-center justify-center text-muted hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Nome</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex: Nubank, Itaú, Carteira"
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Tipo</span>
            <div className="grid grid-cols-2 gap-2">
              {TIPO_OPTIONS.map((t) => {
                const active = tipo === t.value;
                const disabled = mode === 'edit';
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => !disabled && setTipo(t.value)}
                    disabled={disabled}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                      active
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-border bg-card text-slate-300 hover:text-slate-100'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <t.Icon className="w-4 h-4" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
            {mode === 'edit' && (
              <span className="text-[10px] text-muted">Tipo não pode ser alterado após criação.</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Cor</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={`w-9 h-9 rounded-xl border-2 transition-all ${
                    cor === c ? 'border-slate-100 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Banco (opcional)</span>
            <input
              type="text"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              placeholder="ex: Nubank"
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>

          {tipo === 'cartao' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted uppercase tracking-wider">Fecha dia</span>
                  <input
                    type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)}
                    placeholder="ex: 10"
                    className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted uppercase tracking-wider">Vence dia</span>
                  <input
                    type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)}
                    placeholder="ex: 20"
                    className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Limite (opcional)</span>
                <input
                  type="text" inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)}
                  placeholder="R$ 0,00"
                  className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
                />
              </label>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          {mode === 'edit' && account && !account.isDefault && (
            <button
              onClick={del}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-700/50 text-rose-400 hover:bg-rose-900/20 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Excluir</span>
            </button>
          )}
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold disabled:opacity-50 shadow-glow-accent"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm">
              {busy ? 'Salvando…' : mode === 'create' ? 'Criar conta' : 'Salvar'}
            </span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
