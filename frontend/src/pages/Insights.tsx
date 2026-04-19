import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Lightbulb, AlertCircle, Loader2 } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import { YearlyProjectionCard } from '../components/YearlyProjectionCard';
import type { MonthRef } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function InsightsPage() {
  const today = new Date();
  const [ref, setRef] = useState<MonthRef>({ mes: today.getMonth() + 1, ano: today.getFullYear() });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [forecast, setForecast] = useState<{ texto: string; valorEstimado: number | null } | null>(null);
  const [busy, setBusy] = useState<'analyze' | 'forecast' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'analyze' | 'forecast') => {
    setBusy(kind); setError(null);
    try {
      if (kind === 'analyze') setAnalysis((await api.analyze(ref.mes, ref.ano)).texto);
      else setForecast(await api.forecast(ref.mes, ref.ano));
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">Insights</span> de IA
          </h2>
          <p className="text-muted text-sm mt-1">Análise de gastos e previsão alimentadas por LLM</p>
        </div>
        <MonthSelector value={ref} onChange={setRef} />
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <motion.button
          onClick={() => run('analyze')}
          disabled={busy !== null}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 to-transparent p-5 text-left disabled:opacity-60 transition-shadow hover:shadow-glow-accent"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              {busy === 'analyze' ? <Loader2 className="w-5 h-5 text-accent animate-spin" /> : <Lightbulb className="w-5 h-5 text-accent" />}
            </div>
            <div>
              <div className="font-semibold text-slate-100">{busy === 'analyze' ? 'Analisando…' : 'Gerar análise'}</div>
              <div className="text-xs text-muted">Dicas de economia baseadas no mês</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          onClick={() => run('forecast')}
          disabled={busy !== null}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-transparent p-5 text-left disabled:opacity-60 transition-shadow hover:shadow-[0_0_40px_-10px_rgba(167,139,250,0.45)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              {busy === 'forecast' ? <Loader2 className="w-5 h-5 text-violet-400 animate-spin" /> : <TrendingUp className="w-5 h-5 text-violet-400" />}
            </div>
            <div>
              <div className="font-semibold text-slate-100">{busy === 'forecast' ? 'Prevendo…' : 'Prever próximo mês'}</div>
              <div className="text-xs text-muted">Estimativa com histórico de 6 meses</div>
            </div>
          </div>
        </motion.button>
      </div>

      <AnimatePresence>
        {analysis && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border bg-accent/5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-slate-200">Análise do mês</h3>
            </div>
            <div className="p-5 text-slate-300 whitespace-pre-line leading-relaxed">{analysis}</div>
          </motion.div>
        )}

        {forecast && (
          <motion.div
            key="forecast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border bg-violet-500/5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-slate-200">Previsão do próximo mês</h3>
            </div>
            <div className="p-5">
              {forecast.valorEstimado !== null && (
                <div className="mb-4">
                  <div className="text-xs text-muted uppercase tracking-wider">Estimativa</div>
                  <div className="text-4xl font-bold gradient-text tabular-nums mt-1">{fmt(forecast.valorEstimado)}</div>
                </div>
              )}
              <div className="text-slate-300 whitespace-pre-line leading-relaxed">{forecast.texto}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <YearlyProjectionCard mes={ref.mes} ano={ref.ano} />
    </div>
  );
}
