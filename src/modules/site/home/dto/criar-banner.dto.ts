import { IsUrl, IsNotEmpty, IsInt, Min } from 'class-validator';

export class CriarBannerDto {
  @IsUrl({}, { message: 'URL da imagem deve ser válida' })
  @IsNotEmpty({ message: 'URL da imagem é obrigatória' })
  imagemUrl: string;

  @IsUrl({}, { message: 'URL do link deve ser válida' })
  @IsNotEmpty({ message: 'URL do link é obrigatória' })
  linkUrl: string;

  @IsInt({ message: 'Posição deve ser um número inteiro' })
  @Min(1, { message: 'Posição deve ser no mínimo 1' })
  position: number;
}
