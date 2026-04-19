import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsHexColor, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Account } from './account.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

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

/** Calcula intervalo da fatura atual de um cartão baseado em closingDay. */
function currentInvoicePeriod(closingDay: number, today: Date = new Date()) {
  // Fatura atual: (ano,mes com closing -1) dia após closing → (ano,mes atual) dia do closing
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1; // 1-12
  const dCurrent = today.getUTCDate();
  // Se ainda não passou do closing do mês atual, período = closing mês anterior+1 → closing mês atual
  if (dCurrent <= closingDay) {
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevClosingDay = Math.min(closingDay, lastDayOfMonth(prevYear, prevMonth));
    const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevClosingDay).padStart(2, '0')}`;
    const thisClosingDay = Math.min(closingDay, lastDayOfMonth(y, m));
    const end = `${y}-${String(m).padStart(2, '0')}-${String(thisClosingDay).padStart(2, '0')}`;
    return { from: addDays(start, 1), to: end };
  }
  // Se passou do closing do mês atual, período = closing atual+1 → closing mês que vem
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

  async list() {
    const all = await this.repo.find({ order: { createdAt: 'ASC' } });
    const results = await Promise.all(
      all.map(async (a) => {
        const row = await this.txRepo
          .createQueryBuilder('t')
          .select('COALESCE(SUM(t.valor), 0)', 'saldo')
          .where('t.account_id = :id AND t.is_transfer = 0', { id: a.id })
          .getRawOne<{ saldo: string }>();
        return { ...a, saldo: Number(row?.saldo ?? 0) };
      }),
    );
    return results;
  }

  async invoice(accountId: string) {
    const acc = await this.repo.findOne({ where: { id: accountId } });
    if (!acc) throw new NotFoundException('Conta não encontrada');
    if (acc.tipo !== 'cartao' || !acc.closingDay) {
      return { conta: acc, faturaAtual: 0, periodo: null, vencimento: null, transacoes: [], limiteDisponivel: null };
    }
    const periodo = currentInvoicePeriod(acc.closingDay);
    const txs = await this.txRepo
      .createQueryBuilder('t')
      .where('t.account_id = :id AND t.data >= :from AND t.data <= :to', {
        id: accountId, from: periodo.from, to: periodo.to,
      })
      .orderBy('t.data', 'ASC')
      .getMany();
    const faturaAtual = txs.reduce((s, t) => s + (t.valor < 0 ? -t.valor : 0), 0);
    // Vencimento: dueDay do mês seguinte ao closing "to"
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

  create(dto: CreateAccountDto) {
    return this.repo.save(this.repo.create({ ...dto, cor: dto.cor ?? '#38bdf8' } as any));
  }

  async update(id: string, dto: UpdateAccountDto) {
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: string) {
    const acc = await this.repo.findOne({ where: { id } });
    if (!acc) throw new NotFoundException('Conta não encontrada');
    if (acc.isDefault) throw new NotFoundException('Conta padrão não pode ser excluída');
    await this.repo.delete(id);
  }
}

@Controller('accounts')
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}
  @Get() list() { return this.svc.list(); }
  @Post() create(@Body() dto: CreateAccountDto) { return this.svc.create(dto); }
  @Get(':id/invoice') invoice(@Param('id') id: string) { return this.svc.invoice(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAccountDto) { return this.svc.update(id, dto); }
  @Delete(':id') async remove(@Param('id') id: string) { await this.svc.remove(id); return { ok: true }; }
}

@Module({
  imports: [TypeOrmModule.forFeature([Account, Transaction])],
  providers: [AccountsService],
  controllers: [AccountsController],
  exports: [TypeOrmModule],
})
export class AccountsModule {}
