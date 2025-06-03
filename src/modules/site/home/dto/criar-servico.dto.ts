import {
  IsString,
  IsUrl,
  IsNotEmpty,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { TipoServico } from '@prisma/client';

export class CriarServicoDto {
  @IsEnum(TipoServico, { message: 'Tipo de serviço inválido' })
  tipo: TipoServico;

  @IsUrl({}, { message: 'URL da imagem deve ser válida' })
  @IsNotEmpty({ message: 'URL da imagem é obrigatória' })
  imagemUrl: string;

  @IsString({ message: 'Título deve ser uma string' })
  @IsNotEmpty({ message: 'Título é obrigatório' })
  @MaxLength(255, { message: 'Título deve ter no máximo 255 caracteres' })
  titulo: string;

  @IsString({ message: 'Descrição deve ser uma string' })
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  descricao: string;

  @IsString({ message: 'Título do botão deve ser uma string' })
  @IsNotEmpty({ message: 'Título do botão é obrigatório' })
  @MaxLength(100, {
    message: 'Título do botão deve ter no máximo 100 caracteres',
  })
  titleButton: string;

  @IsUrl({}, { message: 'URL do botão deve ser válida' })
  @IsNotEmpty({ message: 'URL do botão é obrigatória' })
  urlButton: string;
}
