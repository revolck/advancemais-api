import { PartialType } from '@nestjs/mapped-types';
import { CriarTituloPaginaCursosDto } from './criar-titulo-pagina-cursos.dto';

export class AtualizarTituloPaginaCursosDto extends PartialType(
  CriarTituloPaginaCursosDto,
) {}
