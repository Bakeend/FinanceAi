import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Reminder } from './reminder.entity';
import { CATEGORIAS } from '../transactions/categoria.enum';
import { CurrentUser } from '../auth/auth.module';

type U = { id: string; username: string };

class CreateReminderDto {
  @IsString() @MinLength(1) @MaxLength(200) descricao: string;
  @IsNumber() valor: number;
  @IsInt() @Min(1) @Max(31) dia: number;
  @IsOptional() @IsIn(CATEGORIAS as readonly string[]) categoria?: string;
  @IsOptional() @IsString() accountId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
class UpdateReminderDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) descricao?: string;
  @IsOptional() @IsNumber() valor?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) dia?: number;
  @IsOptional() @IsIn(CATEGORIAS as readonly string[]) categoria?: string;
  @IsOptional() @IsString() accountId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class RemindersService {
  constructor(@InjectRepository(Reminder) private readonly repo: Repository<Reminder>) {}

  list(userId: string) {
    return this.repo.find({ where: { userId }, order: { dia: 'ASC' } });
  }

  async upcoming(userId: string) {
    const all = await this.repo.find({ where: { active: true, userId } });
    const today = new Date();
    const d = today.getDate();
    const maxDay = d + 7;
    return all
      .filter((r) => r.dia >= d && r.dia <= maxDay)
      .map((r) => ({ ...r, diasRestantes: r.dia - d }));
  }

  create(dto: CreateReminderDto, userId: string) {
    return this.repo.save(
      this.repo.create({
        ...dto,
        categoria: dto.categoria ?? 'Outros',
        active: dto.active ?? true,
        userId,
      } as any),
    );
  }

  async update(id: string, dto: UpdateReminderDto, userId: string) {
    const existing = await this.repo.findOne({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Lembrete não encontrado');
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id, userId } });
  }

  async remove(id: string, userId: string) {
    const existing = await this.repo.findOne({ where: { id, userId } });
    if (!existing) return;
    await this.repo.delete(id);
  }

  async markPaid(id: string, userId: string) {
    const existing = await this.repo.findOne({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Lembrete não encontrado');
    await this.repo.update(id, { lastPaid: new Date().toISOString() });
    return this.repo.findOne({ where: { id, userId } });
  }
}

@Controller('reminders')
export class RemindersController {
  constructor(private readonly svc: RemindersService) {}
  @Get() list(@CurrentUser() u: U) { return this.svc.list(u.id); }
  @Get('upcoming') upcoming(@CurrentUser() u: U) { return this.svc.upcoming(u.id); }
  @Post() create(@CurrentUser() u: U, @Body() dto: CreateReminderDto) { return this.svc.create(dto, u.id); }
  @Patch(':id') update(@CurrentUser() u: U, @Param('id') id: string, @Body() dto: UpdateReminderDto) { return this.svc.update(id, dto, u.id); }
  @Post(':id/paid') paid(@CurrentUser() u: U, @Param('id') id: string) { return this.svc.markPaid(id, u.id); }
  @Delete(':id') async remove(@CurrentUser() u: U, @Param('id') id: string) { await this.svc.remove(id, u.id); return { ok: true }; }
}

@Module({
  imports: [TypeOrmModule.forFeature([Reminder])],
  providers: [RemindersService],
  controllers: [RemindersController],
})
export class RemindersModule {}
