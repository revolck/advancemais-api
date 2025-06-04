import { Transform } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { TipoAcao } from '@prisma/client';

export class FiltroAuditoriaDto {
  @IsUUID()
  @IsOptional()
  usuarioId?: string;

  @IsEnum(TipoAcao)
  @IsOptional()
  acao?: TipoAcao;

  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  @IsOptional()
  dataInicio?: Date;

  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  @IsOptional()
  dataFim?: Date;

  @Transform(({ value }) => parseInt(value) || 1)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @Transform(({ value }) => Math.min(Math.max(parseInt(value) || 50, 1), 500))
  @IsInt()
  @IsOptional()
  limite?: number = 50;
}
