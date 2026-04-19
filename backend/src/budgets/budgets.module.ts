import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { Budget } from './budget.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CATEGORIAS } from '../transactions/categoria.enum';

class CreateBudgetDto {
  @IsIn(CATEGORIAS as unknown as string[]) categoria: string;
  @IsNumber() mes: number;
  @IsNumber() ano: number;
  @IsNumber() @Min(0) valor: number;
}
class UpdateBudgetDto {
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsString() categoria?: string;
}

export type BudgetProgress = {
  id: string;
  categoria: string;
  mes: number;
  ano: number;
  valor: number;
  gasto: number;
  percentual: number;
  restante: number;
  projecao: number;
  status: 'ok' | 'alerta' | 'estourado';
  mensagem: string;
};

function monthRange(mes: number, ano: number) {
  const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const endMonth = mes === 12 ? 1 : mes + 1;
  const endYear = mes === 12 ? ano + 1 : ano;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  return { start, end };
}

function daysInMonth(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget) private readonly repo: Repository<Budget>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
  ) {}

  async list(mes: number, ano: number): Promise<BudgetProgress[]> {
    const budgets = await this.repo.find({ where: { mes, ano } });
    if (!budgets.length) return [];
    const { start, end } = monthRange(mes, ano);
    const rows = await this.txRepo
      .createQueryBuilder('t')
      .select('t.categoria', 'categoria')
      .addSelect('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
      .where('t.data >= :start AND t.data < :end AND t.is_transfer = 0', { start, end })
      .groupBy('t.categoria')
      .getRawMany<{ categoria: string; gasto: string }>();
    const byCat = new Map(rows.map((r) => [r.categoria, Number(r.gasto)]));

    const today = new Date();
    const isCurrentMonth =
      today.getMonth() + 1 === mes && today.getFullYear() === ano;
    const totalDias = daysInMonth(mes, ano);
    const diaAtual = isCurrentMonth ? today.getDate() : totalDias;

    return budgets.map((b) => {
      const gasto = byCat.get(b.categoria) ?? 0;
      const percentual = b.valor > 0 ? (gasto / b.valor) * 100 : 0;
      const restante = b.valor - gasto;
      const projecao = isCurrentMonth && diaAtual > 0
        ? (gasto / diaAtual) * totalDias
        : gasto;
      let status: 'ok' | 'alerta' | 'estourado' = 'ok';
      if (percentual >= 100) status = 'estourado';
      else if (percentual >= 80) status = 'alerta';
      const mensagem = this.buildMensagem({ status, restante, projecao, limite: b.valor, isCurrentMonth });
      return {
        id: b.id,
        categoria: b.categoria,
        mes: b.mes,
        ano: b.ano,
        valor: b.valor,
        gasto,
        percentual,
        restante,
        projecao,
        status,
        mensagem,
      };
    }).sort((a, b) => b.percentual - a.percentual);
  }

  private buildMensagem({ status, restante, projecao, limite, isCurrentMonth }: {
    status: 'ok' | 'alerta' | 'estourado'; restante: number; projecao: number; limite: number; isCurrentMonth: boolean;
  }): string {
    const fmt = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;
    if (status === 'estourado') return `Limite estourado em ${fmt(-restante)}.`;
    if (!isCurrentMonth) return status === 'alerta' ? `Mês fechou em ${fmt(-restante + limite)} / ${fmt(limite)}.` : `Dentro do orçamento.`;
    if (projecao > limite) {
      const falta = projecao - limite;
      return `No ritmo atual, vai faltar ${fmt(falta)} no fim do mês.`;
    }
    if (status === 'alerta') return `Perto do limite — restam ${fmt(restante)}.`;
    return `No ritmo, deve sobrar ${fmt(Math.max(0, limite - projecao))}.`;
  }

  async create(dto: CreateBudgetDto) {
    return this.repo.save(this.repo.create(dto as any));
  }

  async update(id: string, dto: UpdateBudgetDto) {
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: string) {
    const b = await this.repo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Orçamento não encontrado');
    await this.repo.delete(id);
  }

  async copyFromPreviousMonth(mes: number, ano: number) {
    const prevMes = mes === 1 ? 12 : mes - 1;
    const prevAno = mes === 1 ? ano - 1 : ano;
    const prev = await this.repo.find({ where: { mes: prevMes, ano: prevAno } });
    if (!prev.length) return { copied: 0 };
    const existing = await this.repo.find({ where: { mes, ano } });
    const existingCats = new Set(existing.map((e) => e.categoria));
    const toInsert = prev
      .filter((p) => !existingCats.has(p.categoria))
      .map((p) => ({ categoria: p.categoria, valor: p.valor, mes, ano }));
    if (toInsert.length) await this.repo.save(toInsert as any);
    return { copied: toInsert.length };
  }
}

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly svc: BudgetsService) {}
  @Get() list(@Query('mes') mes?: string, @Query('ano') ano?: string) {
    const m = Number(mes ?? new Date().getMonth() + 1);
    const a = Number(ano ?? new Date().getFullYear());
    return this.svc.list(m, a);
  }
  @Post() create(@Body() dto: CreateBudgetDto) { return this.svc.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateBudgetDto) { return this.svc.update(id, dto); }
  @Delete(':id') async remove(@Param('id') id: string) { await this.svc.remove(id); return { ok: true }; }
  @Post('copy-previous') async copy(@Body() body: { mes: number; ano: number }) {
    return this.svc.copyFromPreviousMonth(body.mes, body.ano);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Budget, Transaction])],
  providers: [BudgetsService],
  controllers: [BudgetsController],
  exports: [TypeOrmModule],
})
export class BudgetsModule {}
