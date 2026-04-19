import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Loader2, X, TrendingDown, TrendingUp, Sparkles } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { CategoryChip } from './CategoryChip';
import { TransactionEditModal } from './TransactionEditModal';
import type { Transaction } from '../lib/types';

// Parser de operadores: categoria:X valor>N valor<N data>YYYY-MM-DD tipo:gasto|entrada
function parseOperators(q: string): {
  hasOperators: boolean;
  mes?: number; ano?: number; categoria?: string; text: string; tipo?: 'entrada' | 'gasto' | 'all'; resumo: string;
  postFilter: (items: Transaction[]) => Transaction[];
} | null {
  const ops: RegExp[] = [
    /categoria:([^\s]+)/i,
    /valor(>=|<=|>|<|=)(-?\d+(?:[.,]\d+)?)/i,
    /data(>=|<=|>|<|=)(\d{4}-\d{2}-\d{2})/i,
    /mes:(\d{1,2})/i,
    /ano:(\d{4})/i,
    /tipo:(entrada|gasto|all)/i,
  ];
  const hasOperators = ops.some((r) => r.test(q));
  if (!hasOperators) return null;
  let text = q;
  let categoria: string | undefined;
  let mes: number | undefined;
  let ano: number | undefined;
  let tipo: 'entrada' | 'gasto' | 'all' | undefined;
  const valorConds: Array<{ op: string; v: number }> = [];
  const dateConds: Array<{ op: string; v: string }> = [];

  text = text.replace(/categoria:([^\s]+)/gi, (_m, c) => { categoria = c; return ''; });
  text = text.replace(/valor(>=|<=|>|<|=)(-?\d+(?:[.,]\d+)?)/gi, (_m, op, v) => { valorConds.push({ op, v: Number(String(v).replace(',', '.')) }); return ''; });
  text = text.replace(/data(>=|<=|>|<|=)(\d{4}-\d{2}-\d{2})/gi, (_m, op, v) => { dateConds.push({ op, v }); return ''; });
  text = text.replace(/mes:(\d{1,2})/gi, (_m, v) => { mes = Number(v); return ''; });
  text = text.replace(/ano:(\d{4})/gi, (_m, v) => { ano = Number(v); return ''; });
  text = text.replace(/tipo:(entrada|gasto|all)/gi, (_m, v) => { tipo = v as any; return ''; });
  text = text.trim().replace(/\s+/g, ' ');

  const postFilter = (items: Transaction[]): Transaction[] => {
    return items.filter((t) => {
      for (const c of valorConds) {
        const v = t.valor;
        if (c.op === '>' && !(v > c.v)) return false;
        if (c.op === '>=' && !(v >= c.v)) return false;
        if (c.op === '<' && !(v < c.v)) return false;
        if (c.op === '<=' && !(v <= c.v)) return false;
        if (c.op === '=' && v !== c.v) return false;
      }
      for (const c of dateConds) {
        if (c.op === '>' && !(t.data > c.v)) return false;
        if (c.op === '>=' && !(t.data >= c.v)) return false;
        if (c.op === '<' && !(t.data < c.v)) return false;
        if (c.op === '<=' && !(t.data <= c.v)) return false;
        if (c.op === '=' && t.data !== c.v) return false;
      }
      return true;
    });
  };

  const parts: string[] = [];
  if (categoria) parts.push(`categoria=${categoria}`);
  if (mes) parts.push(`mês=${mes}`);
  if (ano) parts.push(`ano=${ano}`);
  if (tipo) parts.push(`tipo=${tipo}`);
  if (valorConds.length) parts.push(`valor ${valorConds.map((c) => `${c.op}${c.v}`).join(' ')}`);
  if (dateConds.length) parts.push(`data ${dateConds.map((c) => `${c.op}${c.v}`).join(' ')}`);
  if (text) parts.push(`texto "${text}"`);
  const resumo = `Filtro: ${parts.join(', ')}`;

  return { hasOperators: true, mes, ano, categoria, text, tipo, resumo, postFilter };
}

