import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X } from 'lucide-react';

type SR = any;
const SpeechRecognition: { new (): SR } | undefined =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

export const speechSupported = !!SpeechRecognition;

/* ── Audio analyser for real waveform bars ── */
function useAudioAnalyser(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
      setLevels(Array(24).fill(0));
      return;
    }

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(buf);
          const slice = Array.from(buf.slice(0, 24)).map((v) => v / 255);
          setLevels(slice);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
    };
  }, [active]);

  return levels;
}

export function VoiceInput({
  onTranscript,
  onAutoSubmit,
  className = '',
  size = 'md',
}: {
  onTranscript: (text: string) => void;
  onAutoSubmit?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SR | null>(null);
  const levels = useAudioAnalyser(listening);

  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }
    setError(null);
    setInterim('');
    try {
      const r: SR = new SpeechRecognition();
      r.lang = 'pt-BR';
      r.continuous = false;
      r.interimResults = true;
      r.maxAlternatives = 1;
      let finalText = '';
      r.onresult = (e: any) => {
        let interimPart = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const tr = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += tr;
          else interimPart += tr;
        }
        const combined = (finalText + interimPart).trim();
        if (combined) {
          onTranscript(combined);
          setInterim(combined);
        }
      };
      r.onerror = (e: any) => {
        setListening(false);
        if (e.error === 'not-allowed') setError('Microfone bloqueado pelo navegador.');
        else if (e.error === 'no-speech') setError('Não ouvi nada. Tente novamente.');
        else setError('Falha ao escutar.');
      };
      r.onend = () => {
        setListening(false);
        const txt = finalText.trim();
        if (txt && onAutoSubmit) onAutoSubmit(txt);
        setInterim('');
      };
      r.start();
      recRef.current = r;
      setListening(true);
    } catch {
      setError('Não consegui ativar o microfone.');
    }
  }, [onTranscript, onAutoSubmit]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
    setInterim('');
  }, []);

  const sz = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const icon = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <>
      {/* ── Trigger button ── */}
      <div className={`relative ${className}`}>
        <motion.button
          type="button"
          onClick={listening ? stop : start}
          title={listening ? 'Parar de escutar' : 'Falar com a Luna'}
          whileTap={{ scale: 0.9 }}
          className={`${sz} rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            listening
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
              : 'bg-accent/15 text-accent hover:bg-accent/25 hover:shadow-md hover:shadow-accent/20'
          }`}
          aria-pressed={listening}
        >
          {listening ? <MicOff className={icon} /> : <Mic className={icon} />}
        </motion.button>

        {/* Pulse ring on button */}
        {listening && (
          <>
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-xl border-2 border-rose-400/60"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-xl border-2 border-rose-400/40"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}

        {/* Error tooltip */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              className="absolute top-full mt-2 right-0 text-[11px] text-rose-200 bg-rose-900/60 backdrop-blur-sm border border-rose-700/50 rounded-lg px-3 py-1.5 whitespace-nowrap z-50 shadow-lg"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Fullscreen listening overlay ── */}
      <AnimatePresence>
        {listening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[999] flex flex-col items-center justify-center"
            style={{ background: 'rgba(11, 11, 15, 0.92)', backdropFilter: 'blur(20px)' }}
          >
            {/* Close button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              onClick={stop}
              className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>

            {/* Glowing orb */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className="relative mb-8"
            >
              {/* Outer glow rings */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  width: 160, height: 160,
                  left: '50%', top: '50%',
                  marginLeft: -80, marginTop: -80,
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
                }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  width: 120, height: 120,
                  left: '50%', top: '50%',
                  marginLeft: -60, marginTop: -60,
                  background: 'radial-gradient(circle, rgba(236, 72, 153, 0.2) 0%, transparent 70%)',
                }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.15, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
              />

              {/* Center orb */}
              <motion.div
                className="relative w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                  boxShadow: '0 0 40px rgba(139, 92, 246, 0.4), 0 0 80px rgba(236, 72, 153, 0.2)',
                }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Mic className="w-8 h-8 text-white" strokeWidth={2} />
              </motion.div>
            </motion.div>

            {/* Audio visualization bars */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-end gap-[3px] h-16 mb-6"
            >
              {levels.map((level, i) => (
                <motion.div
                  key={i}
                  className="w-[5px] rounded-full"
                  style={{
                    background: `linear-gradient(180deg, #EC4899 0%, #8B5CF6 100%)`,
                    opacity: 0.5 + level * 0.5,
                  }}
                  animate={{ height: Math.max(4, level * 56) }}
                  transition={{ duration: 0.05 }}
                />
              ))}
            </motion.div>

            {/* Status text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-lg font-medium text-slate-200 mb-2"
            >
              Escutando...
            </motion.p>

            {/* Interim transcript */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="max-w-md text-center px-4"
            >
              {interim ? (
                <p className="text-sm text-accent/90 italic leading-relaxed">
                  &ldquo;{interim}&rdquo;
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Diga algo para a Luna...
                </p>
              )}
            </motion.div>

            {/* Cancel hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.5 }}
              className="absolute bottom-8 text-xs text-muted"
            >
              Toque em qualquer lugar ou pressione Esc para cancelar
            </motion.p>

            {/* Click backdrop to cancel */}
            <div
              className="absolute inset-0 -z-10"
              onClick={stop}
              onKeyDown={(e) => { if (e.key === 'Escape') stop(); }}
              role="button"
              tabIndex={0}
              aria-label="Cancelar escuta"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
