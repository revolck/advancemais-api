import { PartialType } from '@nestjs/mapped-types';
import { CriarTituloPaginaDto } from './criar-titulo-pagina.dto';

export class AtualizarTituloPaginaDto extends PartialType(
  CriarTituloPaginaDto,
) {}
