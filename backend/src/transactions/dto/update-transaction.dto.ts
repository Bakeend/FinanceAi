import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CATEGORIAS } from '../categoria.enum';

export class UpdateTransactionDto {
  @IsOptional() @IsISO8601() data?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) descricao?: string;
  @IsOptional() @IsNumber() valor?: number;
  @IsOptional() @IsIn(CATEGORIAS as readonly string[]) categoria?: string;
  @IsOptional() @IsString() @MaxLength(50) subcategoria?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() accountId?: string | null;
  @IsOptional() @IsString() attachment?: string | null;
  @IsOptional() applyToInstallments?: boolean;
}
