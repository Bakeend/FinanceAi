import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { TxRule } from './rule.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CATEGORIAS } from '../transactions/categoria.enum';
import { CurrentUser } from '../auth/auth.module';

type U = { id: string; username: string };

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

  list(userId: string) { return this.repo.find({ where: { userId }, order: { priority: 'DESC', createdAt: 'ASC' } }); }

  create(dto: CreateRuleDto, userId: string) {
    return this.repo.save(this.repo.create({ ...dto, priority: dto.priority ?? 0, active: dto.active ?? true, userId } as any));
  }

  async update(id: string, dto: UpdateRuleDto, userId: string) {
    const existing = await this.repo.findOne({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Regra não encontrada');
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id, userId } });
  }

  async remove(id: string, userId: string) {
    const r = await this.repo.findOne({ where: { id, userId } });
    if (!r) throw new NotFoundException('Regra não encontrada');
    await this.repo.delete(id);
  }

  async applyAll(userId: string): Promise<{ updated: number }> {
    const rules = await this.repo.find({ where: { active: true, userId }, order: { priority: 'DESC' } });
    if (!rules.length) return { updated: 0 };
    const txs = await this.txRepo.find({ where: { categoria: 'Outros', userId } });
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

  async loadActive(userId: string): Promise<TxRule[]> {
    return this.repo.find({ where: { active: true, userId }, order: { priority: 'DESC' } });
  }

  matches(descricao: string, pattern: string): boolean {
    const d = descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const p = pattern.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!p) return false;
    if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
      try { return new RegExp(p.slice(1, -1), 'i').test(descricao); } catch { return false; }
    }
    return d.includes(p);
  }
}

@Controller('rules')
export class RulesController {
  constructor(private readonly svc: RulesService) {}
  @Get() list(@CurrentUser() u: U) { return this.svc.list(u.id); }
  @Post() create(@CurrentUser() u: U, @Body() dto: CreateRuleDto) { return this.svc.create(dto, u.id); }
  @Patch(':id') update(@CurrentUser() u: U, @Param('id') id: string, @Body() dto: UpdateRuleDto) { return this.svc.update(id, dto, u.id); }
  @Delete(':id') async remove(@CurrentUser() u: U, @Param('id') id: string) { await this.svc.remove(id, u.id); return { ok: true }; }
  @Post('apply') apply(@CurrentUser() u: U) { return this.svc.applyAll(u.id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([TxRule, Transaction])],
  providers: [RulesService],
  controllers: [RulesController],
  exports: [RulesService, TypeOrmModule],
})
export class RulesModule {}
