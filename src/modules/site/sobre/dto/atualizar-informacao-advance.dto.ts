import { PartialType } from '@nestjs/mapped-types';
import { CriarInformacaoAdvanceDto } from './criar-informacao-advance.dto';

export class AtualizarInformacaoAdvanceDto extends PartialType(
  CriarInformacaoAdvanceDto,
) {}
