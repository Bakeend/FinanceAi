import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { CATEGORIAS } from '../transactions/categoria.enum';
import { GoalsService } from './goals.service';

export class CreateGoalDto {
  @IsIn(CATEGORIAS as readonly string[]) categoria: string;
  @IsNumber() @Min(0) valor: number;
  @IsInt() @Min(1) @Max(12) mes: number;
  @IsInt() ano: number;
  @IsOptional() @IsIn(['limite', 'poupanca']) tipo?: 'limite' | 'poupanca';
}

export class UpdateGoalDto {
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsIn(CATEGORIAS as readonly string[]) categoria?: string;
  @IsOptional() @IsIn(['limite', 'poupanca']) tipo?: 'limite' | 'poupanca';
}

@Controller('goals')
export class GoalsController {
  constructor(private readonly svc: GoalsService) {}

  @Get()
  list(@Query('mes') mes: string, @Query('ano') ano: string) {
    return this.svc.list(Number(mes), Number(ano));
  }

  @Post()
  create(@Body() dto: CreateGoalDto) {
    return this.svc.create({ ...dto, tipo: dto.tipo ?? 'limite' });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
