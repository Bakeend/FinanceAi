import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, KeyRound, Lock, User as UserIcon, AlertCircle, Delete } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useAuth, getUsernameCache } from '../lib/auth';

type Mode = 'pin' | 'password';

export function LoginPage() {
  const { needsSetup, setSession } = useAuth();
  const cached = getUsernameCache();
  const [mode, setMode] = useState<Mode>(cached ? 'pin' : 'password');
  const [username, setUsername] = useState(cached ?? '');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    setError(null);
  }, [mode]);

  if (needsSetup || showSignup) return <SignupPanel onSignedUp={setSession} onBack={needsSetup ? undefined : () => setShowSignup(false)} />;

  const submitPassword = async () => {
    if (busy) return;
    setError(null);
    if (!username.trim() || password.length < 1) return setError('Preencha usuário e senha.');
    setBusy(true);
    try {
      const r = await api.authLogin({ username: username.trim(), password });
      setSession(r.token, { ...r.user });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async (fullPin: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.authPinLogin({ username: username.trim(), pin: fullPin });
      setSession(r.token, { ...r.user });
    } catch (e) {
      setError(friendlyError(e));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const addDigit = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4) {
      // Tentar login assim que completar 4 dígitos. Se falhar, usuário continua digitando até 6.
    }
  };
  const delDigit = () => setPin((p) => p.slice(0, -1));
  const submitPinClick = () => pin.length >= 4 && submitPin(pin);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent-gradient flex items-center justify-center shadow-glow-accent mb-3">
            <Wallet className="w-7 h-7 text-slate-900" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Finance<span className="gradient-text">Ai</span>
          </h1>
          <p className="text-xs text-muted mt-1">Entre para continuar</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-1 mb-4 bg-bg-soft rounded-xl p-1">
            <TabBtn active={mode === 'pin'} onClick={() => setMode('pin')} icon={KeyRound} label="PIN" />
            <TabBtn active={mode === 'password'} onClick={() => setMode('password')} icon={Lock} label="Senha" />
          </div>

          {cached ? (
            <div className="flex items-center gap-2 mb-4 text-sm text-slate-300">
              <UserIcon className="w-4 h-4 text-accent" />
              <span className="flex-1">{cached}</span>
              <button className="text-[11px] text-muted hover:text-slate-200" onClick={() => { localStorage.removeItem('financeai-user'); window.location.reload(); }}>
                trocar
              </button>
            </div>
          ) : (
            <input
              type="text"
              placeholder="Usuário"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-bg-soft border border-border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none mb-3"
            />
          )}

          <AnimatePresence mode="wait">
            {mode === 'pin' ? (
              <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <PinDisplay pin={pin} />
                <PinPad onDigit={addDigit} onDelete={delDigit} onSubmit={submitPinClick} submitEnabled={pin.length >= 4 && !!username.trim()} />
              </motion.div>
            ) : (
              <motion.div key="pw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                  className="w-full bg-bg-soft border border-border rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  onClick={submitPassword}
                  disabled={busy}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold disabled:opacity-50 shadow-glow-accent"
                >
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">{busy ? 'Entrando…' : 'Entrar'}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mt-3 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="text-center mt-4">
          <button onClick={() => setShowSignup(true)} className="text-xs text-muted hover:text-accent transition-colors">
            Criar nova conta
          </button>
          <p className="text-[10px] text-muted mt-1">Dados locais. Sem login externo.</p>
        </div>
      </motion.div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
        active ? 'bg-accent/15 text-accent shadow-sm' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function PinDisplay({ pin }: { pin: string }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4 h-10">
      {Array.from({ length: 6 }, (_, i) => {
        const filled = i < pin.length;
        return (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border transition-all ${filled ? 'bg-accent border-accent' : 'border-border'}`}
          />
        );
      })}
    </div>
  );
}

function PinPad({ onDigit, onDelete, onSubmit, submitEnabled }: { onDigit: (d: string) => void; onDelete: () => void; onSubmit: () => void; submitEnabled: boolean }) {
  const digits = ['1','2','3','4','5','6','7','8','9'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {digits.map((d) => (
        <PadKey key={d} onClick={() => onDigit(d)}>{d}</PadKey>
      ))}
      <PadKey onClick={onDelete}><Delete className="w-4 h-4" /></PadKey>
      <PadKey onClick={() => onDigit('0')}>0</PadKey>
      <button
        onClick={onSubmit}
        disabled={!submitEnabled}
        className="h-12 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm disabled:opacity-30 shadow-glow-accent"
      >
        OK
      </button>
    </div>
  );
}

function PadKey({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="h-12 rounded-xl bg-bg-soft border border-border text-slate-100 text-lg font-medium hover:bg-card-hover hover:border-accent/40 transition-colors flex items-center justify-center"
    >
      {children}
    </button>
  );
}

function SignupPanel({ onSignedUp, onBack }: { onSignedUp: (t: string, u: any) => void; onBack?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePassword = () => {
    if (!username.trim() || username.trim().length < 3) return 'Usuário precisa ter ao menos 3 caracteres.';
    if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) return 'Usuário: só letras, números, . _ -';
    if (password.length < 8) return 'Senha precisa ter ao menos 8 caracteres.';
    if (password !== password2) return 'Senhas não conferem.';
    return null;
  };

  const goToPin = () => {
    const err = validatePassword();
    if (err) { setError(err); return; }
    setError(null);
    setStep(2);
  };

  const submit = async (withPin: boolean) => {
    setError(null);
    if (withPin) {
      if (!/^\d{4,6}$/.test(pin)) return setError('PIN de 4 a 6 dígitos.');
      if (pin !== pin2) return setError('PINs não conferem.');
    }
    setBusy(true);
    try {
      const payload: any = { username: username.trim(), password };
      if (withPin) payload.pin = pin;
      const r = await api.authSignup(payload);
      onSignedUp(r.token, r.user);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent-gradient flex items-center justify-center shadow-glow-accent mb-3">
            <Wallet className="w-7 h-7 text-slate-900" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao <span className="gradient-text">FinanceAi</span></h1>
          <p className="text-xs text-muted mt-1">{onBack ? 'Crie uma nova conta local' : 'Primeiro uso — crie sua conta local'}</p>
        </div>

        {onBack && (
          <button onClick={onBack} className="text-xs text-muted hover:text-slate-200 transition-colors mb-4 flex items-center gap-1">
            ← Voltar ao login
          </button>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Usuário</span>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
                  className="bg-bg-soft border border-border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:border-accent focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Senha (mín. 8)</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="bg-bg-soft border border-border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:border-accent focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Repita a senha</span>
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && goToPin()}
                  className="bg-bg-soft border border-border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:border-accent focus:outline-none" />
              </label>
              <button onClick={goToPin} className="mt-2 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent">
                Continuar
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-200">Definir um PIN de 4 a 6 dígitos para login rápido?</p>
              <p className="text-xs text-muted">Você sempre poderá usar a senha como fallback.</p>
              <div className="flex gap-2">
                <button onClick={() => setStep(3)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent">
                  Criar PIN
                </button>
                <button onClick={() => submit(false)} disabled={busy}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm disabled:opacity-50">
                  {busy ? 'Criando…' : 'Pular'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">PIN (4-6 dígitos)</span>
                <input type="password" inputMode="numeric" maxLength={6} pattern="\d*" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus
                  className="bg-bg-soft border border-border rounded-xl px-3 py-2.5 text-sm text-slate-100 tracking-widest text-center focus:border-accent focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Repita o PIN</span>
                <input type="password" inputMode="numeric" maxLength={6} pattern="\d*" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && submit(true)}
                  className="bg-bg-soft border border-border rounded-xl px-3 py-2.5 text-sm text-slate-100 tracking-widest text-center focus:border-accent focus:outline-none" />
              </label>
              <button onClick={() => submit(true)} disabled={busy}
                className="mt-2 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm disabled:opacity-50 shadow-glow-accent">
                {busy ? 'Criando…' : 'Finalizar'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
