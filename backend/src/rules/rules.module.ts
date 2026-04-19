import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { TxRule } from './rule.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CATEGORIAS } from '../transactions/categoria.enum';

class CreateRuleDto {
  @IsString() @MinLength(2) @MaxLength(100) pattern: string;
  @IsIn(CATEGORIAS as unknown as string[]) categoria: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class UpdateRuleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) pattern?: string;
  @IsOptional() @IsIn(CATEGORIAS as unknown as string[]) categoria?: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(TxRule) private readonly repo: Repository<TxRule>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
  ) {}

  list() { return this.repo.find({ order: { priority: 'DESC', createdAt: 'ASC' } }); }

  create(dto: CreateRuleDto) {
    return this.repo.save(this.repo.create({ ...dto, priority: dto.priority ?? 0, active: dto.active ?? true } as any));
  }

  async update(id: string, dto: UpdateRuleDto) {
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Regra não encontrada');
    await this.repo.delete(id);
  }

  /** Aplica regras ativas a todas transações que ainda estão como "Outros". */
  async applyAll(): Promise<{ updated: number }> {
    const rules = await this.repo.find({ where: { active: true }, order: { priority: 'DESC' } });
    if (!rules.length) return { updated: 0 };
    const txs = await this.txRepo.find({ where: { categoria: 'Outros' } });
    let updated = 0;
    for (const tx of txs) {
      const match = rules.find((r) => this.matches(tx.descricao, r.pattern));
      if (match) {
        await this.txRepo.update(tx.id, { categoria: match.categoria });
        updated++;
      }
    }
    return { updated };
  }

  /** Retorna categoria sugerida por regra para uma descrição, ou null. */
  async findCategoria(descricao: string, rulesCache?: TxRule[]): Promise<string | null> {
    const rules = rulesCache ?? await this.repo.find({ where: { active: true }, order: { priority: 'DESC' } });
    const m = rules.find((r) => this.matches(descricao, r.pattern));
    return m ? m.categoria : null;
  }

  async loadActive(): Promise<TxRule[]> {
    return this.repo.find({ where: { active: true }, order: { priority: 'DESC' } });
  }

  matches(descricao: string, pattern: string): boolean {
    const d = descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const p = pattern.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!p) return false;
    // padrão com * no início/fim = contains; regex se começa com /
    if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
      try { return new RegExp(p.slice(1, -1), 'i').test(descricao); } catch { return false; }
    }
    return d.includes(p);
  }
}

@Controller('rules')
export class RulesController {
  constructor(private readonly svc: RulesService) {}
  @Get() list() { return this.svc.list(); }
  @Post() create(@Body() dto: CreateRuleDto) { return this.svc.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateRuleDto) { return this.svc.update(id, dto); }
  @Delete(':id') async remove(@Param('id') id: string) { await this.svc.remove(id); return { ok: true }; }
  @Post('apply') apply() { return this.svc.applyAll(); }
}

@Module({
  imports: [TypeOrmModule.forFeature([TxRule, Transaction])],
  providers: [RulesService],
  controllers: [RulesController],
  exports: [RulesService, TypeOrmModule],
})
export class RulesModule {}
