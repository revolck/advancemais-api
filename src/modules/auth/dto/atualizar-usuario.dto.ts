import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CriarUsuarioDto } from './criar-usuario.dto';

export class AtualizarUsuarioDto extends PartialType(
  OmitType(CriarUsuarioDto, ['senha', 'email', 'tipoUsuario'] as const),
) {}
