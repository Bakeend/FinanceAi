import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Loader2, X, ArrowUpRight, ArrowDownRight, Sparkles, Calendar, Tag, BarChart3, TrendingUp, PieChart, Trophy, ChevronLeft } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { CategoryChip } from './CategoryChip';
import { TransactionEditModal } from './TransactionEditModal';
import { LunaAvatar } from './LunaAvatar';
import type { Transaction, Summary, TrendPoint } from '../lib/types';

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
const fmtAbs = (n: number) => Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

const SUGGESTIONS = [
  'quanto gastei com Uber em outubro',
  'todas as entradas deste ano',
  'gastos acima de 200 em lazer',
  'maior gasto da semana',
  'gastos do último fim de semana',
];

type Result = {
  filters: { mes?: number; ano?: number; categoria?: string; q?: string; tipo?: 'entrada' | 'gasto' | 'all'; from?: string; to?: string; resumo?: string };
  items: Transaction[];
  total: number;
  count: number;
};

type QuickViewKind = 'compare' | 'trend' | 'category' | 'top';
type QuickViewState =
  | { kind: 'compare'; loading: boolean; current?: Summary; prev?: Summary; mesC?: number; anoC?: number; mesP?: number; anoP?: number }
  | { kind: 'trend'; loading: boolean; data?: TrendPoint[] }
  | { kind: 'category'; loading: boolean; summary?: Summary; mes?: number; ano?: number }
  | { kind: 'top'; loading: boolean; items?: Transaction[]; mes?: number; ano?: number };

