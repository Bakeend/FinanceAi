import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User as UserIcon, Lock, KeyRound, LogOut, ShieldAlert, CheckCircle2, AlertCircle, Database, Download, Upload as UploadIcon, FileText, Bell, BellOff, Trash2 } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useAuth } from '../lib/auth';
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

  const submit = async () => {
    if (newPassword.length < 8) return flash('err', 'Nova senha precisa ter ao menos 8 caracteres.');
    if (newPassword !== repeat) return flash('err', 'Senhas não conferem.');
    setBusy(true);
    try {
      await api.authChangePassword({ currentPassword, newPassword });
      setCur(''); setNew(''); setRepeat('');
      flash('ok', 'Senha alterada.');
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
          className="self-start mt-1 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm disabled:opacity-50 shadow-glow-accent">
          {busy ? 'Salvando…' : 'Alterar senha'}
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

  const set = async () => {
    if (!/^\d{4,6}$/.test(pin)) return flash('err', 'PIN de 4 a 6 dígitos.');
    if (pin !== pin2) return flash('err', 'PINs não conferem.');
    setBusy(true);
    try {
      await api.authSetPin({ password, pin });
      setPassword(''); setPin(''); setPin2('');
      await refresh();
      flash('ok', hasPin ? 'PIN atualizado.' : 'PIN criado.');
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
            className="px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm disabled:opacity-50 shadow-glow-accent">
            {busy ? 'Salvando…' : hasPin ? 'Atualizar PIN' : 'Criar PIN'}
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
  // Backup precisa baixar COM o token. Geramos o link via fetch+blob.
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
    } catch (e) {
      flash('err', friendlyError(e));
    } finally { setBusy(false); }
  };
  return (
    <Section icon={Database} title="Backup do banco">
      <p className="text-xs text-muted mb-2">Salve uma cópia ou restaure. Inclui todas as transações, contas, orçamentos etc.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={download} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent disabled:opacity-50">
          <Download className="w-4 h-4" /> Baixar backup
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

function ExportSection() {
  // Os exports CSV/XLS precisam passar token. Faremos download via fetch.
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
        <button onClick={() => download(api.exportUrl(), 'financeai-export.csv')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm">
          <Download className="w-4 h-4" /> CSV
        </button>
        <button onClick={() => download(api.exportXlsUrl(), 'financeai-export.xls')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm">
          <Download className="w-4 h-4" /> Excel (.xls)
        </button>
      </div>
    </Section>
  );
}
