import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Loader2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { api } from '../lib/api';
import { LunaAvatar } from './LunaAvatar';
import { renderTransactionsAsImage } from '../lib/shareTx';
import type { Transaction, Summary } from '../lib/types';

const fmt = (n: number) => Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type Slide = {
  bg: string;
  /** Small intro phrase shown first (e.g. "Você gastou…"). */
  setup: React.ReactNode;
  /** The dramatic reveal (the big number or word). */
  reveal: React.ReactNode;
  /** Optional caption shown after reveal. */
  caption?: React.ReactNode;
  /** How long the slide stays visible total (ms). */
  durationMs?: number;
};

type WrappedData = {
  year: number;
  totalEntrada: number;
  totalGasto: number;
  saldo: number;
  txCount: number;
  topCat?: { cat: string; total: number };
  topGasto?: Transaction;
  topMonth?: { mes: number; gasto: number };
  bestSavingsMonth?: { mes: number; saldo: number };
  daysActive: number;
  averageTx: number;
};

const SLIDE_DEFAULT_MS = 9000;
const SETUP_MS = 2800;

async function buildWrapped(year: number): Promise<WrappedData> {
  const all: Transaction[] = [];
  const summaries: { mes: number; s: Summary }[] = [];
  const promises: Promise<void>[] = [];
  for (let m = 1; m <= 12; m++) {
    promises.push(
      Promise.all([api.summary(m, year), api.listTransactions(m, year)])
        .then(([s, items]) => {
          summaries.push({ mes: m, s });
          for (const t of items) if (!t.isTransfer) all.push(t);
        })
        .catch(() => {}),
    );
  }
  await Promise.all(promises);

  const totalEntrada = summaries.reduce((s, x) => s + x.s.totalEntrada, 0);
  const totalGasto = summaries.reduce((s, x) => s + x.s.totalGasto, 0);
  const saldo = totalEntrada + totalGasto;

  const catTotals = new Map<string, number>();
  for (const t of all) if (t.valor < 0) catTotals.set(t.categoria, (catTotals.get(t.categoria) ?? 0) + Math.abs(t.valor));
  const topCatEntry = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCat = topCatEntry ? { cat: topCatEntry[0], total: topCatEntry[1] } : undefined;

  const topGasto = all.filter((t) => t.valor < 0).sort((a, b) => a.valor - b.valor)[0];
  const monthGastos = summaries.map((x) => ({ mes: x.mes, gasto: Math.abs(x.s.totalGasto) }));
  const topMonth = monthGastos.sort((a, b) => b.gasto - a.gasto)[0];
  const monthSavings = summaries.map((x) => ({ mes: x.mes, saldo: x.s.saldo }));
  const bestSavingsMonth = monthSavings.filter((x) => x.saldo > 0).sort((a, b) => b.saldo - a.saldo)[0];

  const daysActive = new Set(all.map((t) => t.data)).size;
  const expensesCount = all.filter((t) => t.valor < 0).length;
  const averageTx = expensesCount > 0 ? Math.abs(totalGasto) / expensesCount : 0;

  return { year, totalEntrada, totalGasto, saldo, txCount: all.length, topCat, topGasto, topMonth, bestSavingsMonth, daysActive, averageTx };
}

/* ---------- Reveal helpers ---------- */

function CountUp({ value, prefix = '', suffix = '', currency = false, durationMs = 1400 }: { value: number; prefix?: string; suffix?: string; currency?: boolean; durationMs?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  const formatted = currency
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
    : Math.round(n).toLocaleString('pt-BR');
  return <span className="tabular-nums">{prefix}{formatted}{suffix}</span>;
}

function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 18 }}
    >
      {children}
    </motion.div>
  );
}

function Setup({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="text-base md:text-lg font-semibold text-white/85 text-center"
    >
      {children}
    </motion.div>
  );
}

/* ---------- Slide builder ---------- */

