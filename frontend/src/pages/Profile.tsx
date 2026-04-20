import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { User as UserIcon, Lock, KeyRound, LogOut, ShieldAlert, CheckCircle2, AlertCircle, Database, Download, Upload as UploadIcon, FileText, Bell, BellOff, Trash2, Sun, Moon, Clock, Check, Terminal, Sparkles, Compass, Keyboard, Film } from 'lucide-react';
import { LUNA_TOUR_EVENT } from '../components/Layout';
import { LunaWrapped } from '../components/LunaWrapped';
import { api, friendlyError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { isNotificationEnabled, requestNotificationPermission, notifyNow } from '../lib/notifications';

export function ProfilePage() {
  const { user, logout, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flash = (kind: 'ok' | 'err', text: string) => {
    if (kind === 'ok') { setMsg(text); setError(null); }
    else { setError(text); setMsg(null); }
    setTimeout(() => { setMsg(null); setError(null); }, 4000);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Meu <span className="gradient-text">perfil</span>
          </h2>
          <p className="text-muted text-sm mt-1">Configurações de conta, segurança e sistema</p>
        </div>
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-700/40 bg-rose-500/10 text-rose-300 text-sm hover:bg-rose-500/20"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </motion.div>

      {msg && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> <span>{msg}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-3 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold text-slate-100 truncate">{user.username}</div>
            <div className="text-xs text-muted">
              {user.hasPin ? 'PIN configurado' : 'Sem PIN'}
              {user.createdAt ? ` · conta criada em ${new Date(user.createdAt).toLocaleDateString('pt-BR')}` : ''}
            </div>
          </div>
        </div>
      </div>

      <ChangePasswordSection flash={flash} />
      <PinSection hasPin={user.hasPin} refresh={refreshMe} flash={flash} />
      <LogoutAllSection flash={flash} logout={logout} />

      <ThemeSection />
      <WelcomeAnimationSection />
      <LunaTourSection />
      <WrappedSection />
      <ShortcutsSection />
      <NotificationsSection flash={flash} />
      <BackupSection flash={flash} />
      <ExportSection />
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ChangePasswordSection({ flash }: { flash: (k: 'ok' | 'err', t: string) => void }) {
  const [currentPassword, setCur] = useState('');
  const [newPassword, setNew] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (newPassword.length < 8) return flash('err', 'Nova senha precisa ter ao menos 8 caracteres.');
    if (newPassword !== repeat) return flash('err', 'Senhas não conferem.');
    setBusy(true);
    try {
      await api.authChangePassword({ currentPassword, newPassword });
      setCur(''); setNew(''); setRepeat('');
      flash('ok', 'Senha alterada.');
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      flash('err', friendlyError(e));
    } finally { setBusy(false); }
  };

  return (
    <Section icon={Lock} title="Alterar senha">
      <div className="flex flex-col gap-2">
        <input type="password" placeholder="Senha atual" value={currentPassword} onChange={(e) => setCur(e.target.value)}
          className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none" />
        <input type="password" placeholder="Nova senha (mín. 8)" value={newPassword} onChange={(e) => setNew(e.target.value)}
          className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none" />
        <input type="password" placeholder="Repita a nova senha" value={repeat} onChange={(e) => setRepeat(e.target.value)}
          className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none" />
        <button onClick={submit} disabled={busy || !currentPassword || !newPassword}
          className={`self-start mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all duration-200 overflow-hidden ${
            done ? 'bg-emerald-500/20 border border-emerald-600/50 text-emerald-300' : 'bg-accent-gradient text-slate-900 shadow-glow-accent'
          }`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={done ? 'check' : 'icon'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center">
              {done && <Check className="w-4 h-4" />}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={done ? 'done' : busy ? 'saving' : 'idle'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              {done ? 'Alterada!' : busy ? 'Salvando…' : 'Alterar senha'}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </Section>
  );
}

function PinSection({ hasPin, refresh, flash }: { hasPin: boolean; refresh: () => void; flash: (k: 'ok' | 'err', t: string) => void }) {
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = async () => {
    if (!/^\d{4,6}$/.test(pin)) return flash('err', 'PIN de 4 a 6 dígitos.');
    if (pin !== pin2) return flash('err', 'PINs não conferem.');
    setBusy(true);
    try {
      await api.authSetPin({ password, pin });
      setPassword(''); setPin(''); setPin2('');
      await refresh();
      flash('ok', hasPin ? 'PIN atualizado.' : 'PIN criado.');
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      flash('err', friendlyError(e));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm('Remover PIN? Login rápido ficará indisponível.')) return;
    setBusy(true);
    try {
      await api.authRemovePin();
      await refresh();
      flash('ok', 'PIN removido.');
    } catch (e) {
      flash('err', friendlyError(e));
    } finally { setBusy(false); }
  };

  return (
    <Section icon={KeyRound} title={hasPin ? 'Alterar / remover PIN' : 'Criar PIN de login rápido'}>
      <div className="flex flex-col gap-2">
        <input type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)}
          className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <input type="password" inputMode="numeric" maxLength={6} placeholder={hasPin ? 'Novo PIN' : 'PIN (4-6 dígitos)'} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 tracking-widest text-center focus:border-accent focus:outline-none" />
          <input type="password" inputMode="numeric" maxLength={6} placeholder="Repita" value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
            className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 tracking-widest text-center focus:border-accent focus:outline-none" />
        </div>
        <div className="flex gap-2 mt-1">
          <button onClick={set} disabled={busy || !password || !pin}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all duration-200 overflow-hidden ${
              done ? 'bg-emerald-500/20 border border-emerald-600/50 text-emerald-300' : 'bg-accent-gradient text-slate-900 shadow-glow-accent'
            }`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={done ? 'check' : 'icon'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center">
                {done && <Check className="w-4 h-4" />}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={done ? 'done' : busy ? 'saving' : 'idle'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                {done ? (hasPin ? 'Atualizado!' : 'Criado!') : busy ? 'Salvando…' : hasPin ? 'Atualizar PIN' : 'Criar PIN'}
              </motion.span>
            </AnimatePresence>
          </button>
          {hasPin && (
            <button onClick={remove} disabled={busy}
              className="px-3 py-2 rounded-xl border border-rose-700/40 bg-rose-500/10 text-rose-300 text-sm disabled:opacity-50">
              <Trash2 className="w-4 h-4 inline mr-1" />
              Remover
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}

function LogoutAllSection({ flash, logout }: { flash: (k: 'ok' | 'err', t: string) => void; logout: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!confirm('Sair de TODOS os dispositivos? Você precisará logar novamente aqui também.')) return;
    setBusy(true);
    try {
      await api.authLogoutAll();
      flash('ok', 'Sessões encerradas.');
      setTimeout(() => { logout(); window.location.reload(); }, 800);
    } catch (e) {
      flash('err', friendlyError(e));
    } finally { setBusy(false); }
  };
  return (
    <Section icon={ShieldAlert} title="Segurança">
      <p className="text-xs text-muted mb-2">Gira a chave de assinatura — invalida todos os tokens, em todos dispositivos.</p>
      <button onClick={run} disabled={busy}
        className="px-3 py-2 rounded-xl border border-amber-700/40 bg-amber-500/10 text-amber-200 text-sm disabled:opacity-50">
        {busy ? 'Encerrando…' : 'Sair de todos os dispositivos'}
      </button>
    </Section>
  );
}

function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'dark', label: 'Escuro', Icon: Moon },
    { value: 'light', label: 'Claro', Icon: Sun },
    { value: 'auto', label: 'Auto', Icon: Clock },
    { value: 'retro', label: 'Retrô', Icon: Terminal },
  ] as const;
  return (
    <Section icon={Sun} title="Aparência">
      <p className="text-xs text-muted mb-3">Modo automático muda entre escuro (18h–6h) e claro (6h–18h). Retrô: terminal CRT anos 80.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-all duration-150 ${theme === value ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-slate-200 hover:border-accent/50'}`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function WelcomeAnimationSection() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('financeai-welcome-enabled') !== 'false';
  });
  useEffect(() => {
    localStorage.setItem('financeai-welcome-enabled', enabled ? 'true' : 'false');
  }, [enabled]);
  const replay = () => {
    sessionStorage.removeItem('financeai-welcome-shown');
    window.location.href = '/';
  };
  return (
    <Section icon={Sparkles} title="Boas-vindas">
      <p className="text-xs text-muted mb-3">Tela animada de saudação ao abrir o Dashboard pela primeira vez na sessão.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-xl border border-border bg-bg-soft">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-sm text-slate-200">{enabled ? 'Ativada' : 'Desativada'}</span>
        </label>
        {enabled && (
          <button
            onClick={replay}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm hover:bg-card-hover/50"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" /> Ver de novo
          </button>
        )}
      </div>
    </Section>
  );
}

function LunaTourSection() {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState(() => localStorage.getItem('financeai-luna-tour-completed') === '1');
  const completedAt = localStorage.getItem('financeai-luna-tour-completed-at');
  useEffect(() => {
    const onDone = () => setCompleted(localStorage.getItem('financeai-luna-tour-completed') === '1');
    window.addEventListener('financeai:luna-tour-done', onDone);
    return () => window.removeEventListener('financeai:luna-tour-done', onDone);
  }, []);
  const start = () => {
    navigate('/');
    setTimeout(() => window.dispatchEvent(new Event(LUNA_TOUR_EVENT)), 200);
  };
  return (
    <Section icon={Compass} title="Tour da Luna">
      <p className="text-xs text-muted mb-3">Tutorial guiado das principais funções do app, com a Luna te explicando passo a passo.</p>
      {completed && (
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-600/40 text-emerald-300 text-xs">
          <Check className="w-3.5 h-3.5" />
          <span>
            Tutorial concluído
            {completedAt && (
              <span className="text-emerald-400/70 ml-1">
                · {new Date(completedAt).toLocaleDateString('pt-BR')}
              </span>
            )}
          </span>
        </div>
      )}
      <div>
        <button
          onClick={start}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent hover:bg-accent-gradient-hover"
        >
          <Compass className="w-4 h-4" />
          {completed ? 'Refazer tour' : 'Começar tour'}
        </button>
      </div>
    </Section>
  );
}

function WrappedSection() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  return (
    <Section icon={Film} title="Retrospectiva da Luna">
      <p className="text-xs text-muted mb-3">Resumo do seu ano em cards animados, no estilo "wrapped". Compartilhável.</p>
      <div className="flex items-center gap-2">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 cursor-pointer focus:border-accent focus:outline-none"
        >
          {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent hover:bg-accent-gradient-hover"
        >
          <Film className="w-4 h-4" /> Ver retrospectiva
        </button>
      </div>
      {open && <LunaWrapped year={year} onClose={() => setOpen(false)} />}
    </Section>
  );
}

function ShortcutsSection() {
  const groups: { title: string; items: { keys: string[]; label: string }[] }[] = [
    {
      title: 'Navegação',
      items: [
        { keys: ['D'], label: 'Dashboard' },
        { keys: ['T'], label: 'Transações' },
        { keys: ['N'], label: 'Nova transação' },
        { keys: ['U'], label: 'Upload de extrato' },
        { keys: ['A'], label: 'Contas' },
        { keys: ['B'], label: 'Orçamento' },
        { keys: ['G'], label: 'Metas' },
        { keys: ['R'], label: 'Relatórios' },
        { keys: ['I'], label: 'Insights da Luna' },
        { keys: ['C'], label: 'Conversar com a Luna' },
        { keys: ['P'], label: 'Perfil' },
      ],
    },
    {
      title: 'Geral',
      items: [
        { keys: ['Ctrl', 'K'], label: 'Abrir busca global' },
        { keys: ['S'], label: 'Abrir busca (alternativo)' },
        { keys: ['/'], label: 'Abrir busca (alternativo)' },
        { keys: ['?'], label: 'Mostrar atalhos rápidos' },
        { keys: ['Esc'], label: 'Fechar modal · sair de input' },
      ],
    },
    {
      title: 'Tour da Luna',
      items: [
        { keys: ['→'], label: 'Próximo passo' },
        { keys: ['←'], label: 'Passo anterior' },
        { keys: ['Esc'], label: 'Pular tour' },
      ],
    },
  ];
  return (
    <Section icon={Keyboard} title="Atalhos do teclado">
      <p className="text-xs text-muted mb-3">Comandos rápidos pra navegar sem tirar a mão do teclado.</p>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted mb-2">{g.title}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {g.items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-bg-soft border border-border"
                >
                  <span className="text-sm text-slate-200 truncate">{it.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {it.keys.map((k, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        {idx > 0 && <span className="text-muted text-[10px]">+</span>}
                        <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-border bg-card text-[11px] font-mono font-bold text-accent">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function NotificationsSection({ flash }: { flash: (k: 'ok' | 'err', t: string) => void }) {
  const [notifOn, setNotifOn] = useState(isNotificationEnabled());
  const enable = async () => {
    const ok = await requestNotificationPermission();
    setNotifOn(ok);
    if (ok) { notifyNow('FinanceAi', 'Notificações ativadas 👍'); flash('ok', 'Notificações ativadas.'); }
    else flash('err', 'Permissão recusada pelo navegador.');
  };
  return (
    <Section icon={notifOn ? Bell : BellOff} title="Notificações do navegador">
      <p className="text-xs text-muted mb-2">Alertas locais pra vencimento de cartão, orçamento e lembretes.</p>
      <button onClick={enable} disabled={notifOn}
        className="px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm disabled:opacity-60">
        <Bell className="w-4 h-4 inline mr-1" />
        {notifOn ? 'Ativadas' : 'Ativar notificações'}
      </button>
    </Section>
  );
}

function BackupSection({ flash }: { flash: (k: 'ok' | 'err', t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const restore = async (file: File) => {
    if (!confirm(`Substituir o banco atual pelo conteúdo de "${file.name}"? Ação irreversível.`)) return;
    setBusy(true);
    try {
      const r = await api.restoreBackup(file);
      flash('ok', r.message);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      flash('err', friendlyError(e));
    } finally { setBusy(false); }
  };
  const download = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem('financeai-token');
      const res = await fetch(api.backupUrl(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financeai-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch (e) {
      flash('err', friendlyError(e));
    } finally { setBusy(false); }
  };
  return (
    <Section icon={Database} title="Backup do banco">
      <p className="text-xs text-muted mb-2">Salve uma cópia ou restaure. Inclui todas as transações, contas, orçamentos etc.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={download} disabled={busy}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all duration-200 overflow-hidden ${
            downloaded ? 'bg-emerald-500/20 border border-emerald-600/50 text-emerald-300' : 'bg-accent-gradient text-slate-900 shadow-glow-accent'
          }`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={downloaded ? 'check' : 'dl'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center">
              {downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={downloaded ? 'done' : 'idle'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              {downloaded ? 'Baixado!' : busy ? 'Baixando…' : 'Baixar backup'}
            </motion.span>
          </AnimatePresence>
        </button>
        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm cursor-pointer">
          <UploadIcon className="w-4 h-4" /> {busy ? 'Restaurando…' : 'Restaurar backup'}
          <input type="file" accept=".db" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
        </label>
      </div>
    </Section>
  );
}

function ExportButton({ label, onDownload }: { label: string; onDownload: () => Promise<void> }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await onDownload();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } finally { setBusy(false); }
  };
  return (
    <button onClick={handle} disabled={busy}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm disabled:opacity-50 transition-all duration-200 overflow-hidden ${
        done ? 'border-emerald-600/50 bg-emerald-500/10 text-emerald-300' : 'border-border bg-card-hover/30 text-slate-200'
      }`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? 'check' : 'dl'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center">
          {done ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
        </motion.span>
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? 'done' : 'idle'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
          {done ? 'Baixado!' : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function ExportSection() {
  const token = () => localStorage.getItem('financeai-token');
  const download = async (url: string, filename: string) => {
    const t = token();
    const res = await fetch(url, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = filename; a.click();
    URL.revokeObjectURL(u);
  };
  return (
    <Section icon={FileText} title="Exportar dados">
      <p className="text-xs text-muted mb-2">Formatos de texto pra abrir em outras ferramentas.</p>
      <div className="flex flex-wrap gap-2">
        <ExportButton label="CSV" onDownload={() => download(api.exportUrl(), 'financeai-export.csv')} />
        <ExportButton label="Excel (.xls)" onDownload={() => download(api.exportXlsUrl(), 'financeai-export.xls')} />
      </div>
    </Section>
  );
}
