import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CATEGORIAS } from '../categoria.enum';

export class ConfirmItemDto {
  @IsISO8601() data: string;
  @IsString() @MinLength(1) @MaxLength(500) descricao: string;
  @IsNumber() valor: number;
  @IsOptional() @IsIn(CATEGORIAS as readonly string[]) categoria?: string;
  @IsOptional() @IsString() attachment?: string;
}

export class ConfirmTransactionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ConfirmItemDto)
  items: ConfirmItemDto[];
}