function buildSlides(d: WrappedData): Slide[] {
  return [
    {
      bg: 'linear-gradient(135deg, #6D28D9 0%, #EC4899 100%)',
      durationMs: 7500,
      setup: <span className="uppercase tracking-[0.3em] text-white/70 text-xs">Sua retrospectiva</span>,
      reveal: (
        <div className="flex flex-col items-center gap-2">
          <div className="text-7xl md:text-8xl font-black tracking-tighter text-white">{d.year}</div>
          <div className="text-base font-semibold text-white/90">com a Luna 🌙</div>
        </div>
      ),
      caption: <span>Bora ver como foi seu ano em dinheiro.</span>,
    },
    {
      bg: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',
      setup: <>Você fez algo por aqui em <strong>{d.daysActive}</strong> dias…</>,
      reveal: (
        <div className="text-center text-white">
          <div className="text-5xl md:text-7xl font-black"><CountUp value={d.txCount} /></div>
          <div className="text-base font-semibold mt-2 opacity-90">transações no ano</div>
        </div>
      ),
    },
    {
      bg: 'linear-gradient(135deg, #84CC16 0%, #6D28D9 100%)',
      setup: <>De tudo que entrou na sua conta…</>,
      reveal: (
        <div className="text-center text-white">
          <div className="text-4xl md:text-6xl font-black"><CountUp value={d.totalEntrada} currency /></div>
          <div className="text-base font-semibold mt-2 opacity-90">em entradas 🤑</div>
        </div>
      ),
    },
    {
      bg: 'linear-gradient(135deg, #EC4899 0%, #6D28D9 100%)',
      setup: <>E de tudo que saiu…</>,
      reveal: (
        <div className="text-center text-white">
          <div className="text-4xl md:text-6xl font-black"><CountUp value={Math.abs(d.totalGasto)} currency /></div>
          <div className="text-sm mt-2 opacity-90">{d.averageTx > 0 ? <>média de <strong>{fmt(d.averageTx)}</strong> por gasto</> : null}</div>
        </div>
      ),
    },
    {
      bg: d.saldo >= 0 ? 'linear-gradient(135deg, #84CC16 0%, #FBBF24 100%)' : 'linear-gradient(135deg, #EC4899 0%, #F87171 100%)',
      durationMs: 9500,
      setup: <>No fim das contas…</>,
      reveal: (
        <div className={`text-center ${d.saldo >= 0 ? 'text-zinc-900' : 'text-white'}`}>
          <div className="text-5xl md:text-7xl font-black">
            <CountUp value={Math.abs(d.saldo)} prefix={d.saldo >= 0 ? '+ ' : '- '} currency />
          </div>
          <div className="text-base font-bold mt-3">{d.saldo >= 0 ? 'sobrou no caixa 🎉' : 'no vermelho — vamos virar isso'}</div>
        </div>
      ),
    },
    ...(d.topCat ? [{
      bg: 'linear-gradient(135deg, #EC4899 0%, #FBBF24 100%)',
      durationMs: 9500,
      setup: <>Aqui foi pro lugar mais quente do ano…</>,
      reveal: (
        <div className="text-center text-white">
          <div className="text-5xl md:text-6xl font-black uppercase tracking-tight">{d.topCat.cat}</div>
          <div className="text-base font-bold mt-3 opacity-95"><CountUp value={d.topCat.total} prefix="R$ " currency /> no ano</div>
        </div>
      ),
    }] : []),
    ...(d.topGasto ? [{
      bg: 'linear-gradient(135deg, #6D28D9 0%, #EC4899 100%)',
      durationMs: 9500,
      setup: <>Sua maior aventura monetária…</>,
      reveal: (
        <div className="text-center text-white">
          <div className="text-3xl md:text-4xl font-black leading-tight">{d.topGasto.descricao}</div>
          <div className="text-2xl font-extrabold tabular-nums mt-3 opacity-95">{fmt(d.topGasto.valor)}</div>
          <div className="text-xs mt-2 opacity-75">em {d.topGasto.data.split('-').reverse().join('/')}</div>
        </div>
      ),
    }] : []),
    ...(d.topMonth && d.topMonth.gasto > 0 ? [{
      bg: 'linear-gradient(135deg, #FBBF24 0%, #EC4899 100%)',
      durationMs: 9500,
      setup: <>Seu mês mais caro foi…</>,
      reveal: (
        <div className="text-center text-zinc-900">
          <div className="text-5xl md:text-7xl font-black uppercase">{MESES[d.topMonth.mes - 1]}</div>
          <div className="text-base font-bold mt-3"><CountUp value={d.topMonth.gasto} prefix="R$ " currency /> em gastos</div>
        </div>
      ),
    }] : []),
    ...(d.bestSavingsMonth ? [{
      bg: 'linear-gradient(135deg, #84CC16 0%, #B0E450 100%)',
      durationMs: 9500,
      setup: <>E o melhor mês pra sua conta…</>,
      reveal: (
        <div className="text-center text-zinc-900">
          <div className="text-5xl md:text-7xl font-black uppercase">{MESES[d.bestSavingsMonth.mes - 1]}</div>
          <div className="text-base font-bold mt-3">+ <CountUp value={d.bestSavingsMonth.saldo} prefix="R$ " currency /> sobraram</div>
        </div>
      ),
    }] : []),
    {
      bg: 'linear-gradient(135deg, #6D28D9 0%, #EC4899 100%)',
      durationMs: 7000,
      setup: <>É isso aí…</>,
      reveal: (
        <div className="text-center text-white">
          <div className="text-4xl md:text-6xl font-black">Bom ano novo 💜</div>
          <div className="text-sm font-semibold mt-4 opacity-95">A Luna tá pronta pra te acompanhar em {d.year + 1}.</div>
        </div>
      ),
    },
  ];
}

