import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, AlertCircle, Sparkles, ArrowRight, Trash2, Check, Image as ImageIcon } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { Transaction } from '../lib/types';
import { CATEGORIAS } from '../lib/categories';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

type PreviewItem = { data: string; descricao: string; valor: number; categoria: string; selected: boolean; attachment?: string };

export function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [result, setResult] = useState<{ count: number; skipped: number; items: Transaction[] } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dominantMonth = useMemo(() => {
    const src = result?.items ?? preview;
    if (!src?.length) return null;
    const counts: Record<string, number> = {};
    for (const t of src) {
      const key = t.data.slice(0, 7);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    const [y, m] = top[0].split('-').map(Number);
    return { mes: m, ano: y };
  }, [preview, result]);

  const [imageMode, setImageMode] = useState<'receipt' | 'screenshot'>('receipt');

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true); setError(null); setPreview(null); setResult(null); setWarning(null);
    try {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length) {
        const items: PreviewItem[] = [];
        let lastWarn: string | null = null;
        for (const img of images) {
          if (imageMode === 'screenshot') {
            const dataUrl = await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(String(r.result));
              r.onerror = () => rej(r.error);
              r.readAsDataURL(img);
            });
            const r = await api.ocrScreenshot(dataUrl);
            for (const it of r.items) items.push({ ...it, selected: true });
          } else {
            const r = await api.uploadReceipt(img);
            if (r.aiWarning) lastWarn = r.aiWarning;
            items.push({ ...r.item, selected: true });
          }
        }
        setPreview(items);
        setWarning(lastWarn);
      } else {
        const r = await api.previewFile(files[0]);
        setPreview(r.items.map((i) => ({ ...i, selected: true })));
        setWarning(r.aiWarning);
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }, [imageMode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
      'application/x-ofx': ['.ofx', '.qfx'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
    },
    multiple: true,
  });

  const toggleOne = (i: number) => setPreview((p) => p && p.map((x, idx) => idx === i ? { ...x, selected: !x.selected } : x));
  const toggleAll = () => setPreview((p) => p && p.map((x) => ({ ...x, selected: !p.every((y) => y.selected) })));
  const updateCat = (i: number, cat: string) => setPreview((p) => p && p.map((x, idx) => idx === i ? { ...x, categoria: cat } : x));
  const removeRow = (i: number) => setPreview((p) => p && p.filter((_, idx) => idx !== i));

  const confirm = async () => {
    if (!preview) return;
    const items = preview.filter((p) => p.selected).map(({ selected, ...rest }) => rest);
    if (!items.length) return setError('Selecione pelo menos uma linha.');
    setBusy(true); setError(null);
    try {
      const r = await api.confirmUpload(items);
      setResult({ count: r.count, skipped: r.skipped, items: r.transactions });
      setPreview(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const allSelected = preview?.every((p) => p.selected);
  const selectedCount = preview?.filter((p) => p.selected).length ?? 0;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold tracking-tight">
          Upload de <span className="gradient-text">extrato</span>
        </h2>
        <p className="text-muted text-sm mt-1">Envie CSV ou PDF, revise e confirme o que quer importar</p>
      </motion.div>

      {!preview && !result && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Ao enviar imagem:</span>
          <button
            onClick={() => setImageMode('receipt')}
            className={`px-2.5 py-1 rounded-lg border transition ${imageMode === 'receipt' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-card text-slate-300'}`}
          >
            Comprovante (1 tx)
          </button>
          <button
            onClick={() => setImageMode('screenshot')}
            className={`px-2.5 py-1 rounded-lg border transition ${imageMode === 'screenshot' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-card text-slate-300'}`}
          >
            Screenshot (várias tx)
          </button>
        </div>
      )}
      {!preview && !result && (
        <div
          {...getRootProps()}
          className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-10 min-h-[260px] flex items-center justify-center text-center cursor-pointer transition-all duration-300 touch-manipulation
            ${isDragActive
              ? 'border-accent bg-accent/10 shadow-glow-accent scale-[1.01]'
              : 'border-border bg-card hover:border-accent/50 hover:bg-card-hover/40'}`}
        >
          <input {...getInputProps()} />
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10">
            <motion.div
              animate={isDragActive ? { y: [-4, 4, -4], scale: 1.1 } : { y: 0, scale: 1 }}
              transition={{ duration: 1.5, repeat: isDragActive ? Infinity : 0, ease: 'easeInOut' }}
              className="mx-auto w-16 h-16 rounded-2xl bg-accent-gradient flex items-center justify-center shadow-glow-accent mb-4"
            >
              <UploadCloud className="w-8 h-8 text-slate-900" />
            </motion.div>
            <p className="text-slate-200 text-base font-medium">
              {isDragActive ? 'Pode soltar!' : 'Arraste um arquivo ou clique para selecionar'}
            </p>
            <p className="text-xs text-muted mt-2">CSV, OFX, PDF ou imagens (comprovantes / screenshots)</p>
            <p className="text-[10px] text-muted mt-1">Várias imagens podem ser enviadas de uma vez</p>
          </motion.div>
        </div>
      )}

      {busy && !preview && (
        <div className="rounded-2xl border border-accent/30 bg-card p-5 flex items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            <Sparkles className="w-4 h-4 text-accent absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <div className="text-slate-200 font-medium">Processando…</div>
            <div className="text-xs text-muted mt-0.5">Extraindo transações e sugerindo categorias</div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* Preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
              <div className="flex-1">
                <div className="text-slate-100 font-semibold">Revise antes de importar</div>
                <div className="text-xs text-muted mt-0.5">{selectedCount} de {preview.length} selecionadas{warning ? ` · ${warning}` : ''}</div>
              </div>
              <button onClick={toggleAll} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-accent/50 text-slate-300">
                {allSelected ? 'Desmarcar tudo' : 'Marcar tudo'}
              </button>
              <button
                onClick={confirm}
                disabled={busy || selectedCount === 0}
                className="flex items-center gap-1.5 bg-accent-gradient text-slate-900 font-semibold px-4 py-2 rounded-xl disabled:opacity-40 shadow-glow-accent"
              >
                <Check className="w-4 h-4" />
                {busy ? 'Salvando…' : `Confirmar ${selectedCount}`}
              </button>
            </div>
            <div className="max-h-[28rem] overflow-y-auto divide-y divide-border/60">
              {preview.map((p, i) => (
                <div key={i} className={`px-4 py-2 flex items-center gap-2 ${!p.selected ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={() => toggleOne(i)}
                    className="w-4 h-4 accent-sky-400"
                  />
                  {p.attachment && (
                    <img src={p.attachment} alt="" className="w-8 h-8 rounded-lg object-cover border border-border shrink-0" />
                  )}
                  <span className="text-xs text-muted tabular-nums w-20">{fmtDate(p.data)}</span>
                  <span className="text-sm text-slate-200 flex-1 truncate flex items-center gap-1">
                    {p.attachment && <ImageIcon className="w-3 h-3 text-emerald-400 shrink-0" />}
                    {p.descricao}
                  </span>
                  <select
                    value={p.categoria}
                    onChange={(e) => updateCat(i, e.target.value)}
                    className="text-xs bg-bg-soft border border-border rounded-lg px-2 py-1 text-slate-300"
                  >
                    {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className={`text-sm font-medium tabular-nums w-24 text-right ${p.valor < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fmt(p.valor)}
                  </span>
                  <button onClick={() => removeRow(i)} className="text-muted hover:text-rose-400 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-emerald-700/40 bg-card overflow-hidden"
          >
            <div className="p-5 bg-emerald-500/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="text-slate-100 font-semibold">
                  {result.count} nova{result.count === 1 ? '' : 's'}
                  {result.skipped > 0 && <span className="text-amber-300"> · {result.skipped} duplicada{result.skipped === 1 ? '' : 's'} ignorada{result.skipped === 1 ? '' : 's'}</span>}
                </div>
                <div className="text-xs text-muted">Transações importadas com sucesso</div>
              </div>
              {dominantMonth && (
                <Link
                  to="/"
                  state={{ mes: dominantMonth.mes, ano: dominantMonth.ano }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 text-xs font-semibold shadow-glow-accent hover:scale-105 transition-transform"
                >
                  Ver {MESES[dominantMonth.mes - 1]} {dominantMonth.ano}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
