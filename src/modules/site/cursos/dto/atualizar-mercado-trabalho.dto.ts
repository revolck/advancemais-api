import { PartialType } from '@nestjs/mapped-types';
import { CriarMercadoTrabalhoDto } from './criar-mercado-trabalho.dto';

export class AtualizarMercadoTrabalhoDto extends PartialType(
  CriarMercadoTrabalhoDto,
) {}
