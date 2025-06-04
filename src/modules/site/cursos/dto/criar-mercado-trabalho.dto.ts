import {
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
  IsArray,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CriarDestaqueMercadoDto {
  @IsString({ message: 'Número do destaque deve ser uma string' })
  @IsNotEmpty({ message: 'Número do destaque é obrigatório' })
  @MaxLength(50, {
    message: 'Número do destaque deve ter no máximo 50 caracteres',
  })
  numeroDestaque: string;

  @IsString({ message: 'Descrição do destaque deve ser uma string' })
  @IsNotEmpty({ message: 'Descrição do destaque é obrigatória' })
  descricaoDestaque: string;

  @IsInt({ message: 'Ordem deve ser um número inteiro' })
  @Min(0, { message: 'Ordem deve ser no mínimo 0' })
  @IsOptional()
  ordem?: number;
}

export class CriarMercadoTrabalhoDto {
  @IsString({ message: 'Título deve ser uma string' })
  @IsNotEmpty({ message: 'Título é obrigatório' })
  @MaxLength(255, { message: 'Título deve ter no máximo 255 caracteres' })
  titulo: string;

  @IsString({ message: 'Subtítulo deve ser uma string' })
  @IsNotEmpty({ message: 'Subtítulo é obrigatório' })
  @MaxLength(255, { message: 'Subtítulo deve ter no máximo 255 caracteres' })
  subtitulo: string;

  @IsArray({ message: 'Destaques deve ser um array' })
  @ValidateNested({ each: true })
  @Type(() => CriarDestaqueMercadoDto)
  @IsOptional()
  destaques?: CriarDestaqueMercadoDto[];
}
