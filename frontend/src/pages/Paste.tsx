import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clipboard, AlertCircle, Check, Trash2, CheckCircle2 } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { CATEGORIAS } from '../lib/categories';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

type Item = { data: string; descricao: string; valor: number; categoria: string; selected: boolean };

export function PastePage() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extract = async () => {
    setError(null);
    setResult(null);
    if (text.trim().length < 10) return setError('Cole um texto de pelo menos 10 caracteres.');
    setBusy(true);
    try {
      const r = await api.pasteText(text);
      if (!r.items.length) setError('Nenhuma transação identificada. Tente outro trecho.');
      setItems(r.items.map((i) => ({ ...i, selected: true })));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!items) return;
    const toSend = items.filter((i) => i.selected).map(({ selected, ...rest }) => rest);
    if (!toSend.length) return setError('Nada selecionado.');
    setBusy(true);
    try {
      const r = await api.confirmUpload(toSend);
      setResult(r.count);
      setItems(null);
      setText('');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold tracking-tight">
          Colar <span className="gradient-text">texto</span>
        </h2>
        <p className="text-muted text-sm mt-1">E-mail de NF-e, confirmação de compra, qualquer texto com valores — IA extrai</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Cole aqui o texto do e-mail, NF-e ou confirmação..."
          className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button onClick={extract} disabled={busy || text.trim().length < 10}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent disabled:opacity-50">
            <Clipboard className="w-4 h-4" />
            {busy ? 'Lendo…' : 'Extrair transações'}
          </button>
          <button onClick={() => setText('')} className="text-xs text-muted hover:text-slate-200">Limpar</button>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {result != null && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-4 text-sm text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> <span>{result} transação(ões) importada(s).</span>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="flex-1">
              <div className="text-slate-100 font-semibold">Revise antes de importar</div>
              <div className="text-xs text-muted mt-0.5">{items.filter((i) => i.selected).length} de {items.length} selecionadas</div>
            </div>
            <button onClick={confirm} disabled={busy}
              className="flex items-center gap-1.5 bg-accent-gradient text-slate-900 font-semibold px-4 py-2 rounded-xl disabled:opacity-40 shadow-glow-accent">
              <Check className="w-4 h-4" />
              {busy ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
          <div className="divide-y divide-border/60">
            {items.map((p, i) => (
              <div key={i} className={`px-4 py-2 flex items-center gap-2 ${!p.selected ? 'opacity-50' : ''}`}>
                <input type="checkbox" checked={p.selected}
                  onChange={() => setItems((arr) => arr!.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                  className="w-4 h-4 accent-sky-400" />
                <span className="text-xs text-muted tabular-nums w-20">{fmtDate(p.data)}</span>
                <span className="text-sm text-slate-200 flex-1 truncate">{p.descricao}</span>
                <select value={p.categoria}
                  onChange={(e) => setItems((arr) => arr!.map((x, j) => j === i ? { ...x, categoria: e.target.value } : x))}
                  className="text-xs bg-bg-soft border border-border rounded-lg px-2 py-1 text-slate-300">
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <span className={`text-sm font-medium tabular-nums w-24 text-right ${p.valor < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{fmt(p.valor)}</span>
                <button onClick={() => setItems((arr) => arr!.filter((_, j) => j !== i))} className="text-muted hover:text-rose-400 p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
