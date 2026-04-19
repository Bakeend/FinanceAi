import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HistoryItemDto {
  @IsString() role: 'user' | 'assistant';
  @IsString() @MaxLength(4000) content: string;
}
export class ChatDto {
  @IsString() @MaxLength(2000) mensagem: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => HistoryItemDto) historico: HistoryItemDto[];
  @IsOptional() @IsInt() @Min(1) @Max(12) mes?: number;
  @IsOptional() @IsInt() ano?: number;
}
