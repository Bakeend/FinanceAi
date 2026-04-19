import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Reminder } from './reminder.entity';
import { CATEGORIAS } from '../transactions/categoria.enum';

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

  list() {
    return this.repo.find({ order: { dia: 'ASC' } });
  }

  /** Lembretes ativos cujo `dia` está dentro de [hoje, hoje+7] */
  async upcoming() {
    const all = await this.repo.find({ where: { active: true } });
    const today = new Date();
    const d = today.getDate();
    const maxDay = d + 7;
    return all
      .filter((r) => r.dia >= d && r.dia <= maxDay)
      .map((r) => ({
        ...r,
        diasRestantes: r.dia - d,
      }));
  }

  create(dto: CreateReminderDto) {
    return this.repo.save(
      this.repo.create({
        ...dto,
        categoria: dto.categoria ?? 'Outros',
        active: dto.active ?? true,
      } as any),
    );
  }

  async update(id: string, dto: UpdateReminderDto) {
    await this.repo.update(id, dto as any);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: string) {
    await this.repo.delete(id);
  }

  async markPaid(id: string) {
    await this.repo.update(id, { lastPaid: new Date().toISOString() });
    return this.repo.findOne({ where: { id } });
  }
}

@Controller('reminders')
export class RemindersController {
  constructor(private readonly svc: RemindersService) {}
  @Get() list() { return this.svc.list(); }
  @Get('upcoming') upcoming() { return this.svc.upcoming(); }
  @Post() create(@Body() dto: CreateReminderDto) { return this.svc.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateReminderDto) { return this.svc.update(id, dto); }
  @Post(':id/paid') paid(@Param('id') id: string) { return this.svc.markPaid(id); }
  @Delete(':id') async remove(@Param('id') id: string) { await this.svc.remove(id); return { ok: true }; }
}

@Module({
  imports: [TypeOrmModule.forFeature([Reminder])],
  providers: [RemindersService],
  controllers: [RemindersController],
})
export class RemindersModule {}
