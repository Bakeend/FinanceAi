import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../transactions/entities/goal.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

export type GoalProgress = {
  id: string;
  categoria: string;
  valor: number;
  mes: number;
  ano: number;
  tipo: 'limite' | 'poupanca';
  gasto: number;
  percentual: number;
};

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal) private readonly goalRepo: Repository<Goal>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
  ) {}

  async list(mes: number, ano: number): Promise<GoalProgress[]> {
    const goals = await this.goalRepo.find({ where: { mes, ano } });
    if (!goals.length) return [];
    const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const endMonth = mes === 12 ? 1 : mes + 1;
    const endYear = mes === 12 ? ano + 1 : ano;
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    const rows = await this.txRepo
      .createQueryBuilder('t')
      .select('t.categoria', 'categoria')
      .addSelect('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
      .where('t.data >= :start AND t.data < :end', { start, end })
      .groupBy('t.categoria')
      .getRawMany<{ categoria: string; gasto: string }>();
    const byCat = new Map(rows.map((r) => [r.categoria, Number(r.gasto)]));
    return goals.map((g) => {
      const gasto = byCat.get(g.categoria) ?? 0;
      return {
        id: g.id,
        categoria: g.categoria,
        valor: g.valor,
        mes: g.mes,
        ano: g.ano,
        tipo: g.tipo,
        gasto,
        percentual: g.valor > 0 ? (gasto / g.valor) * 100 : 0,
      };
    });
  }

  create(dto: { categoria: string; valor: number; mes: number; ano: number; tipo?: 'limite' | 'poupanca' }) {
    return this.goalRepo.save(this.goalRepo.create({ ...dto, tipo: dto.tipo ?? 'limite' }));
  }

  async update(id: string, patch: Partial<{ valor: number; categoria: string; tipo: 'limite' | 'poupanca' }>) {
    await this.goalRepo.update(id, patch);
    return this.goalRepo.findOne({ where: { id } });
  }

  async remove(id: string) {
    await this.goalRepo.delete(id);
  }
}
