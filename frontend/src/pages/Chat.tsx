import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, User, AlertCircle, Trash2, Copy, RefreshCw, Check,
  Lightbulb, TrendingUp, CreditCard, BarChart3, ChevronDown, Loader2,
} from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import { LunaAvatar } from '../components/LunaAvatar';
import { VoiceInput } from '../components/VoiceInput';
import { useLunaTTS, TTSButton } from '../components/LunaTTS';
import { YearlyProjectionCard } from '../components/YearlyProjectionCard';
import type { MonthRef } from '../lib/types';

type Msg = { role: 'user' | 'assistant'; content: string };

/* ─ Subscriptions types ─ */
type SubItem = { descricao: string; categoria: string; mediaMensal: number; totalAnualEstimado: number; mesesDetectados: number; lastSeen?: string; inactive?: boolean };
type SubData = { assinaturas: SubItem[]; totalMensal: number; ativas?: SubItem[]; inativas?: SubItem[]; economiaPotencialAnual?: number };

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SUGGESTIONS = [
  'Onde estou gastando mais?',
  'Como economizar em alimentação?',
  'Meus gastos estão aumentando?',
];

/* ── Collapsible Insights Panel ── */
function InsightsPanel({ mes, ano }: { mes: number; ano: number }) {
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [forecast, setForecast] = useState<{ texto: string; valorEstimado: number | null } | null>(null);
  const [subData, setSubData] = useState<SubData | null>(null);
  const [busy, setBusy] = useState<'analyze' | 'forecast' | 'subs' | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);

  const run = async (kind: 'analyze' | 'forecast') => {
    setBusy(kind);
    try {
      if (kind === 'analyze') setAnalysis((await api.analyze(mes, ano)).texto);
      else setForecast(await api.forecast(mes, ano));
    } catch { }
    finally { setBusy(null); }
  };

  const loadSubs = async () => {
    if (subLoaded) return;
    setBusy('subs');
    try { setSubData(await api.subscriptions() as SubData); setSubLoaded(true); }
    catch { } finally { setBusy(null); }
  };

  useEffect(() => { if (open) loadSubs(); }, [open]);

  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-card-hover/30 transition-colors"
      >
        <BarChart3 className="w-4 h-4 text-accent shrink-0" />
        <span className="text-sm font-semibold text-slate-200 flex-1">Insights e análises da Luna</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-4">
              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  onClick={() => run('analyze')}
                  disabled={busy !== null}
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 p-3 rounded-xl border border-accent/30 bg-accent/10 text-left disabled:opacity-60 hover:bg-accent/15 transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                    {busy === 'analyze' ? <Loader2 className="w-4 h-4 text-accent animate-spin" /> : <Lightbulb className="w-4 h-4 text-accent" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{busy === 'analyze' ? 'Analisando…' : 'Análise do mês'}</div>
                    <div className="text-[10px] text-muted">Dicas de economia</div>
                  </div>
                </motion.button>

                <motion.button
                  onClick={() => run('forecast')}
                  disabled={busy !== null}
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 p-3 rounded-xl border border-violet-500/30 bg-violet-500/10 text-left disabled:opacity-60 hover:bg-violet-500/15 transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                    {busy === 'forecast' ? <Loader2 className="w-4 h-4 text-violet-400 animate-spin" /> : <TrendingUp className="w-4 h-4 text-violet-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{busy === 'forecast' ? 'Prevendo…' : 'Previsão'}</div>
                    <div className="text-[10px] text-muted">Próximo mês</div>
                  </div>
                </motion.button>
              </div>

              {/* Analysis result */}
              <AnimatePresence>
                {analysis && (
                  <motion.div key="analysis" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-accent" />
                      <span className="text-xs font-semibold text-accent uppercase tracking-wider">Análise do mês</span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{analysis}</p>
                  </motion.div>
                )}
                {forecast && (
                  <motion.div key="forecast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Previsão do próximo mês</span>
                    </div>
                    {forecast.valorEstimado !== null && (
                      <div className="text-2xl font-bold gradient-text tabular-nums mb-2">{fmt(forecast.valorEstimado)}</div>
                    )}
                    <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{forecast.texto}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Yearly projection */}
              <YearlyProjectionCard mes={mes} ano={ano} />

              {/* Subscriptions */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-amber-500/5">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200 flex-1">Assinaturas detectadas</span>
                  {busy === 'subs' && <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />}
                </div>
                {busy === 'subs' ? (
                  <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 text-muted animate-spin" /></div>
                ) : !subData || ((subData.ativas ?? subData.assinaturas ?? []).length === 0 && (subData.inativas ?? []).length === 0) ? (
                  <div className="p-4 text-sm text-muted">Nenhuma cobrança recorrente detectada.</div>
                ) : (() => {
                  const ativas = subData.ativas ?? subData.assinaturas?.filter((a) => !a.inactive) ?? [];
                  const inativas = subData.inativas ?? [];
                  return (
                    <div>
                      {inativas.length > 0 && (
                        <div className="px-4 py-3 border-b border-rose-500/20 bg-rose-500/5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-2">
                            {inativas.length} possível{inativas.length > 1 ? 'is' : ''} esquecida{inativas.length > 1 ? 's' : ''}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {inativas.map((a) => (
                              <div key={'i-' + a.descricao} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-bg-soft border border-rose-500/20">
                                <div className="min-w-0">
                                  <div className="text-sm text-slate-200 truncate">{a.descricao}</div>
                                  <div className="text-xs text-muted">{a.lastSeen ? a.lastSeen.split('-').reverse().join('/') : '—'}</div>
                                </div>
                                <div className="text-sm font-semibold text-rose-400 tabular-nums shrink-0">{fmt(a.mediaMensal)}/mês</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="divide-y divide-border/60">
                        {ativas.map((a) => (
                          <div key={a.descricao} className="px-4 py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm text-slate-200 truncate">{a.descricao}</div>
                              <div className="text-xs text-muted">{a.mesesDetectados} meses</div>
                            </div>
                            <div className="text-sm font-semibold text-amber-400 tabular-nums shrink-0">{fmt(a.mediaMensal)}/mês</div>
                          </div>
                        ))}
                      </div>
                      {subData.totalMensal > 0 && (
                        <div className="px-4 py-2.5 border-t border-border flex justify-between items-center">
                          <span className="text-xs text-muted">Total mensal</span>
                          <span className="text-sm font-bold text-amber-400 tabular-nums">{fmt(subData.totalMensal)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatPage() {
  const today = new Date();
  const [ref, setRef] = useState<MonthRef>({ mes: today.getMonth() + 1, ano: today.getFullYear() });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const tts = useLunaTTS();
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  const copyMsg = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { }
  };

  const regenerate = async (idx: number) => {
    if (busy) return;
    let userIdx = idx - 1;
    while (userIdx >= 0 && messages[userIdx].role !== 'user') userIdx--;
    if (userIdx < 0) return;
    const userMsg = messages[userIdx];
    const history = messages.slice(0, userIdx);
    setMessages(history.concat(userMsg));
    setBusy(true); setError(null);
    try {
      const r = await api.chat(userMsg.content, history.slice(-10) as any, ref);
      setMessages((m) => [...m, { role: 'assistant', content: r.resposta }]);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => { api.chatHistory().then((h) => setMessages(h as Msg[])).catch(() => { }); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const clearHistory = async () => {
    if (!confirm('Apagar todo o histórico do chat?')) return;
    await api.clearChatHistory();
    setMessages([]);
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userMsg: Msg = { role: 'user', content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput(''); setBusy(true); setError(null);
    try {
      const r = await api.chat(trimmed, [...messages, userMsg].slice(-10), ref);
      setMessages((m) => [...m, { role: 'assistant', content: r.resposta }]);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] max-w-3xl mx-auto gap-3">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Luna <span className="gradient-text">&amp; Insights</span>
          </h2>
          <p className="text-muted text-sm mt-1">Converse com a Luna ou explore as análises do seu mês</p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={clearHistory} title="Limpar histórico"
              className="w-9 h-9 rounded-xl border border-border bg-card hover:bg-rose-500/10 hover:border-rose-500/50 text-rose-400 flex items-center justify-center transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <MonthSelector value={ref} onChange={setRef} />
        </div>
      </motion.div>


      {/* Chat area */}
      <div className="flex-1 rounded-2xl border border-border bg-card p-4 overflow-y-auto flex flex-col gap-3 min-h-0">
        {/* Insights panel — pinned at top of chat */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="shrink-0">
          <InsightsPanel mes={ref.mes} ano={ref.ano} />
        </motion.div>
        {messages.length === 0 && !busy && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="m-auto text-center max-w-sm">
            <div className="mx-auto mb-4">
              <LunaAvatar size="lg" className="mx-auto" />
            </div>
            <p className="text-slate-300 font-medium">Oi, eu sou a Luna. Como posso ajudar?</p>
            <p className="text-xs text-muted mt-1 mb-4">Experimenta me perguntar:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button key={s}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }} whileHover={{ scale: 1.02 }}
                  onClick={() => sendText(s)}
                  className="text-sm text-slate-300 border border-border bg-card-hover/30 hover:border-accent/50 hover:bg-accent/10 rounded-xl px-3 py-2 transition-all">
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`group flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'user' ? (
                <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-accent/20 text-accent">
                  <User className="w-4 h-4" />
                </div>
              ) : (
                <LunaAvatar size="sm" className="shrink-0" />
              )}
              <div className="max-w-[80%] flex flex-col gap-1">
                <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line leading-relaxed ${m.role === 'user'
                    ? 'bg-accent-gradient text-slate-900 font-medium rounded-tr-sm'
                    : 'bg-card-hover text-slate-200 rounded-tl-sm'
                  }`}>
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <div className="flex gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => copyMsg(m.content, i)} title="Copiar"
                      className="text-[10px] text-muted hover:text-slate-200 inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-card-hover">
                      {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedIdx === i ? 'Copiado' : 'Copiar'}
                    </button>
                    <TTSButton text={m.content} speaking={tts.speaking && speakingIdx === i}
                      onSpeak={(t) => { setSpeakingIdx(i); tts.speak(t); }}
                      onStop={() => { setSpeakingIdx(null); tts.stop(); }} />
                    <button onClick={() => regenerate(i)} disabled={busy} title="Regenerar"
                      className="text-[10px] text-muted hover:text-accent inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-card-hover disabled:opacity-50">
                      <RefreshCw className="w-3 h-3" /> Regenerar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
            <LunaAvatar size="sm" className="shrink-0" />
            <div className="bg-card-hover rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="w-2 h-2 rounded-full bg-slate-400"
                  animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="shrink-0 flex items-start gap-2 rounded-xl border border-rose-700/50 bg-rose-900/20 p-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Input */}
      <div className="shrink-0 flex gap-2 items-end">
        <div className="relative flex-1 flex items-center gap-2 bg-card border border-border rounded-xl pl-3 pr-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText(input)}
            disabled={busy} placeholder="Pergunte algo pra Luna…"
            className="flex-1 bg-transparent py-3 outline-none text-sm text-slate-100 placeholder:text-muted disabled:opacity-50" />
          <VoiceInput onTranscript={(t) => setInput(t)} onAutoSubmit={(t) => sendText(t)} size="sm" />
        </div>
        <motion.button onClick={() => sendText(input)} disabled={busy || !input.trim()} whileTap={{ scale: 0.95 }}
          className="bg-accent-gradient text-slate-900 font-semibold px-4 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-glow-accent transition-all">
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Enviar</span>
        </motion.button>
      </div>
    </div>
  );
}
