import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, TrendingDown, TrendingUp, Pencil, Repeat, CheckSquare, Square, Trash2, Tag, X, Share2 } from 'lucide-react';
import { renderTransactionsAsImage } from '../lib/shareTx';
import { api, friendlyError } from '../lib/api';
import { useUndo } from '../lib/undo';
import { TransactionEditModal } from './TransactionEditModal';
import { CategoryChip } from './CategoryChip';
import type { Transaction } from '../lib/types';
import { CATEGORIAS } from '../lib/categories';

const fmtMoney = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

export function TransactionList({ items, onChange }: { items: Transaction[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { schedule } = useUndo();

  const allSelected = items.length > 0 && selection.size === items.length;

  const toggle = (id: string) => {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (allSelected) setSelection(new Set());
    else setSelection(new Set(items.map((t) => t.id)));
  };
  const clearSelection = () => setSelection(new Set());

  const bulkCategorize = async (categoria: string) => {
    setBulkBusy(true);
    try {
      await api.bulkUpdate(Array.from(selection), { categoria });
      clearSelection();
      onChange();
    } catch (e) { alert(friendlyError(e)); }
    finally { setBulkBusy(false); }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selection);
    if (!ids.length) return;
    const snapshot = items.filter((t) => ids.includes(t.id));
    // optimistic: remove from UI, schedule undo
    clearSelection();
    schedule(
      `${ids.length} transação${ids.length === 1 ? '' : 'ões'} excluída${ids.length === 1 ? '' : 's'}`,
      async () => {
        // Undo: recreate them
        for (const t of snapshot) {
          await api.createManual({ data: t.data, descricao: t.descricao, valor: t.valor, categoria: t.categoria });
        }
        onChange();
      },
      async () => {
        await api.bulkDelete(ids);
        onChange();
      },
    );
    onChange();
  };

  const bulkMarkTransfer = async () => {
    setBulkBusy(true);
    try {
      await api.bulkUpdate(Array.from(selection), { isTransfer: true });
      clearSelection();
      onChange();
    } catch (e) { alert(friendlyError(e)); }
    finally { setBulkBusy(false); }
  };

  const singleDelete = async (tx: Transaction) => {
    schedule(
      `"${tx.descricao.slice(0, 40)}${tx.descricao.length > 40 ? '…' : ''}" excluída`,
      async () => {
        await api.createManual({ data: tx.data, descricao: tx.descricao, valor: tx.valor, categoria: tx.categoria });
        onChange();
      },
      async () => {
        await api.deleteTransaction(tx.id);
        onChange();
      },
    );
    onChange();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Receipt className="w-4 h-4 text-accent" />
          </div>
          <h3 className="text-slate-200 font-semibold">Transações</h3>
          <span className="ml-auto text-xs text-muted">{items.length} registros</span>
        </div>

        {items.length === 0 ? (
          <div className="py-10 text-center text-muted text-sm">
            Nenhuma transação neste mês. Faça um upload para começar.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-xs uppercase tracking-wider">
                    <th className="w-8 py-2">
                      <button onClick={toggleAll} className="text-muted hover:text-slate-200 transition-colors">
                        {allSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="text-left font-medium">Data</th>
                    <th className="text-left font-medium">Descrição</th>
                    <th className="text-right font-medium">Valor</th>
                    <th className="text-left font-medium pl-4">Categoria</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {items.map((t, idx) => {
                      const isSel = selection.has(t.id);
                      return (
                        <motion.tr
                          key={t.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: idx * 0.02, duration: 0.2 }}
                          className={`border-t border-border/60 transition-colors group ${isSel ? 'bg-accent/5' : 'hover:bg-card-hover/40'}`}
                        >
                          <td className="py-3">
                            <button onClick={() => toggle(t.id)} className="text-muted hover:text-slate-200 transition-colors">
                              {isSel ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="text-slate-400 text-xs tabular-nums">{fmtDate(t.data)}</td>
                          <td className="text-slate-200 max-w-xs truncate cursor-pointer" onClick={() => setEditing(t)}>
                            <span className="inline-flex items-center gap-2">
                              {t.descricao}
                              {t.isTransfer && <span className="inline-flex items-center gap-1 text-[10px] text-sky-300 border border-sky-500/40 rounded px-1.5 py-0.5"><Repeat className="w-2.5 h-2.5" />transfer</span>}
                              {t.tags && t.tags.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                                  <Tag className="w-2.5 h-2.5" />
                                  {t.tags.slice(0, 2).join(', ')}{t.tags.length > 2 ? '…' : ''}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className={`inline-flex items-center gap-1 tabular-nums font-medium ${t.valor < 0 ? 'text-rose-400' : 'text-emerald-400'} ${t.isTransfer ? 'opacity-60' : ''}`}>
                              {t.valor < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                              {fmtMoney(t.valor)}
                            </span>
                          </td>
                          <td className="pl-4 cursor-pointer" onClick={() => setEditing(t)}>
                            <CategoryChip categoria={t.categoria} />
                          </td>
                          <td>
                            <button onClick={() => setEditing(t)} className="text-muted hover:text-slate-200 transition-colors p-1">
                              <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {items.map((t, idx) => {
                  const isSel = selection.has(t.id);
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: idx * 0.02, duration: 0.2 }}
                      className={`rounded-xl border p-3 ${isSel ? 'border-accent/50 bg-accent/5' : 'border-border bg-card-hover/30'}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <button onClick={() => toggle(t.id)} className="mt-0.5 shrink-0">
                          {isSel ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4 text-muted" />}
                        </button>
                        <div className="flex-1 min-w-0" onClick={() => setEditing(t)}>
                          <div className="text-xs text-muted">{fmtDate(t.data)}</div>
                          <div className="text-sm text-slate-200 mt-0.5 truncate">{t.descricao}</div>
                        </div>
                        <span className={`tabular-nums font-semibold text-sm whitespace-nowrap ${t.valor < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {fmtMoney(t.valor)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between flex-wrap gap-1">
                        <CategoryChip categoria={t.categoria} size="sm" />
                        {t.isTransfer && <span className="text-[10px] text-sky-300 border border-sky-500/40 rounded px-1.5 py-0.5 flex items-center gap-1"><Repeat className="w-2.5 h-2.5" />transfer</span>}
                        <Pencil className="w-3.5 h-3.5 text-muted ml-auto" onClick={() => setEditing(t)} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </motion.div>

      {/* Bulk actions floating bar */}
      <AnimatePresence>
        {selection.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 glass rounded-2xl border border-accent/40 shadow-card px-3 py-2 flex items-center gap-2 flex-wrap max-w-[calc(100vw-2rem)]"
          >
            <span className="text-sm text-slate-200 font-medium pl-2">{selection.size} selec.</span>
            <select
              onChange={(e) => { if (e.target.value) bulkCategorize(e.target.value); e.target.value = ''; }}
              disabled={bulkBusy}
              className="text-xs bg-bg-soft border border-border rounded-lg px-2 py-1.5 text-slate-200"
            >
              <option value="">Categorizar…</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={bulkMarkTransfer}
              disabled={bulkBusy}
              className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
            >
              <Repeat className="w-3 h-3" />
              Transfer
            </button>
            <button
              onClick={async () => {
                const sel = items.filter((t) => selection.has(t.id));
                await renderTransactionsAsImage(sel.map((t) => ({ data: t.data, descricao: t.descricao, valor: t.valor, categoria: t.categoria })), { title: `${sel.length} transações`, filename: `transacoes-${new Date().toISOString().slice(0,10)}.png` });
              }}
              disabled={bulkBusy}
              className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            >
              <Share2 className="w-3 h-3" />
              Compartilhar
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkBusy}
              className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
            >
              <Trash2 className="w-3 h-3" />
              Excluir
            </button>
            <button onClick={clearSelection} className="text-muted hover:text-slate-200 p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <TransactionEditModal tx={editing} onClose={() => setEditing(null)} onSaved={onChange} onDelete={singleDelete} />
    </>
  );
}