/* ---------- Ambient music (Web Audio) ---------- */

function startAmbientMusic(): { stop: () => void; setMuted: (m: boolean) => void } {
  const ACtx: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
  if (!ACtx) return { stop: () => {}, setMuted: () => {} };
  const ac = new ACtx();
  if (ac.state === 'suspended') ac.resume().catch(() => {});

  const master = ac.createGain();
  master.gain.value = 0.0;
  master.connect(ac.destination);
  master.gain.linearRampToValueAtTime(0.16, ac.currentTime + 1.5);

  // 4-chord progression in A minor — 4s per chord
  const chords: number[][] = [
    [220.00, 261.63, 329.63], // Am
    [196.00, 246.94, 293.66], // G
    [174.61, 220.00, 261.63], // F
    [220.00, 277.18, 329.63], // Am variation
  ];
  const stopFns: Array<() => void> = [];

  let chordIdx = 0;
  let killed = false;

  const playChord = (freqs: number[], durSec: number) => {
    const t0 = ac.currentTime;
    const chordGain = ac.createGain();
    chordGain.gain.setValueAtTime(0, t0);
    chordGain.gain.linearRampToValueAtTime(0.4, t0 + 0.8);
    chordGain.gain.linearRampToValueAtTime(0.4, t0 + durSec - 0.8);
    chordGain.gain.linearRampToValueAtTime(0, t0 + durSec);
    chordGain.connect(master);

    const oscs: OscillatorNode[] = [];
    for (const f of freqs) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const detune = ac.createGain();
      detune.gain.value = 0.5;
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      lfo.frequency.value = 0.15 + Math.random() * 0.2;
      lfoGain.gain.value = 1.5;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + durSec + 0.2);
      osc.connect(detune).connect(chordGain);
      osc.start(t0);
      osc.stop(t0 + durSec + 0.1);
      oscs.push(osc);
    }
    stopFns.push(() => oscs.forEach((o) => { try { o.stop(); } catch {} }));
  };

  const tickChord = () => {
    if (killed) return;
    const dur = 4.5;
    playChord(chords[chordIdx % chords.length], dur);
    chordIdx++;
    setTimeout(tickChord, dur * 1000 - 250);
  };
  tickChord();

  return {
    stop: () => {
      killed = true;
      try {
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
      } catch {}
      setTimeout(() => { stopFns.forEach((fn) => fn()); ac.close().catch(() => {}); }, 600);
    },
    setMuted: (m: boolean) => {
      try {
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.linearRampToValueAtTime(m ? 0 : 0.16, ac.currentTime + 0.25);
      } catch {}
    },
  };
}

/* ---------- Component ---------- */

