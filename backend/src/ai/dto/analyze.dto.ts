import { IsInt, Max, Min } from 'class-validator';
export class AnalyzeDto {
  @IsInt() @Min(1) @Max(12) mes: number;
  @IsInt() ano: number;
}
