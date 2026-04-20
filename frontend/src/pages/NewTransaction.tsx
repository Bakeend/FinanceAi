import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertCircle, Sparkles, Wand2, Layers, Camera, Paperclip, ChevronDown, RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { api, friendlyError } from '../lib/api';
import type { Account } from '../lib/types';
import { CATEGORIAS } from '../lib/categories';


function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function NewTransactionPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [tipo, setTipo] = useState<'gasto' | 'entrada'>('gasto');
  const [data, setData] = useState(today);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('Outros');
  const [nlText, setNlText] = useState('');
  const [nlBusy, setNlBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ mes: number; ano: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [installments, setInstallments] = useState(2);
  const [isRecurring, setIsRecurring] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [accountInfo, setAccountInfo] = useState<string | null>(null);
  const [nlOpen, setNlOpen] = useState(false);

  useEffect(() => {
    api.listAccounts()
      .then((list) => {
        setAccounts(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) setAccountId(def.id);
      })
      .catch(() => {
        setAccounts([]);
      });
  }, []);

  const onReceiptFile = async (file: File) => {
    if (!file) return;
    setOcrBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = await api.ocrReceipt(dataUrl);
      if (r.data) setData(r.data);
      const desc = r.estabelecimento ? `${r.estabelecimento} — ${r.descricao}`.slice(0, 100) : r.descricao;
      setDescricao(desc);
      if (r.valor != null) {
        setValor(String(Math.abs(r.valor)).replace('.', ','));
        setTipo(r.valor < 0 ? 'gasto' : 'entrada');
      }
      setCategoria(r.categoria);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setOcrBusy(false);
    }
  };

  const parseNL = async () => {
    const text = nlText.trim();
    if (!text) return;
    setNlBusy(true);
    setError(null);
    try {
      const r = await api.parseTx(text);
      if ('error' in r) { setError(r.error); return; }
      setData(r.data);
      setDescricao(r.descricao);
      setValor(String(Math.abs(r.valor)));
      setCategoria(r.categoria);
      setTipo(r.valor < 0 ? 'gasto' : 'entrada');
      if (r.conta) {
        const { account, created } = await api.findOrCreateAccount(r.conta);
        setAccountId(account.id);
        if (created) { setAccountInfo(`Conta "${account.nome}" criada automaticamente`); setTimeout(() => setAccountInfo(null), 4000); }
      }
      setNlText('');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setNlBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);
    
    let raw = valor.replace(/[^\d,.-]/g, '');
    if (raw.includes(',') && raw.includes('.')) {
      if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
        raw = raw.replace(/\./g, '').replace(',', '.');
      } else {
        raw = raw.replace(/,/g, '');
      }
    } else if (raw.includes(',')) {
      raw = raw.replace(',', '.');
    }
    const v = Number(raw);

    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return setError('Data inválida');
    if (!descricao.trim()) return setError('Descrição obrigatória');
    if (Number.isNaN(v) || v === 0) return setError('Valor inválido. Use vírgula para centavos.');
    const valorFinal = tipo === 'gasto' ? -Math.abs(v) : Math.abs(v);

    setBusy(true);
    try {
      const r = await api.createManual({
        data,
        descricao: descricao.trim(),
        valor: valorFinal,
        categoria,
        ...(accountId ? { accountId } : {}),
        ...(installmentsEnabled && installments >= 2 && installments <= 60 ? { installments } : {}),
        ...(isRecurring ? { isRecurring: true } : {}),
      });
      if (!r.saved && r.skipped > 0) {
        setError('Já existe uma transação idêntica (mesma data + descrição + valor).');
        return;
      }
      const [y, m] = data.split('-').map(Number);
      setSuccess({ mes: m, ano: y });
      setDescricao('');
      setValor('');
      setTimeout(() => navigate('/', { state: { mes: m, ano: y } }), 1200);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold tracking-tight">
          Nova <span className="gradient-text">transação</span>
        </h2>
        <p className="text-muted text-sm mt-1">Entrada ou gasto manual — sem passar por upload</p>
      </motion.div>

      {/* Quick actions: único card "Preencher com Luna" */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent overflow-hidden"
      >
        {/* Header toggle */}
        <button
          type="button"
          onClick={() => { setNlOpen((o) => !o); setOcrOpen(false); }}
          className="w-full flex items-center gap-2 p-3 text-left hover:bg-violet-500/5 transition-colors"
          aria-expanded={nlOpen || ocrOpen}
        >
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm text-slate-200 font-semibold">Preencher com a Luna</span>
          <span className="text-[10px] text-muted hidden sm:inline">Texto ou foto — a Luna preenche o formulário</span>
          <ChevronDown className={`w-4 h-4 text-violet-400 ml-auto transition-transform ${(nlOpen || ocrOpen) ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence initial={false}>
          {(nlOpen || ocrOpen) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 flex flex-col gap-3">
                {/* Mode selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setNlOpen(true); setOcrOpen(false); }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-all ${
                      nlOpen
                        ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                        : 'border-border bg-bg-soft text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Wand2 className="w-4 h-4" />
                    Descrever em texto
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOcrOpen(true); setNlOpen(false); }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-all ${
                      ocrOpen
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                        : 'border-border bg-bg-soft text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    Foto de recibo
                  </button>
                </div>

                {/* NL text mode */}
                <AnimatePresence mode="wait">
                  {nlOpen && (
                    <motion.div
                      key="nl"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex gap-2"
                    >
                      <input
                        autoFocus
                        value={nlText}
                        onChange={(e) => setNlText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && parseNL()}
                        placeholder='ex: "gastei 50 no almoço hoje"'
                        className="flex-1 bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-muted focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
                      />
                      <button
                        onClick={parseNL}
                        disabled={nlBusy || !nlText.trim()}
                        className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50 shadow-[0_0_30px_-10px_rgba(167,139,250,0.6)]"
                      >
                        <Sparkles className="w-4 h-4" />
                        {nlBusy ? 'Lendo…' : 'Preencher'}
                      </button>
                    </motion.div>
                  )}

                  {/* OCR / photo mode */}
                  {ocrOpen && (
                    <motion.div
                      key="ocr"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="grid grid-cols-2 gap-2"
                    >
                      <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors ${ocrBusy ? 'border-emerald-500/50 bg-emerald-500/10 pointer-events-none' : 'border-emerald-500/30 bg-bg-soft hover:border-emerald-400/60 hover:bg-emerald-500/5'}`}>
                        {ocrBusy ? (
                          <div className="w-4 h-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4 text-emerald-300" />
                        )}
                        <span className="text-sm text-emerald-300 font-medium">{ocrBusy ? 'Lendo…' : 'Tirar foto'}</span>
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) onReceiptFile(f); e.target.value = ''; }} />
                      </label>
                      <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors ${ocrBusy ? 'border-emerald-500/50 bg-emerald-500/10 pointer-events-none' : 'border-emerald-500/30 bg-bg-soft hover:border-emerald-400/60 hover:bg-emerald-500/5'}`}>
                        <Paperclip className="w-4 h-4 text-emerald-300" />
                        <span className="text-sm text-emerald-300 font-medium">Anexar arquivo</span>
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) onReceiptFile(f); e.target.value = ''; }} />
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4"
      >
        {/* Tipo toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTipo('gasto')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
              tipo === 'gasto'
                ? 'border-rose-500/50 bg-rose-500/15 text-rose-300 shadow-glow-rose'
                : 'border-border bg-bg-soft text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span className="font-medium">Gasto</span>
          </button>
          <button
            onClick={() => setTipo('entrada')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
              tipo === 'entrada'
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-glow-emerald'
                : 'border-border bg-bg-soft text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span className="font-medium">Entrada</span>
          </button>
        </div>

        {/* Valor em destaque */}
        <div>
          <label className="text-xs text-muted uppercase tracking-wider">Valor</label>
          <div className="mt-1 flex items-center gap-2 bg-bg-soft border border-border rounded-xl px-4 py-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <span className="text-muted text-lg">R$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`flex-1 bg-transparent text-2xl font-bold tabular-nums outline-none ${
                tipo === 'gasto' ? 'text-rose-300' : 'text-emerald-300'
              }`}
            />
          </div>
        </div>

        {/* Parcelamento */}
        {tipo === 'gasto' && (
          <div className="rounded-xl border border-border bg-bg-soft p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={installmentsEnabled}
                onChange={(e) => setInstallmentsEnabled(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <Layers className="w-4 h-4 text-accent" />
              <span className="text-sm text-slate-200 font-medium">Parcelar em várias vezes</span>
            </label>
            {installmentsEnabled && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Parcelas</span>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={installments}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n)) setInstallments(Math.max(2, Math.min(60, n)));
                    }}
                    className="w-20 bg-card border border-border rounded-lg px-2 py-1 text-sm text-slate-100 focus:border-accent focus:outline-none"
                  />
                  <span className="text-xs text-muted">(2 a 60)</span>
                </div>
                {(() => {
                  const raw = valor.replace(/\s/g, '').replace(',', '.');
                  const v = Number(raw);
                  if (!Number.isNaN(v) && v > 0) {
                    const per = v / installments;
                    return (
                      <div className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                        {installments}x de {per.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        )}

        {/* Recorrente */}
        <div className="rounded-xl border border-border bg-bg-soft p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            <RefreshCw className="w-4 h-4 text-accent" />
            <div className="flex flex-col">
              <span className="text-sm text-slate-200 font-medium">Transação recorrente</span>
              {isRecurring && <span className="text-[11px] text-muted">Lançada automaticamente todo mês</span>}
            </div>
          </label>
        </div>

        {/* Conta */}
        {accounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted uppercase tracking-wider">Conta</span>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => {
                const active = accountId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAccountId(a.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
                      active
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-border bg-card text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: a.cor }}
                    />
                    <span className="truncate max-w-[140px]">{a.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Data</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Categoria</span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 cursor-pointer focus:border-accent focus:outline-none"
            >
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted uppercase tracking-wider">Descrição</span>
          <input
            type="text"
            placeholder={tipo === 'gasto' ? 'ex: Almoço no Zé do Prato' : 'ex: Salário'}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>

        {accountInfo && (
          <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
            <span>✓ {accountInfo}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Transação adicionada — redirecionando para o Dashboard…</span>
          </motion.div>
        )}

        <motion.button
          onClick={submit}
          disabled={busy}
          whileTap={{ scale: 0.98 }}
          className="mt-2 flex items-center justify-center gap-2 bg-accent-gradient text-slate-900 font-semibold px-4 py-3 rounded-xl disabled:opacity-50 shadow-glow-accent"
        >
          <Plus className="w-4 h-4" />
          {busy ? 'Salvando…' : 'Adicionar transação'}
        </motion.button>
      </motion.div>
    </div>
  );
}