export function LunaWrapped({ year, onClose }: { year: number; onClose: () => void }) {
  const [data, setData] = useState<WrappedData | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'reveal'>('setup');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const slides = useMemo(() => (data ? buildSlides(data) : []), [data]);
  const slide = slides[idx];
  const musicRef = useRef<{ stop: () => void; setMuted: (m: boolean) => void } | null>(null);

  // Build data
  useEffect(() => {
    buildWrapped(year).then(setData).catch(() => onClose());
  }, [year, onClose]);

  // Music
  useEffect(() => {
    if (!data) return;
    musicRef.current = startAmbientMusic();
    return () => { musicRef.current?.stop(); musicRef.current = null; };
  }, [data]);

  useEffect(() => { musicRef.current?.setMuted(muted); }, [muted]);

  // Slide phase machine: setup → reveal → next
  useEffect(() => {
    if (!slide) return;
    setPhase('setup');
    setProgress(0);
    if (paused) return;

    const total = slide.durationMs ?? SLIDE_DEFAULT_MS;
    const setupTimer = setTimeout(() => setPhase('reveal'), SETUP_MS);
    const advanceTimer = setTimeout(() => {
      if (idx < slides.length - 1) setIdx(idx + 1);
      else onClose();
    }, total);

    // progress bar tick
    const start = performance.now();
    const progressTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / total);
      setProgress(p);
    }, 60);

    return () => {
      clearTimeout(setupTimer);
      clearTimeout(advanceTimer);
      clearInterval(progressTimer);
    };
  }, [idx, slide, paused, slides.length, onClose]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setIdx((i) => Math.min(i + 1, slides.length - 1)); }
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length, onClose]);

  const next = () => idx < slides.length - 1 ? setIdx(idx + 1) : onClose();
  const prev = () => setIdx(Math.max(0, idx - 1));

  const share = async () => {
    if (!data) return;
    const items = [
      ...(data.topGasto ? [{ data: data.topGasto.data, descricao: data.topGasto.descricao, valor: data.topGasto.valor, categoria: data.topGasto.categoria }] : []),
      { data: `${year}-12-31`, descricao: `Saldo ${year}`, valor: data.saldo, categoria: 'Resumo' },
    ];
    await renderTransactionsAsImage(items, { title: `Retrospectiva ${year}`, filename: `retrospectiva-${year}.png` });
  };

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/95 backdrop-blur-md p-3">
      {!data ? (
        <div className="flex flex-col items-center gap-3 text-slate-200">
          <Loader2 className="w-7 h-7 animate-spin text-accent" />
          <p className="text-sm">A Luna está calculando seu ano…</p>
        </div>
      ) : (
        <div className="relative w-full max-w-md aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white select-none">
          {/* Top controls */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
            <button
              onClick={() => setMuted((m) => !m)}
              className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center backdrop-blur"
              aria-label={muted ? 'Ativar som' : 'Mutar som'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setPaused((p) => !p)}
              className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center backdrop-blur"
              aria-label={paused ? 'Retomar' : 'Pausar'}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center backdrop-blur"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bars (Stories style) */}
          <div className="absolute top-3 left-3 right-32 z-20 flex gap-1">
            {slides.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-white"
                  style={{
                    width: i < idx ? '100%' : i === idx ? `${progress * 100}%` : '0%',
                    transition: i === idx ? 'none' : 'width 200ms ease',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Slide */}
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-hidden"
              style={{ background: slide.bg }}
            >
              {/* Floating background blobs */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.35, scale: 1 }}
                transition={{ duration: 1.5 }}
                className="absolute -top-20 -left-10 w-72 h-72 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 65%)' }}
              />
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-24 -right-10 w-80 h-80 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.25) 0%, transparent 65%)' }}
              />

              {/* Top brand */}
              <div className="absolute top-12 left-6 right-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/80">
                <LunaAvatar size="sm" />
                <span>Luna · {year}</span>
              </div>

              {/* Setup → Reveal */}
              <div className="relative z-10 flex flex-col items-center gap-6 max-w-xs">
                <AnimatePresence mode="wait">
                  {phase === 'setup' && slide.setup && (
                    <motion.div
                      key="setup"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.35 }}
                    >
                      <Setup>{slide.setup}</Setup>
                    </motion.div>
                  )}
                  {phase === 'reveal' && (
                    <motion.div
                      key="reveal"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Reveal>{slide.reveal}</Reveal>
                      {slide.caption && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 }}
                          className="text-xs text-white/85 mt-4 text-center"
                        >
                          {slide.caption}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tap zones */}
              <button onClick={prev} className="absolute left-0 top-0 bottom-16 w-1/3 z-10" aria-label="Anterior" />
              <button onClick={next} className="absolute right-0 top-0 bottom-16 w-2/3 z-10" aria-label="Próximo" />
            </motion.div>
          </AnimatePresence>

          {/* Bottom share */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={share}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/90 hover:bg-white text-zinc-900 text-xs font-bold backdrop-blur shadow-lg"
            >
              <Share2 className="w-3.5 h-3.5" /> Compartilhar
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
