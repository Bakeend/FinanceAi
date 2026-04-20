import { useCallback, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ttsSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/**  Pick the best PT-BR female voice — Luna é mulher! */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported) return null;
  const voices = speechSynthesis.getVoices();

  const FEMALE_NAMES = /female|feminino|luciana|francisca|fernanda|vitoria|maria|ana|camila|raquel|luana|thalita|leticia|nátia|sabina/i;
  const MALE_NAMES = /male(?!.*fe)|masculino|daniel|ricardo|felipe|marcos|paulo|miguel|rafael/i;

  // 1) pt-BR voice with female keyword
  const ptBrFemale = voices.find(
    (v) => v.lang.startsWith('pt-BR') && FEMALE_NAMES.test(v.name),
  );
  if (ptBrFemale) return ptBrFemale;

  // 2) any pt voice with female keyword
  const ptFemale = voices.find(
    (v) => v.lang.startsWith('pt') && FEMALE_NAMES.test(v.name),
  );
  if (ptFemale) return ptFemale;

  // 3) pt-BR voice that's NOT explicitly male
  const ptBrNotMale = voices.find(
    (v) => v.lang.startsWith('pt-BR') && !MALE_NAMES.test(v.name),
  );
  if (ptBrNotMale) return ptBrNotMale;

  // 4) any pt voice not male
  const ptNotMale = voices.find(
    (v) => v.lang.startsWith('pt') && !MALE_NAMES.test(v.name),
  );
  if (ptNotMale) return ptNotMale;

  // 5) any pt-BR
  const ptBr = voices.find((v) => v.lang.startsWith('pt-BR'));
  if (ptBr) return ptBr;

  // 6) any female voice in any language
  const anyFemale = voices.find((v) => FEMALE_NAMES.test(v.name));
  if (anyFemale) return anyFemale;

  return voices[0] ?? null;
}

export function useLunaTTS() {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!ttsSupported) return;
    // Cancel any current speech
    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = 1.0;
    utter.pitch = 1.3;  // tom mais agudo/feminino
    utter.volume = 1;

    const voice = pickVoice();
    if (voice) utter.voice = voice;

    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    utterRef.current = utter;
    speechSynthesis.speak(utter);
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported: ttsSupported };
}

/** Small TTS toggle button for assistant messages */
export function TTSButton({
  text,
  speaking,
  onSpeak,
  onStop,
}: {
  text: string;
  speaking: boolean;
  onSpeak: (text: string) => void;
  onStop: () => void;
}) {
  if (!ttsSupported) return null;

  return (
    <button
      onClick={() => (speaking ? onStop() : onSpeak(text))}
      title={speaking ? 'Parar de falar' : 'Ouvir resposta'}
      className="text-[10px] text-muted hover:text-accent inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-card-hover transition-colors relative"
    >
      <AnimatePresence mode="wait">
        {speaking ? (
          <motion.span
            key="stop"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="inline-flex items-center gap-1 text-accent"
          >
            <VolumeX className="w-3 h-3" />
            Parar
          </motion.span>
        ) : (
          <motion.span
            key="play"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="inline-flex items-center gap-1"
          >
            <Volume2 className="w-3 h-3" />
            Ouvir
          </motion.span>
        )}
      </AnimatePresence>
      {speaking && (
        <motion.span
          className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent"
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </button>
  );
}
