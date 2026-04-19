import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsHexColor, IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Trip } from './trip.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

class CreateTripDto {
  @IsString() @MinLength(1) @MaxLength(50) nome: string;
  @IsISO8601() inicio: string;
  @IsISO8601() fim: string;
  @IsOptional() @IsNumber() @Min(0) orcamento?: number;
  @IsOptional() @IsHexColor() cor?: string;
}
class UpdateTripDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) nome?: string;
  @IsOptional() @IsISO8601() inicio?: string;
  @IsOptional() @IsISO8601() fim?: string;
  @IsOptional() @IsNumber() @Min(0) orcamento?: number | null;
  @IsOptional() @IsHexColor() cor?: string;
}

function slug(s: string): string {
  const base = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  return `viagem-${base || Math.random().toString(36).slice(2, 7)}`;
}

export type TripProgress = {
  id: string;
  nome: string;
  tag: string;
  inicio: string;
  fim: string;
  orcamento: number | null;
  cor: string;
  gastoTotal: number;
  gastoPorCategoria: { categoria: string; valor: number }[];
  transacoes: number;
  diasRestantes: number;
  status: 'futura' | 'ativa' | 'passada';
};

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly repo: Repository<Trip>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
  ) {}

  async list(): Promise<TripProgress[]> {
    const trips = await this.repo.find({ order: { inicio: 'DESC' } });
    const today = new Date().toISOString().slice(0, 10);
    return Promise.all(trips.map(async (t) => {
      const rows = await this.txRepo
        .createQueryBuilder('tx')
        .where(`tx.is_transfer = 0 AND tx.valor < 0 AND tx.data >= :start AND tx.data <= :end AND (tx.tags LIKE :tagpat)`, {
          start: t.inicio, end: t.fim, tagpat: `%"${t.tag}"%`,
        })
        .getMany();
      const gastoTotal = rows.reduce((s, r) => s + (-r.valor), 0);
      const byCat = new Map<string, number>();
      for (const r of rows) byCat.set(r.categoria, (byCat.get(r.categoria) ?? 0) + (-r.valor));
      const status: 'futura' | 'ativa' | 'passada' = today < t.inicio ? 'futura' : today > t.fim ? 'passada' : 'ativa';
      const diasRestantes = Math.max(0, Math.ceil((new Date(t.fim).getTime() - new Date(today).getTime()) / 86400000));
      return {
        id: t.id, nome: t.nome, tag: t.tag, inicio: t.inicio, fim: t.fim,
        orcamento: t.orcamento, cor: t.cor,
        gastoTotal,
        gastoPorCategoria: Array.from(byCat, ([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor),
        transacoes: rows.length,
        diasRestantes,
        status,
      };
    }));
  }

  async create(dto: CreateTripDto) {
    if (dto.fim < dto.inicio) throw new NotFoundException('Fim antes do início');
    const tag = await this.uniqueTag(dto.nome);
    const row: Partial<Trip> = {
      nome: dto.nome, tag, inicio: dto.inicio, fim: dto.fim,
      orcamento: dto.orcamento ?? null, cor: dto.cor ?? '#22d3ee',
    };
    return this.repo.save(row as any);
  }

  private async uniqueTag(nome: string): Promise<string> {
    const base = slug(nome);
    let t = base;
    let n = 1;
    while (await this.repo.findOne({ where: { tag: t } })) {
      n++;
      t = `${base}-${n}`;
    }
    return t;
  }

  async update(id: string, dto: UpdateTripDto) {
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: string) {
    await this.repo.delete(id);
  }

  /** Retorna a viagem ativa hoje (se houver). Usada para auto-tag. */
  async activeToday(): Promise<Trip | null> {
    const today = new Date().toISOString().slice(0, 10);
    return this.repo.createQueryBuilder('t')
      .where('t.inicio <= :d AND t.fim >= :d', { d: today })
      .orderBy('t.created_at', 'DESC')
      .getOne();
  }
}

@Controller('trips')
export class TripsController {
  constructor(private readonly svc: TripsService) {}
  @Get() list() { return this.svc.list(); }
  @Get('active-today') active() { return this.svc.activeToday(); }
  @Post() create(@Body() dto: CreateTripDto) { return this.svc.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateTripDto) { return this.svc.update(id, dto); }
  @Delete(':id') async remove(@Param('id') id: string) { await this.svc.remove(id); return { ok: true }; }
}

@Module({
  imports: [TypeOrmModule.forFeature([Trip, Transaction])],
  providers: [TripsService],
  controllers: [TripsController],
  exports: [TripsService, TypeOrmModule],
})
export class TripsModule {}
