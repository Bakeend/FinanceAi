import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Sparkles, User, AlertCircle, Trash2, Copy, RefreshCw, Check } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import type { MonthRef } from '../lib/types';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Onde estou gastando mais?',
  'Como economizar em alimentação?',
  'Meus gastos estão aumentando?',
];

export function ChatPage() {
  const today = new Date();
  const [ref, setRef] = useState<MonthRef>({ mes: today.getMonth() + 1, ano: today.getFullYear() });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const copyMsg = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {}
  };

  const regenerate = async (idx: number) => {
    if (busy) return;
    // find the user msg before idx
    let userIdx = idx - 1;
    while (userIdx >= 0 && messages[userIdx].role !== 'user') userIdx--;
    if (userIdx < 0) return;
    const userMsg = messages[userIdx];
    const history = messages.slice(0, userIdx);
    // remove the assistant msg (and anything after)
    setMessages(history.concat(userMsg));
    setBusy(true);
    setError(null);
    try {
      const r = await api.chat(userMsg.content, history.slice(-10) as any, ref);
      setMessages((m) => [...m, { role: 'assistant', content: r.resposta }]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    api.chatHistory().then((h) => setMessages(h as Msg[])).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

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
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const r = await api.chat(trimmed, [...messages, userMsg].slice(-10), ref);
      setMessages((m) => [...m, { role: 'assistant', content: r.resposta }]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">Chat</span> financeiro
          </h2>
          <p className="text-muted text-sm mt-1">Pergunte sobre suas finanças do mês selecionado</p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Limpar histórico"
              className="w-9 h-9 rounded-xl border border-border bg-card hover:bg-rose-500/10 hover:border-rose-500/50 text-rose-400 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <MonthSelector value={ref} onChange={setRef} />
        </div>
      </motion.div>

      <div className="flex-1 rounded-2xl border border-border bg-card p-4 overflow-y-auto flex flex-col gap-3">
        {messages.length === 0 && !busy && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="m-auto text-center max-w-sm"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent-gradient mx-auto flex items-center justify-center shadow-glow-accent mb-4">
              <Sparkles className="w-7 h-7 text-slate-900" />
            </div>
            <p className="text-slate-300 font-medium">Como posso ajudar?</p>
            <p className="text-xs text-muted mt-1 mb-4">Sugestões para começar:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => sendText(s)}
                  className="text-sm text-slate-300 border border-border bg-card-hover/30 hover:border-accent/50 hover:bg-accent/10 rounded-xl px-3 py-2 transition-all"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`group flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                m.role === 'user' ? 'bg-accent/20 text-accent' : 'bg-violet-500/20 text-violet-400'
              }`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className="max-w-[80%] flex flex-col gap-1">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-accent-gradient text-slate-900 font-medium rounded-tr-sm'
                      : 'bg-card-hover text-slate-200 rounded-tl-sm'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <div className="flex gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyMsg(m.content, i)}
                      title="Copiar"
                      className="text-[10px] text-muted hover:text-slate-200 inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-card-hover"
                    >
                      {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedIdx === i ? 'Copiado' : 'Copiar'}
                    </button>
                    <button
                      onClick={() => regenerate(i)}
                      disabled={busy}
                      title="Regenerar"
                      className="text-[10px] text-muted hover:text-accent inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-card-hover disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2"
          >
            <div className="shrink-0 w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-card-hover rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 rounded-full bg-slate-400"
                  animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 flex items-start gap-2 rounded-xl border border-rose-700/50 bg-rose-900/20 p-3 text-xs text-rose-200"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <div className="mt-3 flex gap-2 items-end">
        <div className="relative flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText(input)}
            disabled={busy}
            placeholder="Pergunte algo sobre suas finanças…"
            className="w-full bg-card border border-border rounded-xl pl-4 pr-4 py-3 outline-none text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-50"
          />
        </div>
        <motion.button
          onClick={() => sendText(input)}
          disabled={busy || !input.trim()}
          whileTap={{ scale: 0.95 }}
          className="bg-accent-gradient text-slate-900 font-semibold px-4 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-glow-accent hover:shadow-glow-accent transition-all"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Enviar</span>
        </motion.button>
      </div>
    </div>
  );
}
