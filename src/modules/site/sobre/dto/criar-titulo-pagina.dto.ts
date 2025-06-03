import { IsString, IsUrl, IsNotEmpty, MaxLength } from 'class-validator';

export class CriarTituloPaginaDto {
  @IsString({ message: 'Título deve ser uma string' })
  @IsNotEmpty({ message: 'Título é obrigatório' })
  @MaxLength(255, { message: 'Título deve ter no máximo 255 caracteres' })
  titulo: string;

  @IsString({ message: 'Subtítulo deve ser uma string' })
  @IsNotEmpty({ message: 'Subtítulo é obrigatório' })
  @MaxLength(255, { message: 'Subtítulo deve ter no máximo 255 caracteres' })
  subtitulo: string;

  @IsString({ message: 'Descrição deve ser uma string' })
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  @MaxLength(250, { message: 'Descrição deve ter no máximo 250 caracteres' })
  descricao: string;

  @IsString({ message: 'Texto do botão deve ser uma string' })
  @IsNotEmpty({ message: 'Texto do botão é obrigatório' })
  @MaxLength(100, {
    message: 'Texto do botão deve ter no máximo 100 caracteres',
  })
  textoBotao: string;

  @IsUrl({}, { message: 'URL do botão deve ser válida' })
  @IsNotEmpty({ message: 'URL do botão é obrigatória' })
  urlBotao: string;
}
