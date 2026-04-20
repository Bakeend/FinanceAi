import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, RefreshCw, Clock, ArrowLeft } from 'lucide-react';
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

type CheckStatus = 'loading' | 'ok' | 'error';

interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
  latencyMs?: number;
}

async function probeRaw(url: string, opts?: RequestInit): Promise<{ status: CheckStatus; detail: string; latencyMs: number; json?: any }> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { ...opts, cache: 'no-store' });
    const latencyMs = Math.round(performance.now() - t0);
    if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}`, latencyMs };
    let json: any = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: 'ok', detail: 'Operacional', latencyMs, json };
  } catch (e: any) {
    const latencyMs = Math.round(performance.now() - t0);
    return { status: 'error', detail: e?.message ?? 'Falha de rede', latencyMs };
  }
}

const AUTO_INTERVAL_SECONDS = 3600;
const NEXT_AT_KEY = 'financeai-status-next-at';

function fmtCountdown(s: number): string {
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  if (s >= 60) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}`;
  return `${s}s`;
}

function readNextAt(): number {
  const raw = localStorage.getItem(NEXT_AT_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}
function writeNextAt(ms: number) {
  localStorage.setItem(NEXT_AT_KEY, String(ms));
}

const CACHE_KEY = 'financeai-status-cache';
type Snapshot = { checks: Check[]; lastRun: string; uptime: number | null };
function readCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch { return null; }
}
function writeCache(s: Snapshot) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch {}
}

