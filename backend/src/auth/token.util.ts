import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const SECRET_PATH = resolve(process.cwd(), process.env.DATABASE_PATH ? dirname(process.env.DATABASE_PATH) : './data', '.auth-secret');

/** Carrega/gera a secret do app. Persiste em arquivo local ao lado do DB. */
function loadSecret(): Buffer {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32) {
    return Buffer.from(process.env.AUTH_SECRET, 'utf8');
  }
  mkdirSync(dirname(SECRET_PATH), { recursive: true });
  if (existsSync(SECRET_PATH)) {
    return readFileSync(SECRET_PATH);
  }
  const fresh = randomBytes(48);
  writeFileSync(SECRET_PATH, fresh, { mode: 0o600 });
  return fresh;
}

let SECRET = loadSecret();

/** Roda todos os tokens ao invalidar (logout all devices). */
export function rotateSecret(): void {
  SECRET = randomBytes(48);
  writeFileSync(SECRET_PATH, SECRET, { mode: 0o600 });
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromBase64url(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + '='.repeat(pad), 'base64');
}

export type TokenPayload = { sub: string; exp: number; iat: number };

/** Cria token assinado com HMAC-SHA256. TTL default: 30 dias. */
export function signToken(userId: string, ttlSeconds = 30 * 24 * 60 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub: userId, iat: now, exp: now + ttlSeconds };
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = base64url(createHmac('sha256', SECRET).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = base64url(createHmac('sha256', SECRET).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromBase64url(body).toString('utf8')) as TokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.sub !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

/** Hashing via scrypt. Retorna { salt, hash } em hex. */
export function hashSecret(plain: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifySecret(plain: string, salt: string, hash: string): boolean {
  try {
    const derived = scryptSync(plain, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch { return false; }
}
