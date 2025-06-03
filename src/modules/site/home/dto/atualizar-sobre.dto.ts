import { PartialType } from '@nestjs/mapped-types';
import { CriarSobreDto } from './criar-sobre.dto';

export class AtualizarSobreDto extends PartialType(CriarSobreDto) {}
