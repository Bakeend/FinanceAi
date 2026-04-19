import * as dotenv from 'dotenv';
dotenv.config({ override: true });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AiErrorsFilter } from './ai/ai-errors.filter';

function parseAllowedOrigins(): string[] {
  const raw = process.env.APP_REFERER ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\/[^\s,]+$/i.test(s));
}

function isLanOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const h = u.hostname;
    // localhost, 127.x, redes privadas RFC1918, link-local, IPv6 local
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return true;
    if (/^169\.254\.\d+\.\d+$/.test(h)) return true;
    if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
    return false;
  } catch { return false; }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowed = parseAllowedOrigins();
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowed.includes(origin) || isLanOrigin(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: false,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new AiErrorsFilter());
  // Bind em 0.0.0.0 pra aceitar conexões de outros dispositivos na mesma rede
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}
bootstrap();
