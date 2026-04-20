import { IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, Matches } from 'class-validator';
import { CATEGORIAS } from '../categoria.enum';

export class CreateTransactionDto {
  @IsISO8601() data: string;
  @IsString() @MinLength(1) @MaxLength(500) descricao: string;
  @IsNumber() valor: number;
  @IsOptional() @IsIn(CATEGORIAS as readonly string[]) categoria?: string;
  @IsOptional() @IsString() accountId?: string | null;
  @IsOptional() @IsInt() @Min(2) @Max(60) installments?: number;
  @IsOptional() @IsString() attachment?: string | null;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsBoolean() isRecurring?: boolean;
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @IsIn(['BRL', 'USD', 'EUR', 'GBP', 'ARS'])
  currency?: string;
  @IsOptional()
  @IsNumber()
  originalAmount?: number;
}
