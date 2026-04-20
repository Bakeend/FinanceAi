import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsHexColor, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Account } from './account.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CurrentUser } from '../auth/auth.module';

type U = { id: string; username: string };

class CreateAccountDto {
  @IsString() @MinLength(1) @MaxLength(50) nome: string;
  @IsIn(['conta', 'cartao', 'dinheiro', 'investimento']) tipo: 'conta' | 'cartao' | 'dinheiro' | 'investimento';
  @IsOptional() @IsHexColor() cor?: string;
  @IsOptional() @IsString() @MaxLength(50) banco?: string;
  @IsOptional() @IsInt() @Min(1) @Max(31) closingDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) dueDay?: number;
  @IsOptional() @IsNumber() @Min(0) limite?: number;
}
class UpdateAccountDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) nome?: string;
  @IsOptional() @IsHexColor() cor?: string;
  @IsOptional() @IsString() @MaxLength(50) banco?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(31) closingDay?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(31) dueDay?: number | null;
  @IsOptional() @IsNumber() @Min(0) limite?: number | null;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function currentInvoicePeriod(closingDay: number, today: Date = new Date()) {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  const dCurrent = today.getUTCDate();
  if (dCurrent <= closingDay) {
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevClosingDay = Math.min(closingDay, lastDayOfMonth(prevYear, prevMonth));
    const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevClosingDay).padStart(2, '0')}`;
    const thisClosingDay = Math.min(closingDay, lastDayOfMonth(y, m));
    const end = `${y}-${String(m).padStart(2, '0')}-${String(thisClosingDay).padStart(2, '0')}`;
    return { from: addDays(start, 1), to: end };
  }
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const thisClosingDay = Math.min(closingDay, lastDayOfMonth(y, m));
  const start = `${y}-${String(m).padStart(2, '0')}-${String(thisClosingDay).padStart(2, '0')}`;
  const nextClosingDay = Math.min(closingDay, lastDayOfMonth(nextYear, nextMonth));
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextClosingDay).padStart(2, '0')}`;
  return { from: addDays(start, 1), to: end };
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly repo: Repository<Account>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
  ) {}

  async list(userId: string) {
    const all = await this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    const results = await Promise.all(
      all.map(async (a) => {
        const row = await this.txRepo
          .createQueryBuilder('t')
          .select('COALESCE(SUM(t.valor), 0)', 'saldo')
          .where('t.account_id = :id AND t.is_transfer = 0 AND t.user_id = :uid', { id: a.id, uid: userId })
          .getRawOne<{ saldo: string }>();
        return { ...a, saldo: Number(row?.saldo ?? 0) };
      }),
    );
    return results;
  }

  async invoice(accountId: string, userId: string) {
    const acc = await this.repo.findOne({ where: { id: accountId, userId } });
    if (!acc) throw new NotFoundException('Conta não encontrada');
    if (acc.tipo !== 'cartao' || !acc.closingDay) {
      return { conta: acc, faturaAtual: 0, periodo: null, vencimento: null, transacoes: [], limiteDisponivel: null };
    }
    const periodo = currentInvoicePeriod(acc.closingDay);
    const txs = await this.txRepo
      .createQueryBuilder('t')
      .where('t.account_id = :id AND t.data >= :from AND t.data <= :to AND t.user_id = :uid', {
        id: accountId, from: periodo.from, to: periodo.to, uid: userId,
      })
      .orderBy('t.data', 'ASC')
      .getMany();
    const faturaAtual = txs.reduce((s, t) => s + (t.valor < 0 ? -t.valor : 0), 0);
    let vencimento: string | null = null;
    if (acc.dueDay) {
      const [y, m] = periodo.to.split('-').map(Number);
      const ventMes = m === 12 ? 1 : m + 1;
      const ventAno = m === 12 ? y + 1 : y;
      const dia = Math.min(acc.dueDay, lastDayOfMonth(ventAno, ventMes));
      vencimento = `${ventAno}-${String(ventMes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
    const limiteDisponivel = acc.limite != null ? acc.limite - faturaAtual : null;
    return { conta: acc, faturaAtual, periodo, vencimento, transacoes: txs, limiteDisponivel };
  }

  async create(dto: CreateAccountDto, userId: string) {
    return this.repo.save(this.repo.create({ ...dto, cor: dto.cor ?? '#38bdf8', userId } as any));
  }

  async findOrCreate(nome: string, userId: string): Promise<{ account: Account; created: boolean }> {
    const all = await this.repo.find({ where: { userId } });
    const existing = all.find((a) => a.nome.toLowerCase() === nome.toLowerCase());
    if (existing) return { account: existing, created: false };
    const draft = this.repo.create({ nome, tipo: 'conta' as const, cor: '#38bdf8', userId, banco: null, isDefault: false, closingDay: null, dueDay: null, limite: null });
    const account = await this.repo.save(draft);
    return { account, created: true };
  }

  async update(id: string, dto: UpdateAccountDto, userId: string) {
    const existing = await this.repo.findOne({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Conta não encontrada');
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id, userId } });
  }

  async remove(id: string, userId: string) {
    const acc = await this.repo.findOne({ where: { id, userId } });
    if (!acc) throw new NotFoundException('Conta não encontrada');
    if (acc.isDefault) throw new NotFoundException('Conta padrão não pode ser excluída');
    await this.repo.delete(id);
  }
}

@Controller('accounts')
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}
  @Get() list(@CurrentUser() u: U) { return this.svc.list(u.id); }
  @Post() create(@CurrentUser() u: U, @Body() dto: CreateAccountDto) { return this.svc.create(dto, u.id); }
  @Post('find-or-create') findOrCreate(@CurrentUser() u: U, @Body() body: { nome: string }) { return this.svc.findOrCreate(body.nome, u.id); }
  @Get(':id/invoice') invoice(@CurrentUser() u: U, @Param('id') id: string) { return this.svc.invoice(id, u.id); }
  @Patch(':id') update(@CurrentUser() u: U, @Param('id') id: string, @Body() dto: UpdateAccountDto) { return this.svc.update(id, dto, u.id); }
  @Delete(':id') async remove(@CurrentUser() u: U, @Param('id') id: string) { await this.svc.remove(id, u.id); return { ok: true }; }
}

@Module({
  imports: [TypeOrmModule.forFeature([Account, Transaction])],
  providers: [AccountsService],
  controllers: [AccountsController],
  exports: [TypeOrmModule, AccountsService],
})
export class AccountsModule {}