// Simple event bus so a header button anywhere can open the modal.
const listeners = new Set<() => void>();
export function openGlobalSearch() {
  listeners.forEach((fn) => fn());
}
function onOpen(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const fmtMoney = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

type Result = {
  filters: { mes?: number; ano?: number; categoria?: string; q?: string; tipo?: 'entrada' | 'gasto' | 'all'; from?: string; to?: string; resumo?: string };
  items: Transaction[];
  total: number;
  count: number;
};

export function GlobalSearchBar() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return onOpen(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    // focus input when opened
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    setText('');
    setResult(null);
    setError(null);
    setBusy(false);
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const parsed = parseOperators(q);
      if (parsed && parsed.hasOperators) {
        const items = await api.listFiltered({ mes: parsed.mes, ano: parsed.ano, categoria: parsed.categoria, q: parsed.text || undefined, tipo: parsed.tipo });
        const filtered = parsed.postFilter(items);
        setResult({ filters: { mes: parsed.mes, ano: parsed.ano, categoria: parsed.categoria, q: parsed.text, tipo: parsed.tipo, resumo: parsed.resumo }, items: filtered, total: filtered.length, count: filtered.length });
        setBusy(false);
        return;
      }
      const r = await api.aiSearch(q);
      setResult(r);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-3 md:p-10"
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl w-full max-w-2xl border border-border shadow-card overflow-hidden"
            >
              <form onSubmit={submit} className="flex items-center gap-2 p-3 border-b border-border">
                <Search className="w-4 h-4 text-accent shrink-0" />
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Pergunte: 'quanto gastei em restaurantes em março'…"
                  className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-muted min-w-0"
                />
                {busy ? (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                ) : (
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="text-xs px-2.5 py-1 rounded-lg bg-accent-gradient text-slate-900 font-semibold disabled:opacity-40"
                  >
                    Buscar
                  </button>
                )}
                <button type="button" onClick={close} className="w-8 h-8 rounded-lg hover:bg-card-hover/50 flex items-center justify-center text-muted">
                  <X className="w-4 h-4" />
                </button>
              </form>

              <div className="max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="m-3 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2">{error}</div>
                )}

                {!result && !error && !busy && (
                  <div className="p-6 text-center text-muted text-xs">
                    <Sparkles className="w-5 h-5 mx-auto mb-2 text-accent/70" />
                    Busca em linguagem natural. Exemplos:
                    <div className="mt-2 flex flex-col gap-1 items-center">
                      <span>"quanto gastei com Uber em outubro"</span>
                      <span>"todas as entradas deste ano"</span>
                      <span>"gastos acima de 200 em lazer"</span>
                    </div>
                  </div>
                )}

                {busy && (
                  <div className="p-10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  </div>
                )}

                {result && (
                  <div className="flex flex-col">
                    {/* Filters / summary */}
                    <div className="px-4 py-3 border-b border-border bg-card-hover/20 flex flex-col gap-1.5">
                      {result.filters.resumo && (
                        <div className="text-sm text-slate-200">{result.filters.resumo}</div>
                      )}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span>
                          <strong className="text-slate-200 tabular-nums">{result.count}</strong> resultado{result.count === 1 ? '' : 's'}
                        </span>
                        <span>
                          Total: <strong className="text-slate-200 tabular-nums">{fmtMoney(result.total)}</strong>
                        </span>
                        {result.filters.tipo && result.filters.tipo !== 'all' && (
                          <span className="capitalize">Tipo: {result.filters.tipo}</span>
                        )}
                        {result.filters.categoria && <span>Categoria: {result.filters.categoria}</span>}
                        {result.filters.mes && result.filters.ano && (
                          <span>{String(result.filters.mes).padStart(2, '0')}/{result.filters.ano}</span>
                        )}
                      </div>
                    </div>

                    {/* Results list - mobile-card style */}
                    {result.items.length === 0 ? (
                      <div className="p-8 text-center text-muted text-sm">Nenhuma transação encontrada.</div>
                    ) : (
                      <div className="p-3 flex flex-col gap-2">
                        {result.items.slice(0, 50).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setEditing(t);
                            }}
                            className="text-left rounded-xl border border-border bg-card-hover/30 p-3 hover:border-accent/40 transition-colors"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-muted">{fmtDate(t.data)}</div>
                                <div className="text-sm text-slate-200 mt-0.5 truncate">{t.descricao}</div>
                              </div>
                              <span className={`tabular-nums font-semibold text-sm whitespace-nowrap inline-flex items-center gap-1 ${t.valor < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {t.valor < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {fmtMoney(t.valor)}
                              </span>
                            </div>
                            <div className="mt-2">
                              <CategoryChip categoria={t.categoria} size="sm" />
                            </div>
                          </button>
                        ))}
                        {result.items.length > 50 && (
                          <div className="text-center text-xs text-muted py-2">
                            Mostrando primeiros 50 de {result.items.length}.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TransactionEditModal
        tx={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          // re-run last search so numbers stay accurate
          if (text.trim()) submit();
        }}
      />
    </>
  );
}