export function StatusPage() {
  const [countdown, setCountdown] = useState(() => {
    const next = readNextAt();
    if (!next) return AUTO_INTERVAL_SECONDS;
    return Math.max(0, Math.ceil((next - Date.now()) / 1000));
  });
  const runRef = useRef<() => void>(() => {});
  const [now, setNow] = useState(new Date());
  const cached = readCache();
  const [checks, setChecks] = useState<Check[]>(
    cached?.checks ?? [
      { label: 'Backend (HTTP)', status: 'loading', detail: 'Verificando…' },
      { label: 'Banco de dados', status: 'loading', detail: 'Verificando…' },
      { label: 'Transações', status: 'loading', detail: 'Verificando…' },
      { label: 'Contas', status: 'loading', detail: 'Verificando…' },
      { label: 'Luna (assistente)', status: 'loading', detail: 'Verificando…' },
      { label: 'Autenticação (público)', status: 'loading', detail: 'Verificando…' },
    ],
  );
  const [lastRun, setLastRun] = useState<Date | null>(cached?.lastRun ? new Date(cached.lastRun) : null);
  const [running, setRunning] = useState(false);
  const [uptime, setUptime] = useState<number | null>(cached?.uptime ?? null);

  const update = (index: number, patch: Partial<Check>) =>
    setChecks((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const run = async () => {
    setRunning(true);
    setUptime(null);
    setChecks((prev) => prev.map((c) => ({ ...c, status: 'loading', detail: 'Verificando…', latencyMs: undefined })));

    const health = await probeRaw(`${BASE}/health`);
    if (health.status === 'ok' && health.json) {
      const s = health.json.services ?? {};
      update(0, { status: 'ok', detail: 'Operacional', latencyMs: s.api?.latencyMs ?? health.latencyMs });
      update(1, s.db?.ok
        ? { status: 'ok', detail: 'Operacional', latencyMs: s.db.latencyMs }
        : { status: 'error', detail: s.db?.error ?? 'Sem resposta', latencyMs: s.db?.latencyMs ?? 0 });
      update(2, s.transactions?.ok
        ? { status: 'ok', detail: 'Operacional', latencyMs: s.transactions.latencyMs }
        : { status: 'error', detail: s.transactions?.error ?? 'Falha', latencyMs: s.transactions?.latencyMs ?? 0 });
      update(3, s.accounts?.ok
        ? { status: 'ok', detail: 'Operacional', latencyMs: s.accounts.latencyMs }
        : { status: 'error', detail: s.accounts?.error ?? 'Falha', latencyMs: s.accounts?.latencyMs ?? 0 });
      update(4, s.luna?.ok
        ? { status: 'ok', detail: 'Configurada e disponível' }
        : { status: 'error', detail: s.luna?.error ?? 'Indisponível' });
      setUptime(typeof health.json.uptimeSeconds === 'number' ? health.json.uptimeSeconds : null);
    } else {
      update(0, { status: 'error', detail: health.detail, latencyMs: health.latencyMs });
      [1, 2, 3, 4].forEach((i) => update(i, { status: 'error', detail: 'Backend indisponível' }));
    }

    const auth = await probeRaw(`${BASE}/auth/status`);
    update(5, { status: auth.status, detail: auth.status === 'ok' ? 'Operacional' : auth.detail, latencyMs: auth.latencyMs });

    const finishedAt = new Date();
    setLastRun(finishedAt);
    setRunning(false);
    // Persist for next page load
    setChecks((latest) => {
      writeCache({ checks: latest, lastRun: finishedAt.toISOString(), uptime: uptime });
      return latest;
    });
    writeNextAt(Date.now() + AUTO_INTERVAL_SECONDS * 1000);
  };

  useEffect(() => {
    const next = readNextAt();
    if (!next || next <= Date.now()) {
      run();
    }
  }, []);

  // Keep the latest run() in a ref so the timer always calls the freshest closure.
  useEffect(() => { runRef.current = run; });

  // Tick the on-screen clock every second.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown + auto-refresh (countdown derives from persisted `nextAt`).
  useEffect(() => {
    const tick = () => {
      const next = readNextAt();
      if (!next) {
        setCountdown(AUTO_INTERVAL_SECONDS);
        return;
      }
      const remaining = Math.max(0, Math.ceil((next - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) runRef.current?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastRun]);

  const allOk = checks.every((c) => c.status === 'ok');
  const anyError = checks.some((c) => c.status === 'error');
  const overallColor = anyError ? 'text-rose-400' : allOk ? 'text-emerald-400' : 'text-amber-400';
  const overallLabel = anyError ? 'Degradado' : allOk ? 'Tudo operacional' : 'Verificando…';

  const fmtUptime = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min ${s % 60}s`;
    if (s < 86400) {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${h}h ${m}min`;
    }
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return `${d}d ${h}h`;
  };

  return (
    <div className="min-h-screen bg-bg p-4 md:p-8 flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex flex-col gap-6 flex-1">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Status do <span className="gradient-text">FinanceAi</span>
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-mono tabular-nums text-base font-bold text-slate-200">
                {now.toLocaleTimeString('pt-BR')}
              </span>
              <span className="text-muted text-xs">· {now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
            </div>
          </div>
          <div
            title="Próxima verificação automática"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-muted text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin text-accent' : ''}`} />
            <span className="tabular-nums font-bold">
              {running ? 'verificando…' : `próxima em ${fmtCountdown(countdown)}`}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`rounded-2xl border p-4 flex items-center gap-3 ${anyError ? 'border-rose-700/50 bg-rose-900/15' : allOk ? 'border-emerald-700/50 bg-emerald-900/15' : 'border-amber-700/50 bg-amber-900/15'}`}
        >
          {anyError
            ? <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
            : allOk
            ? <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            : <RefreshCw className="w-6 h-6 text-amber-400 shrink-0 animate-spin" />}
          <div className="flex-1">
            <div className={`font-bold text-lg ${overallColor}`}>{overallLabel}</div>
            <div className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {lastRun && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {lastRun.toLocaleTimeString('pt-BR')}
                </span>
              )}
              {uptime !== null && (
                <span className="inline-flex items-center gap-1">
                  <span className="opacity-50">·</span> uptime {fmtUptime(uptime)}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
        >
          <div className="divide-y divide-border/60">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  {c.status === 'loading'
                    ? <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                    : c.status === 'ok'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm text-slate-200 font-semibold">{c.label}</div>
                    <div className="text-xs text-muted truncate">{c.detail}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {c.latencyMs !== undefined && (
                    <div className={`text-xs tabular-nums font-bold ${c.latencyMs < 200 ? 'text-emerald-400' : c.latencyMs < 600 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {c.latencyMs}ms
                    </div>
                  )}
                  <div className={`text-[10px] uppercase tracking-wider mt-0.5 ${c.status === 'ok' ? 'text-emerald-500' : c.status === 'error' ? 'text-rose-500' : 'text-amber-500'}`}>
                    {c.status === 'ok' ? 'OK' : c.status === 'error' ? 'ERRO' : '…'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex items-center gap-4 text-[11px] text-muted px-1 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> &lt;200ms</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> 200–600ms</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" /> &gt;600ms</span>
        </div>

        <div className="mt-auto pt-6">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> voltar pro app
          </a>
        </div>
      </div>
    </div>
  );
}
