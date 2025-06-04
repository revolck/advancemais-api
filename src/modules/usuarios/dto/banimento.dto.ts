import {
  IsString,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoBanimento } from '@prisma/client';

/**
 * 🚫 DTO para aplicar banimento
 */
export class AplicarBanimentoDto {
  @IsEnum(TipoBanimento, { message: 'Tipo de banimento inválido' })
  tipoBanimento: TipoBanimento;

  @IsString({ message: 'Motivo do banimento é obrigatório' })
  @IsNotEmpty({ message: 'Motivo do banimento não pode estar vazio' })
  @MaxLength(500, { message: 'Motivo deve ter no máximo 500 caracteres' })
  @Transform(({ value }) => value?.trim())
  motivoBanimento: string;

  // 📅 Data de fim (obrigatória para banimentos temporários)
  @IsDateString({}, { message: 'Data de fim deve ser válida' })
  @IsOptional()
  dataFimBanimento?: string;
}

/**
 * 🔓 DTO para remover banimento
 */
export class RemoverBanimentoDto {
  @IsString({ message: 'Motivo da remoção é obrigatório' })
  @IsNotEmpty({ message: 'Motivo da remoção não pode estar vazio' })
  @MaxLength(500, { message: 'Motivo deve ter no máximo 500 caracteres' })
  @Transform(({ value }) => value?.trim())
  motivoRemocao: string;
}

/**
 * 📊 DTO de resposta do banimento
 */
export class BanimentoResponseDto {
  id: string;
  email: string;
  nome?: string;
  matricula: string;
  tipoBanimento?: TipoBanimento;
  dataInicioBanimento?: Date;
  dataFimBanimento?: Date;
  motivoBanimento?: string;
  banidoPor?: string;

  // Informações do admin que aplicou
  adminBanimento?: {
    id: string;
    nome?: string;
    email: string;
  };
}

/**
 * 🔍 DTO para listar banimentos
 */
export class FiltrarBanimentosDto {
  @IsEnum(TipoBanimento, { message: 'Tipo de banimento inválido' })
  @IsOptional()
  tipoBanimento?: TipoBanimento;

  @IsString({ message: 'Admin deve ser uma string' })
  @IsOptional()
  banidoPor?: string;

  @IsString({ message: 'Status deve ser uma string' })
  @IsOptional()
  status?: 'ativo' | 'expirado' | 'todos';

  @IsString({ message: 'Página deve ser uma string' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  pagina?: number;

  @IsString({ message: 'Limite deve ser uma string' })
  @IsOptional()
  @Transform(({ value }) => Math.min(parseInt(value) || 10, 100))
  limite?: number;
}
