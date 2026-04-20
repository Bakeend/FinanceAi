import { useEffect, useState, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, X } from 'lucide-react';
import { LunaAvatar } from './LunaAvatar';

export type TourStep = {
  /** CSS selector for the element to highlight. If omitted, the bubble is centered. */
  target?: string;
  /** Path to navigate to before showing the step. */
  path?: string;
  title: string;
  body: string;
  /** Where the speech bubble sits relative to the target. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'corner';
};

const PADDING = 8;

const DEFAULT_STEPS: TourStep[] = [
  {
    path: '/',
    placement: 'center',
    title: 'Oi, eu sou a Luna 🌙',
    body: 'Vou te mostrar rapidinho como o FinanceAi funciona. Pode pular a qualquer momento.',
  },
  {
    path: '/',
    target: '[data-tour="sidebar"]',
    placement: 'right',
    title: 'Aqui é a navegação',
    body: 'Por aqui você acessa Dashboard, Transações, Contas, Orçamento, Investimentos, Viagens e mais.',
  },
  {
    path: '/',
    target: '[data-tour="search"]',
    placement: 'right',
    title: 'Busca rápida (Ctrl+K)',
    body: 'Aperte Ctrl+K em qualquer lugar pra buscar transações, contas, ou navegar.',
  },
  {
    path: '/',
    target: '[data-tour="summary"]',
    placement: 'bottom',
    title: 'Os 3 cards principais',
    body: 'Verde ácido = entradas. Rosa = gastos. Roxo = saldo. É o seu mês em uma olhada.',
  },
  {
    path: '/',
    target: '[data-today-widget]',
    placement: 'top',
    title: 'O que rolou hoje',
    body: 'Esse bloco mostra entradas, gastos e a transação mais cara do dia atual.',
  },
  {
    path: '/new',
    target: 'main',
    placement: 'corner',
    title: 'Adicionar transações',
    body: 'Você pode tirar foto do recibo, descrever em texto pra mim ("gastei 50 no almoço"), ou preencher o formulário.',
  },
  {
    path: '/upload',
    target: 'main',
    placement: 'corner',
    title: 'Importar CSV',
    body: 'Tem extrato do Nubank ou Inter? Solta o arquivo aqui que eu detecto o formato e organizo tudo.',
  },
  {
    path: '/chat',
    target: 'main',
    placement: 'corner',
    title: 'Conversar comigo',
    body: 'Me pergunta o que quiser sobre suas finanças: "onde estou gastando mais?", "como economizar?", o que vier.',
  },
  {
    path: '/insights',
    target: 'main',
    placement: 'corner',
    title: 'Insights e previsões',
    body: 'Aqui eu analiso seus padrões, identifico anomalias e projeto o resto do mês.',
  },
  {
    path: '/profile',
    target: 'main',
    placement: 'corner',
    title: 'Personalize tudo',
    body: 'Tema escuro, claro, retrô, animação de boas-vindas, exportar dados, fazer backup. É tudo seu.',
  },
  {
    path: '/',
    placement: 'center',
    title: 'É isso! 💜',
    body: 'Tô sempre por aqui, em qualquer página. Bons gastos! (Ou melhor — boas economias.)',
  },
];

function useTargetRect(selector: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
      else setRect(null);
    };
    let tries = 0;
    const tick = () => {
      measure();
      if (!document.querySelector(selector) && tries++ < 30) {
        raf = requestAnimationFrame(tick);
      }
    };
    tick();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector]);
  return rect;
}

function bubblePosition(rect: DOMRect | null, placement: TourStep['placement']) {
  if (placement === 'corner') {
    return { style: { right: 24, bottom: 88 } as React.CSSProperties };
  }
  if (!rect || placement === 'center' || !placement) {
    return {
      style: {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      } as React.CSSProperties,
    };
  }
  const margin = 16;
  switch (placement) {
    case 'top':
      return { style: { left: rect.left + rect.width / 2, top: rect.top - margin, transform: 'translate(-50%, -100%)' } as React.CSSProperties };
    case 'bottom':
      return { style: { left: rect.left + rect.width / 2, top: rect.bottom + margin, transform: 'translate(-50%, 0)' } as React.CSSProperties };
    case 'left':
      return { style: { left: rect.left - margin, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' } as React.CSSProperties };
    case 'right':
      return { style: { left: rect.right + margin, top: rect.top + rect.height / 2, transform: 'translate(0, -50%)' } as React.CSSProperties };
  }
}

export function LunaTour({
  steps = DEFAULT_STEPS,
  onClose,
}: {
  steps?: TourStep[];
  onClose: (reason: 'completed' | 'skipped') => void;
}) {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const step = steps[idx];
  const rect = useTargetRect(step.target);

  useEffect(() => {
    if (step.path && window.location.pathname !== step.path) {
      navigate(step.path);
    }
  }, [idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose('skipped');
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, onClose]);

  const next = () => {
    if (idx === steps.length - 1) onClose('completed');
    else setIdx(idx + 1);
  };
  const prev = () => setIdx((i) => Math.max(i - 1, 0));

  const pos = bubblePosition(rect, step.placement);
  const showSpotlight = !!rect;

  return createPortal(
    <div className="fixed inset-0 z-[300] pointer-events-none">
      {/* Dim backdrop with optional spotlight cutout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 pointer-events-auto"
        onClick={() => onClose('skipped')}
        style={{
          background: showSpotlight
            ? 'transparent'
            : 'radial-gradient(ellipse at center, rgba(11,11,15,0.85) 0%, rgba(11,11,15,0.95) 100%)',
        }}
      />
      {showSpotlight && rect && (
        <>
          <motion.svg
            key="spot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <defs>
              <mask id="luna-tour-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={rect.left - PADDING}
                  y={rect.top - PADDING}
                  width={rect.width + PADDING * 2}
                  height={rect.height + PADDING * 2}
                  rx="14"
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(11,11,15,0.78)" mask="url(#luna-tour-mask)" />
          </motion.svg>
          <motion.div
            key={`ring-${idx}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{
              left: rect.left - PADDING,
              top: rect.top - PADDING,
              width: rect.width + PADDING * 2,
              height: rect.height + PADDING * 2,
              borderRadius: 14,
              boxShadow: '0 0 0 2px rgba(139, 92, 246, 0.85), 0 0 32px -2px rgba(236, 72, 153, 0.55)',
              zIndex: 2,
            }}
          />
        </>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="absolute pointer-events-auto max-w-sm w-[min(92vw,360px)] bg-card border border-border rounded-2xl shadow-card p-4"
          style={{ ...pos.style, zIndex: 10 }}
        >
          <button
            onClick={() => onClose('skipped')}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg hover:bg-card-hover flex items-center justify-center text-muted hover:text-slate-200"
            aria-label="Fechar tour"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3 mb-3">
            <LunaAvatar size="sm" />
            <div className="flex-1 min-w-0 pr-6">
              <div className="text-sm font-bold text-slate-100 leading-tight">{step.title}</div>
              <div className="text-[10px] text-muted mt-0.5 uppercase tracking-wider">
                Passo {idx + 1} de {steps.length}
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{step.body}</p>
          {/* Progress dots */}
          <div className="flex gap-1 mb-3">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                  i === idx ? 'bg-accent' : i < idx ? 'bg-accent/40' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onClose('skipped')}
              className="text-xs text-muted hover:text-slate-200 px-2 py-1.5"
            >
              pular
            </button>
            <div className="flex gap-2">
              {idx > 0 && (
                <button
                  onClick={prev}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card-hover/40 hover:bg-card-hover text-slate-200 text-xs font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Anterior
                </button>
              )}
              <button
                onClick={next}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-gradient text-slate-900 text-xs font-bold hover:bg-accent-gradient-hover"
              >
                {idx === steps.length - 1 ? 'Concluir' : 'Próximo'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
