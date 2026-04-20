import { Controller, Get } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Public } from '../auth/auth.module';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/account.entity';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Account) private readonly accRepo: Repository<Account>,
  ) {}

  private async timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; latencyMs: number; error: string | null; result?: T }> {
    const t = Date.now();
    try {
      const result = await fn();
      return { ok: true, latencyMs: Date.now() - t, error: null, result };
    } catch (e: any) {
      return { ok: false, latencyMs: Date.now() - t, error: e?.message ?? 'unknown' };
    }
  }

  @Public()
  @Get()
  async health() {
    const t0 = Date.now();
    const [db, tx, acc] = await Promise.all([
      this.timed(() => this.ds.query('SELECT 1')),
      this.timed(() => this.txRepo.count()),
      this.timed(() => this.accRepo.count()),
    ]);

    const aiConfigured = !!process.env.OPENROUTER_API_KEY;

    return {
      ok: db.ok && tx.ok && acc.ok,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      services: {
        api: { ok: true, latencyMs: Date.now() - t0 },
        db: { ok: db.ok, latencyMs: db.latencyMs, error: db.error },
        transactions: { ok: tx.ok, latencyMs: tx.latencyMs, error: tx.error },
        accounts: { ok: acc.ok, latencyMs: acc.latencyMs, error: acc.error },
        luna: { ok: aiConfigured, configured: aiConfigured, error: aiConfigured ? null : 'API key não configurada' },
      },
    };
  }
}