export function GlobalSearchBar() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [quickView, setQuickView] = useState<QuickViewState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onOpen(() => setOpen(true)), []);

  useEffect(() => {
    if (!open) return;
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
    setQuickView(null);
  };

  const startQuickView = async (kind: QuickViewKind) => {
    setError(null);
    setResult(null);
    const today = new Date();
    const mes = today.getMonth() + 1;
    const ano = today.getFullYear();
    if (kind === 'compare') {
      setQuickView({ kind: 'compare', loading: true, mesC: mes, anoC: ano });
      const prevMes = mes === 1 ? 12 : mes - 1;
      const prevAno = mes === 1 ? ano - 1 : ano;
      try {
        const [c, p] = await Promise.all([api.summary(mes, ano), api.summary(prevMes, prevAno)]);
        setQuickView({ kind: 'compare', loading: false, current: c, prev: p, mesC: mes, anoC: ano, mesP: prevMes, anoP: prevAno });
      } catch (e) { setError(friendlyError(e)); setQuickView(null); }
    } else if (kind === 'trend') {
      setQuickView({ kind: 'trend', loading: true });
      try {
        const data = await api.trend(mes, ano);
        setQuickView({ kind: 'trend', loading: false, data });
      } catch (e) { setError(friendlyError(e)); setQuickView(null); }
    } else if (kind === 'category') {
      setQuickView({ kind: 'category', loading: true, mes, ano });
      try {
        const s = await api.summary(mes, ano);
        setQuickView({ kind: 'category', loading: false, summary: s, mes, ano });
      } catch (e) { setError(friendlyError(e)); setQuickView(null); }
    } else if (kind === 'top') {
      setQuickView({ kind: 'top', loading: true, mes, ano });
      try {
        const items = await api.listTransactions(mes, ano);
        setQuickView({ kind: 'top', loading: false, items, mes, ano });
      } catch (e) { setError(friendlyError(e)); setQuickView(null); }
    }
  };

  const detectIntent = (q: string): QuickViewKind | null => {
    const s = q.toLowerCase().trim();
    if (/(comparar?|compara[çc][aã]o|vs|diferen[çc]a)\s*(mes|m[eê]s|meses)/i.test(s) || /^comparar(?:\s|$)/i.test(s)) return 'compare';
    if (/(tend[eê]ncia|[uú]ltimos\s*\d*\s*meses|6\s*meses|trend)/i.test(s)) return 'trend';
    if (/(por\s*categoria|categorias|gastos\s*por\s*categoria|onde\s+(eu\s+)?gasto)/i.test(s)) return 'category';
    if (/(top\s*gastos?|maior(?:es)?\s*gastos?|maiores\s*despesas)/i.test(s)) return 'top';
    return null;
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setQuickView(null);
    try {
      const intent = detectIntent(q);
      if (intent) {
        setBusy(false);
        await startQuickView(intent);
        return;
      }
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

  const trySuggestion = (s: string) => {
    setText(s);
    setTimeout(() => submit(), 0);
  };

  // Group results by income/expense and compute stats
  const stats = useMemo(() => {
    if (!result) return null;
    let entrada = 0, gasto = 0, gE = 0, gG = 0;
    const byCat = new Map<string, { total: number; count: number }>();
    for (const t of result.items) {
      if (t.isTransfer) continue;
      if (t.valor > 0) { entrada += t.valor; gE++; }
      else { gasto += t.valor; gG++; }
      const cur = byCat.get(t.categoria) ?? { total: 0, count: 0 };
      cur.total += t.valor;
      cur.count++;
      byCat.set(t.categoria, cur);
    }
    const topCats = [...byCat.entries()]
      .map(([categoria, v]) => ({ categoria, ...v }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 3);
    return { entrada, gasto, saldo: entrada + gasto, gE, gG, topCats };
  }, [result]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center p-3 md:p-10"
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl border border-border bg-card shadow-card overflow-hidden"
              style={{
                backgroundImage:
                  'radial-gradient(at 0% 0%, rgba(109, 40, 217, 0.18) 0%, transparent 45%), radial-gradient(at 100% 0%, rgba(236, 72, 153, 0.10) 0%, transparent 50%)',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <LunaAvatar size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-slate-100 leading-none">Procurar com a Luna</div>
                  <div className="text-[11px] text-muted mt-1">Pergunte em português, eu encontro pra você.</div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-8 h-8 rounded-lg hover:bg-card-hover flex items-center justify-center text-muted hover:text-slate-200 transition-colors"
                  aria-label="Fechar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Input */}
              <form onSubmit={submit} className="px-5 pb-4">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-bg-soft px-3.5 py-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
                  <Search className="w-4 h-4 text-accent shrink-0" />
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Pergunte qualquer coisa…"
                    className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-muted min-w-0"
                  />
                  {text && !busy && (
                    <button
                      type="button"
                      onClick={() => { setText(''); setResult(null); setError(null); inputRef.current?.focus(); }}
                      className="text-muted hover:text-slate-200 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {busy ? (
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  ) : (
                    <button
                      type="submit"
                      disabled={!text.trim()}
                      className="text-xs px-3 py-1.5 rounded-lg bg-accent-gradient text-slate-900 font-bold disabled:opacity-40 hover:bg-accent-gradient-hover transition-all"
                    >
                      Buscar
                    </button>
                  )}
                </div>
              </form>

              {/* Body */}
              <div className="max-h-[68vh] overflow-y-auto px-5 pb-5">
                {error && (
                  <div className="text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-xl p-3 mb-3">
                    {error}
                  </div>
                )}

                {!result && !error && !busy && !quickView && (
                  <EmptyState onPick={trySuggestion} onQuickView={startQuickView} />
                )}

                {quickView && (
                  <QuickViewPanel state={quickView} onBack={() => setQuickView(null)} onPickTx={(t) => setEditing(t)} />
                )}

                {busy && (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <LunaAvatar size="md" />
                    </motion.div>
                    <p className="text-xs text-muted">A Luna está procurando…</p>
                  </div>
                )}

                {result && stats && (
                  <div className="flex flex-col gap-4">
                    {/* Summary header */}
                    <div className="rounded-2xl border border-border bg-bg-soft p-4">
                      {result.filters.resumo && (
                        <div className="text-xs text-muted mb-3">{result.filters.resumo}</div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Resultados</div>
                          <div className="text-2xl font-extrabold text-slate-100 tabular-nums mt-0.5">{result.count}</div>
                        </div>
                        {stats.gE > 0 && (
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Entradas</div>
                            <div className="text-base font-extrabold text-emerald-400 tabular-nums mt-0.5">+ {fmtAbs(stats.entrada)}</div>
                            <div className="text-[10px] text-muted">{stats.gE} {stats.gE === 1 ? 'item' : 'itens'}</div>
                          </div>
                        )}
                        {stats.gG > 0 && (
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400/80">Gastos</div>
                            <div className="text-base font-extrabold text-rose-400 tabular-nums mt-0.5">- {fmtAbs(stats.gasto)}</div>
                            <div className="text-[10px] text-muted">{stats.gG} {stats.gG === 1 ? 'item' : 'itens'}</div>
                          </div>
                        )}
                      </div>
                      {stats.topCats.length > 1 && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1">Top categorias</span>
                          {stats.topCats.map((c) => (
                            <button
                              key={c.categoria}
                              onClick={() => setText((t) => `${t} categoria:${c.categoria}`.trim())}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-card hover:border-accent/50 transition-colors"
                            >
                              <Tag className="w-3 h-3 text-accent" />
                              <span className="text-slate-200">{c.categoria}</span>
                              <span className="text-muted tabular-nums">· {c.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Results list */}
                    {result.items.length === 0 ? (
                      <div className="py-10 text-center">
                        <div className="text-3xl mb-2">🤷</div>
                        <p className="text-sm text-slate-300">Nada encontrado.</p>
                        <p className="text-xs text-muted mt-1">Tenta reformular ou tirar filtros.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {result.items.slice(0, 50).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setEditing(t)}
                            className="group text-left rounded-xl border border-border bg-card-hover/30 hover:bg-card-hover hover:border-accent/40 transition-all duration-150 p-3 flex items-center gap-3"
                          >
                            {/* Type indicator */}
                            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                              t.valor < 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'
                            }`}>
                              {t.valor < 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>

                            {/* Main */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-[11px] text-muted mb-0.5">
                                <Calendar className="w-3 h-3" />
                                <span>{fmtDate(t.data)}</span>
                                <span className="opacity-50">·</span>
                                <CategoryChip categoria={t.categoria} size="sm" />
                              </div>
                              <div className="text-sm text-slate-100 truncate font-medium">{t.descricao}</div>
                            </div>

                            {/* Value */}
                            <div className={`tabular-nums font-extrabold text-sm whitespace-nowrap ${
                              t.valor < 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {t.valor < 0 ? '- ' : '+ '}{fmtAbs(t.valor)}
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
          if (text.trim()) submit();
        }}
      />
    </>
  );
}

function EmptyState({ onPick, onQuickView }: { onPick: (s: string) => void; onQuickView: (k: QuickViewKind) => void }) {
  const quickActions: { kind: QuickViewKind; label: string; sub: string; Icon: any; gradient: string }[] = [
    { kind: 'compare', label: 'Comparar meses', sub: 'mês atual vs anterior', Icon: BarChart3, gradient: 'from-violet-500/30 to-pink-500/20' },
    { kind: 'trend', label: 'Tendência', sub: 'últimos 6 meses', Icon: TrendingUp, gradient: 'from-emerald-500/30 to-violet-500/20' },
    { kind: 'category', label: 'Por categoria', sub: 'onde você gasta', Icon: PieChart, gradient: 'from-pink-500/30 to-amber-500/20' },
    { kind: 'top', label: 'Top gastos', sub: 'maiores do mês', Icon: Trophy, gradient: 'from-amber-500/30 to-rose-500/20' },
  ];
  return (
    <div className="py-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-3.5 h-3.5 text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Análises rápidas</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {quickActions.map(({ kind, label, sub, Icon, gradient }) => (
          <button
            key={kind}
            onClick={() => onQuickView(kind)}
            className={`group text-left flex items-start gap-3 p-3 rounded-2xl border border-border bg-gradient-to-br ${gradient} hover:border-accent/60 transition-all duration-150`}
          >
            <div className="w-9 h-9 rounded-xl bg-bg-soft/60 flex items-center justify-center text-accent shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-100">{label}</div>
              <div className="text-[10px] text-muted mt-0.5">{sub}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Sugestões</span>
      </div>
      <div className="flex flex-col gap-1.5 mb-5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-bg-soft hover:bg-card-hover hover:border-accent/50 transition-all duration-150"
          >
            <Search className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors shrink-0" />
            <span className="text-sm text-slate-300 group-hover:text-slate-100 truncate">{s}</span>
          </button>
        ))}
      </div>

      <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Operadores avançados</div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { op: 'categoria:Lazer', desc: 'filtra categoria' },
          { op: 'valor>200', desc: 'comparações de valor' },
          { op: 'tipo:gasto', desc: 'só gastos / entradas' },
          { op: 'mes:10 ano:2026', desc: 'período específico' },
        ].map(({ op, desc }) => (
          <div key={op} className="flex flex-col gap-0.5 p-2 rounded-lg bg-bg-soft border border-border">
            <code className="text-[11px] font-mono text-accent">{op}</code>
            <span className="text-[10px] text-muted">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function QuickViewPanel({ state, onBack, onPickTx }: { state: QuickViewState; onBack: () => void; onPickTx: (t: Transaction) => void }) {
  const titles: Record<QuickViewKind, string> = {
    compare: 'Comparar meses',
    trend: 'Tendência (6 meses)',
    category: 'Por categoria',
    top: 'Top gastos',
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-card-hover"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> voltar
        </button>
        <div className="text-sm font-bold text-slate-100">{titles[state.kind]}</div>
      </div>

      {state.loading ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        </div>
      ) : state.kind === 'compare' && state.current && state.prev ? (
        <CompareView current={state.current} prev={state.prev} mesC={state.mesC!} anoC={state.anoC!} mesP={state.mesP!} anoP={state.anoP!} />
      ) : state.kind === 'trend' && state.data ? (
        <TrendView data={state.data} />
      ) : state.kind === 'category' && state.summary ? (
        <CategoryView summary={state.summary} mes={state.mes!} ano={state.ano!} />
      ) : state.kind === 'top' && state.items ? (
        <TopView items={state.items} onPick={onPickTx} />
      ) : null}
    </div>
  );
}

function CompareView({ current, prev, mesC, anoC, mesP, anoP }: { current: Summary; prev: Summary; mesC: number; anoC: number; mesP: number; anoP: number }) {
  const labelC = `${MESES_CURTOS[mesC - 1]}/${String(anoC).slice(-2)}`;
  const labelP = `${MESES_CURTOS[mesP - 1]}/${String(anoP).slice(-2)}`;
  const rows = [
    { label: 'Entradas', curr: current.totalEntrada, prev: prev.totalEntrada, color: '#84CC16' },
    { label: 'Gastos', curr: Math.abs(current.totalGasto), prev: Math.abs(prev.totalGasto), color: '#EC4899' },
    { label: 'Saldo', curr: current.saldo, prev: prev.saldo, color: '#8B5CF6' },
  ];
  const max = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.curr), Math.abs(r.prev)]));
  return (
    <div className="rounded-2xl border border-border bg-bg-soft p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-muted">
        <span className="text-slate-300">{labelP}</span>
        <span>vs</span>
        <span className="text-accent">{labelC}</span>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const delta = r.curr - r.prev;
          const pct = r.prev !== 0 ? (delta / Math.abs(r.prev)) * 100 : null;
          return (
            <div key={r.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-semibold">{r.label}</span>
                {pct !== null && Math.abs(pct) > 0.1 && (
                  <span className={`tabular-nums font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {delta >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 items-center">
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] text-muted">{labelP}</div>
                  <div className="h-2.5 rounded-full bg-card overflow-hidden">
                    <div className="h-full rounded-full opacity-50" style={{ width: `${(Math.abs(r.prev) / max) * 100}%`, background: r.color }} />
                  </div>
                  <div className="text-[11px] tabular-nums text-slate-300">{fmtAbs(r.prev)}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] text-accent font-bold">{labelC}</div>
                  <div className="h-2.5 rounded-full bg-card overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(Math.abs(r.curr) / max) * 100}%`, background: r.color }} />
                  </div>
                  <div className="text-[11px] tabular-nums text-slate-100 font-bold">{fmtAbs(r.curr)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendView({ data }: { data: TrendPoint[] }) {
  if (!data.length) return <div className="text-center text-sm text-muted py-8">Sem dados de tendência.</div>;
  const max = Math.max(1, ...data.flatMap((d) => [d.totalEntrada, Math.abs(d.totalGasto)]));
  return (
    <div className="rounded-2xl border border-border bg-bg-soft p-4">
      <div className="flex items-center justify-between mb-4 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Entradas
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Gastos
          </span>
        </div>
      </div>
      <div className="flex items-end gap-2 h-40">
        {data.map((d, i) => {
          const hE = (d.totalEntrada / max) * 100;
          const hG = (Math.abs(d.totalGasto) / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex items-end justify-center gap-1 h-full">
                <div className="w-1/2 rounded-t-md bg-emerald-500/80 hover:bg-emerald-400 transition-colors" style={{ height: `${hE}%` }} title={`Entrada: ${fmtMoney(d.totalEntrada)}`} />
                <div className="w-1/2 rounded-t-md bg-rose-500/80 hover:bg-rose-400 transition-colors" style={{ height: `${hG}%` }} title={`Gasto: ${fmtMoney(d.totalGasto)}`} />
              </div>
              <div className="text-[10px] text-muted">{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryView({ summary, mes, ano }: { summary: Summary; mes: number; ano: number }) {
  const cats = (summary.porCategoria ?? []).filter((c) => Math.abs(c.total) > 0).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  if (cats.length === 0) return <div className="text-center text-sm text-muted py-8">Sem gastos neste mês.</div>;
  const total = cats.reduce((s, c) => s + Math.abs(c.total), 0) || 1;
  const palette = ['#8B5CF6', '#EC4899', '#84CC16', '#F472B6', '#A78BFA', '#FBBF24', '#60A5FA', '#F87171'];
  return (
    <div className="rounded-2xl border border-border bg-bg-soft p-4 flex flex-col gap-3">
      <div className="text-[11px] text-muted">{MESES_CURTOS[mes - 1]}/{ano} · {cats.length} categorias · {fmtAbs(total)}</div>
      <div className="flex flex-col gap-2.5">
        {cats.slice(0, 8).map((c, i) => {
          const pct = (Math.abs(c.total) / total) * 100;
          const color = palette[i % palette.length];
          return (
            <div key={c.categoria} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-semibold truncate">{c.categoria}</span>
                <span className="tabular-nums text-slate-300">{fmtAbs(c.total)} <span className="text-muted ml-1">{pct.toFixed(1)}%</span></span>
              </div>
              <div className="h-2.5 rounded-full bg-card overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopView({ items, onPick }: { items: Transaction[]; onPick: (t: Transaction) => void }) {
  const top = [...items]
    .filter((t) => !t.isTransfer && t.valor < 0)
    .sort((a, b) => a.valor - b.valor)
    .slice(0, 5);
  if (top.length === 0) return <div className="text-center text-sm text-muted py-8">Sem gastos para listar.</div>;
  const max = Math.max(...top.map((t) => Math.abs(t.valor)));
  return (
    <div className="rounded-2xl border border-border bg-bg-soft p-4 flex flex-col gap-2.5">
      {top.map((t, i) => {
        const pct = (Math.abs(t.valor) / max) * 100;
        return (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className="text-left flex flex-col gap-1.5 p-2.5 rounded-xl border border-border bg-card hover:border-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center text-[11px] font-extrabold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-100 truncate">{t.descricao}</div>
                <div className="text-[10px] text-muted">{fmtDate(t.data)} · {t.categoria}</div>
              </div>
              <div className="text-sm font-extrabold text-rose-400 tabular-nums whitespace-nowrap">- {fmtAbs(t.valor)}</div>
            </div>
            <div className="h-1.5 rounded-full bg-bg-soft overflow-hidden">
              <div className="h-full rounded-full bg-rose-500/70" style={{ width: `${pct}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
