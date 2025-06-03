import { IsString, IsUrl, IsNotEmpty, MaxLength } from 'class-validator';

export class CriarInformacaoAdvanceDto {
  @IsUrl({}, { message: 'URL do vídeo deve ser válida' })
  @IsNotEmpty({ message: 'URL do vídeo é obrigatória' })
  urlVideo: string;

  @IsString({ message: 'História deve ser uma string' })
  @IsNotEmpty({ message: 'História é obrigatória' })
  @MaxLength(500, { message: 'História deve ter no máximo 500 caracteres' })
  historia: string;

  @IsString({ message: 'Missão deve ser uma string' })
  @IsNotEmpty({ message: 'Missão é obrigatória' })
  @MaxLength(500, { message: 'Missão deve ter no máximo 500 caracteres' })
  missao: string;

  @IsString({ message: 'Visão deve ser uma string' })
  @IsNotEmpty({ message: 'Visão é obrigatória' })
  @MaxLength(500, { message: 'Visão deve ter no máximo 500 caracteres' })
  visao: string;
}
