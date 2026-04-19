import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const TOKEN_KEY = 'financeai-token';
const USER_KEY = 'financeai-user';

export type AuthUser = { id: string; username: string; hasPin: boolean; createdAt?: string };

type AuthCtx = {
  user: AuthUser | null;
  token: string | null;
  status: 'loading' | 'unauth' | 'auth';
  needsSetup: boolean;
  setSession: (t: string, u: AuthUser) => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

const BASE = import.meta.env.VITE_API_URL ?? '';

function getTokenFromStorage(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return getTokenFromStorage();
}

export function getUsernameCache(): string | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser).username : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'unauth' | 'auth'>('loading');
  const [needsSetup, setNeedsSetup] = useState(false);

  const applySession = (t: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
    setStatus('auth');
  };

  const clear = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setStatus('unauth');
  };

  const refreshMe = async () => {
    const t = getTokenFromStorage();
    if (!t) {
      setToken(null);
      setUser(null);
      setStatus('unauth');
      return;
    }
    try {
      const res = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) {
        clear();
        return;
      }
      const u = await res.json();
      setToken(t);
      setUser(u);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setStatus('auth');
    } catch {
      clear();
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const s = await fetch(`${BASE}/auth/status`).then((r) => r.json());
        if (!s?.hasUsers) {
          // banco sem usuários: limpa cache de user/token stale pra forçar setup limpo
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setNeedsSetup(true);
          setStatus('unauth');
          return;
        }
        await refreshMe();
      } catch {
        setNeedsSetup(false);
        setStatus('unauth');
      }
    })();
  }, []);

  return (
    <Ctx.Provider value={{ user, token, status, needsSetup, setSession: applySession, refreshMe, logout: clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
