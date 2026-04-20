import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, Tag, Plus, Sparkles, Scissors, Layers, ArrowLeft, Paperclip, Copy, Check, RefreshCw, History, ChevronDown } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { Account, Transaction } from '../lib/types';
import { CATEGORIAS } from '../lib/categories';
import { AmountInput } from './AmountInput';

export function TransactionEditModal({
  tx,
  onClose,
  onSaved,
  onDelete,
}: {
  tx: Transaction | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (tx: Transaction) => void | Promise<void>;
}) {
  const [data, setData] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorNum, setValorNum] = useState<number>(0);
  const [categoria, setCategoria] = useState('Outros');
  const [subcategoria, setSubcategoria] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [applyToInstallments, setApplyToInstallments] = useState(false);
  const [mode, setMode] = useState<'edit' | 'split'>('edit');
  const [splitRows, setSplitRows] = useState<{ valor: number; categoria: string; descricao: string }[]>([]);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [duplicated, setDuplicated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tagsSuggested, setTagsSuggested] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; field: string; beforeValue: string | null; afterValue: string | null; createdAt: string }> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tx) {
      setData(tx.data);
      setDescricao(tx.descricao);
      setValorNum(tx.valor);
      setCategoria(tx.categoria);
      setSubcategoria(tx.subcategoria ?? '');
      setTags(tx.tags ?? []);
      setNewTag('');
      setSuggestions([]);
      setError(null);
      setAccountId(tx.accountId ?? null);
      setApplyToInstallments(false);
      setMode('edit');
      setAttachment(tx.attachment ?? null);
      setIsRecurring(tx.isRecurring ?? false);
      const half = tx.valor / 2;
      setSplitRows([
        { valor: half, categoria: tx.categoria, descricao: '' },
        { valor: half, categoria: tx.categoria, descricao: '' },
      ]);
    }
  }, [tx]);

  useEffect(() => {
    api.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const loadHistory = async () => {
    if (!tx) return;
    setHistoryLoading(true);
    try {
      const r = await api.transactionHistory(tx.id);
      setHistory(r.edits);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && !history) loadHistory();
  };

  const loadSuggestions = async () => {
    if (!tx) return;
    setLoadingSugg(true);
    try {
      const r = await api.suggestTags(tx.id);
      setSuggestions(r.tags.filter((t) => !tags.includes(t)));
      setTagsSuggested(true);
      setTimeout(() => setTagsSuggested(false), 2000);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSugg(false);
    }
  };

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Apenas arquivos de imagem são permitidos.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.onerror = () => {
      setError('Falha ao ler o arquivo.');
    };
    reader.readAsDataURL(file);
  };

  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/^#/, '');
    if (!t || tags.includes(t) || tags.length >= 10) return;
    setTags([...tags, t]);
    setNewTag('');
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  if (!tx) return null;

  const save = async () => {
    if (valorNum === 0) { setError('Valor inválido.'); return; }
    setBusy(true);
    setError(null);
    try {
      await api.updateTransaction(tx.id, {
        data,
        descricao: descricao.trim(),
        valor: valorNum,
        categoria,
        subcategoria: subcategoria.trim() || null,
        accountId: accountId ?? null,
        attachment: attachment,
        isRecurring,
        ...(applyToInstallments && tx.installmentGroup ? { applyToInstallments: true } : {}),
      } as any);
      await api.updateTags(tx.id, tags);
      setSaved(true);
      onSaved();
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  const splitTotal = splitRows.reduce((s, r) => s + r.valor, 0);

  const addSplitRow = () => {
    setSplitRows([...splitRows, { valor: 0, categoria: tx.categoria, descricao: '' }]);
  };
  const removeSplitRow = (i: number) => {
    if (splitRows.length <= 2) return;
    setSplitRows(splitRows.filter((_, idx) => idx !== i));
  };
  const updateSplitRow = (i: number, patch: Partial<{ valor: number; categoria: string; descricao: string }>) => {
    setSplitRows(splitRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const confirmSplit = async () => {
    setError(null);
    if (splitRows.some((r) => r.valor === 0)) {
      setError('Nenhuma parcela pode ter valor zero.');
      return;
    }
    if (splitRows.some((r) => r.valor !== 0 && Math.sign(r.valor) !== Math.sign(tx.valor))) {
      setError('O sinal de cada parcela deve ser igual ao da transação original.');
      return;
    }
    const sum = splitRows.reduce((s, r) => s + r.valor, 0);
    if (Math.abs(sum - tx.valor) > 0.01) {
      setError(`A soma (${sum.toFixed(2)}) deve ser igual ao valor original (${tx.valor.toFixed(2)}).`);
      return;
    }
    const items = splitRows.map((r) => ({
      valor: r.valor,
      categoria: r.categoria,
      descricao: r.descricao.trim() || undefined,
    }));
    setBusy(true);
    try {
      await api.splitTransaction(tx.id, items);
      onSaved();
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.createManual({ data: today, descricao: tx.descricao, valor: tx.valor, categoria: tx.categoria, ...(tx.accountId ? { accountId: tx.accountId } : {}) });
      setDuplicated(true);
      onSaved();
      setTimeout(() => { setDuplicated(false); onClose(); }, 1200);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  const del = async () => {
    if (onDelete) {
      onDelete(tx);
      onClose();
      return;
    }
    if (!confirm('Excluir esta transação?')) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteTransaction(tx.id);
      onSaved();
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
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
            <div className="flex items-center gap-2">
              {mode === 'split' && (
                <button
                  onClick={() => setMode('edit')}
                  className="w-8 h-8 rounded-lg hover:bg-card-hover/50 flex items-center justify-center text-muted hover:text-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-lg font-semibold text-slate-100">
                {mode === 'edit' ? 'Editar transação' : 'Dividir transação'}
              </h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-card-hover/50 flex items-center justify-center text-muted hover:text-slate-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {mode === 'split' ? (
            <div className="flex flex-col gap-3">
              <div className="text-xs text-muted">
                Valor original: <span className="font-semibold text-slate-200 tabular-nums">{tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex flex-col gap-2">
                {splitRows.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted w-10">#{i + 1}</span>
                      <div className="flex-1 min-w-0 bg-bg-soft border border-border rounded-lg px-2 py-1.5 focus-within:border-accent">
                        <AmountInput
                          value={r.valor}
                          onChange={(v) => updateSplitRow(i, { valor: v })}
                          defaultSign={tx.valor < 0 ? '-' : '+'}
                          inputClassName="text-sm text-slate-100 tabular-nums w-full"
                        />
                      </div>
                      <select
                        value={r.categoria}
                        onChange={(e) => updateSplitRow(i, { categoria: e.target.value })}
                        className="bg-bg-soft border border-border rounded-lg px-2 py-1.5 text-sm text-slate-100 cursor-pointer focus:border-accent focus:outline-none"
                      >
                        {CATEGORIAS.map((c) => (<option key={c}>{c}</option>))}
                      </select>
                      {splitRows.length > 2 && (
                        <button
                          onClick={() => removeSplitRow(i)}
                          className="w-7 h-7 rounded-lg border border-rose-700/50 text-rose-400 hover:bg-rose-900/20 flex items-center justify-center shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={r.descricao}
                      onChange={(e) => updateSplitRow(i, { descricao: e.target.value })}
                      placeholder="Descrição (opcional)"
                      className="bg-bg-soft border border-border rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={addSplitRow}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-accent hover:bg-accent/10 border border-dashed border-accent/40 rounded-xl py-2"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar linha
              </button>

              <div className={`text-xs rounded-lg p-2.5 border ${
                Math.abs(splitTotal - tx.valor) < 0.01
                  ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-700/40 bg-amber-500/10 text-amber-300'
              }`}>
                Total dividido:{' '}
                <span className="font-semibold tabular-nums">
                  {splitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>{' '}
                /{' '}
                <span className="font-semibold tabular-nums">
                  {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>

              {error && <div className="text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2">{error}</div>}

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setMode('edit')}
                  disabled={busy}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-card text-slate-200 hover:bg-card-hover text-sm font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmSplit}
                  disabled={busy || Math.abs(splitTotal - tx.valor) > 0.01}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold disabled:opacity-50 shadow-glow-accent"
                >
                  <Scissors className="w-4 h-4" />
                  <span className="text-sm">{busy ? 'Dividindo…' : 'Confirmar divisão'}</span>
                </button>
              </div>
            </div>
          ) : (
          <>
          <div className="flex flex-col gap-3">
            {tx.installmentGroup && tx.installmentNum && tx.installmentTotal && (
              <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
                <Layers className="w-3.5 h-3.5" />
                <span className="font-semibold">Parcela {tx.installmentNum}/{tx.installmentTotal}</span>
              </div>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Data</span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Descrição</span>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Valor</span>
              <div className="bg-card border border-border rounded-xl px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                <AmountInput
                  value={valorNum}
                  onChange={setValorNum}
                  inputClassName="text-sm text-slate-100 tabular-nums"
                />
              </div>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Categoria</span>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 cursor-pointer focus:border-accent focus:outline-none"
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Subcategoria</span>
                <input
                  type="text"
                  placeholder="ex: Delivery, CDB, Uber"
                  value={subcategoria}
                  onChange={(e) => setSubcategoria(e.target.value)}
                  className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
                />
              </label>
            </div>

            {accounts.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Conta</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAccountId(null)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-all ${
                      accountId === null
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-border bg-card text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    Sem conta
                  </button>
                  {accounts.map((a) => {
                    const active = accountId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAccountId(a.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-all ${
                          active
                            ? 'border-accent/50 bg-accent/10 text-accent'
                            : 'border-border bg-card text-slate-300 hover:text-slate-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.cor }} />
                        <span className="truncate max-w-[120px]">{a.nome}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tx.installmentGroup && (
              <label className="flex items-center gap-2 text-xs text-slate-300 bg-bg-soft border border-border rounded-xl px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToInstallments}
                  onChange={(e) => setApplyToInstallments(e.target.checked)}
                  className="w-3.5 h-3.5 accent-accent"
                />
                <span>Aplicar categoria/conta a todas as parcelas</span>
              </label>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-300 bg-bg-soft border border-border rounded-xl px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-3.5 h-3.5 accent-accent"
              />
              <RefreshCw className="w-3.5 h-3.5 text-accent" />
              <span>Recorrente — relançar todo mês automaticamente</span>
            </label>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tags
                </span>
                <button
                  onClick={loadSuggestions}
                  disabled={loadingSugg}
                  className={`text-[10px] hover:underline inline-flex items-center gap-1 disabled:opacity-50 transition-colors duration-200 ${tagsSuggested ? 'text-emerald-400' : 'text-accent'}`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={tagsSuggested ? 'check' : 'spark'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center">
                      {tagsSuggested ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                    </motion.span>
                  </AnimatePresence>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={tagsSuggested ? 'done' : loadingSugg ? 'loading' : 'idle'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      {tagsSuggested ? 'Sugeridas!' : loadingSugg ? 'Sugerindo…' : 'Sugerir tags'}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>
              <div className="bg-card border border-border rounded-xl p-2 flex flex-wrap gap-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 bg-accent/15 text-accent text-xs rounded-full px-2 py-0.5">
                    #{t}
                    <button onClick={() => removeTag(t)} className="hover:text-rose-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[100px]">
                  <input
                    type="text"
                    placeholder={tags.length === 0 ? 'viagem, trabalho…' : 'adicionar…'}
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
                      if (e.key === 'Backspace' && !newTag && tags.length) removeTag(tags[tags.length - 1]);
                    }}
                    className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-muted min-w-0"
                  />
                  {newTag && (
                    <button onClick={addTag} className="text-accent hover:bg-accent/10 rounded p-0.5">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] text-muted w-full">Sugestões:</span>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setTags([...tags, s]); setSuggestions(suggestions.filter((x) => x !== s)); }}
                      className="inline-flex items-center gap-1 bg-slate-700/50 text-slate-300 text-[11px] rounded-full px-2 py-0.5 border border-border hover:border-accent/50 hover:bg-accent/10 hover:text-accent"
                    >
                      <Plus className="w-2.5 h-2.5" /> #{s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Anexo */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> Anexo
              </span>
              {attachment ? (
                <div className="relative rounded-xl border border-border bg-card overflow-hidden flex flex-col gap-2 p-2">
                  <img src={attachment} alt="Anexo" className="max-h-48 w-full object-contain rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="self-end inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-rose-700/50 text-rose-400 hover:bg-rose-900/20"
                  >
                    <X className="w-3 h-3" /> Remover
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-200 hover:bg-accent/10 border border-dashed border-border hover:border-accent/40 rounded-xl py-2"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-accent" /> Anexar foto/nota
                  </button>
                  <span className="text-[10px] text-muted">Imagem até 2MB</span>
                </>
              )}
            </div>
          </div>

          {/* History disclosure */}
          <div className="mt-3 rounded-xl border border-border bg-bg-soft overflow-hidden">
            <button
              type="button"
              onClick={toggleHistory}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-card-hover/50"
              aria-expanded={historyOpen}
            >
              <History className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Histórico de edições</span>
              {history && (
                <span className="text-[10px] text-muted">· {history.length}</span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-muted ml-auto transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {historyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {historyLoading ? (
                      <div className="text-xs text-muted text-center py-3">Carregando…</div>
                    ) : !history || history.length === 0 ? (
                      <div className="text-xs text-muted text-center py-3">Sem edições registradas.</div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {history.map((h) => (
                          <div key={h.id} className="text-[11px] flex flex-col gap-0.5 px-2 py-1.5 rounded-lg bg-card border border-border/60">
                            <div className="flex items-center gap-2">
                              <span className="text-accent font-bold uppercase tracking-wider text-[9px]">{h.field}</span>
                              <span className="text-muted ml-auto">{new Date(h.createdAt).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex items-center gap-1 truncate">
                              <span className="text-rose-300/80 line-through truncate max-w-[40%]" title={h.beforeValue ?? ''}>{h.beforeValue ?? '∅'}</span>
                              <span className="text-muted">→</span>
                              <span className="text-emerald-300 truncate max-w-[40%]" title={h.afterValue ?? ''}>{h.afterValue ?? '∅'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && <div className="mt-3 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2">{error}</div>}

          <div className="flex gap-2 mt-5">
            <button
              onClick={del}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-rose-700/50 text-rose-400 hover:bg-rose-900/20 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Excluir</span>
            </button>
            <button
              onClick={duplicate}
              disabled={busy}
              title="Duplicar com data de hoje"
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 disabled:opacity-50 ${
                duplicated
                  ? 'border-emerald-600/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-border bg-card text-slate-200 hover:bg-card-hover'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={duplicated ? 'check' : 'copy'}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center"
                >
                  {duplicated ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </motion.span>
              </AnimatePresence>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={duplicated ? 'done' : 'label'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-sm font-medium hidden sm:inline"
                >
                  {duplicated ? 'Duplicado!' : 'Duplicar'}
                </motion.span>
              </AnimatePresence>
            </button>
            <button
              onClick={() => setMode('split')}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card text-slate-200 hover:bg-card-hover disabled:opacity-50 transition-colors"
            >
              <Scissors className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Dividir</span>
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold disabled:opacity-50 shadow-glow-accent overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={saved ? 'check' : 'save'}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center"
                >
                  {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                </motion.span>
              </AnimatePresence>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={saved ? 'saved' : busy ? 'saving' : 'idle'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-sm"
                >
                  {saved ? 'Salvo!' : busy ? 'Salvando…' : 'Salvar'}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
          </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
