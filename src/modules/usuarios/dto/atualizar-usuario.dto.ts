import { PartialType, OmitType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role, Status } from '@prisma/client';
import { CriarUsuarioDto } from './criar-usuario.dto';

/**
 * ✏️ DTO para atualização de usuário
 * Remove campos que não devem ser alterados após criação
 */
export class AtualizarUsuarioDto extends PartialType(
  OmitType(CriarUsuarioDto, [
    'email',
    'tipoUsuario',
    'cpf',
    'cnpj',
    'aceitarTermos',
  ] as const),
) {
  // 🔐 Alteração de senha (opcional)
  @IsString({ message: 'Nova senha deve ser uma string' })
  @MinLength(8, { message: 'Nova senha deve ter pelo menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/, {
    message:
      'Nova senha deve conter: maiúscula, minúscula, número e caractere especial',
  })
  @IsOptional()
  novaSenha?: string;

  // 🔐 Senha atual para confirmação
  @IsString({ message: 'Senha atual é obrigatória para alteração' })
  @IsOptional()
  senhaAtual?: string;
}

/**
 * 👮 DTO para atualização administrativa
 * Permite alterar campos sensíveis (apenas admins)
 */
export class AtualizarUsuarioAdminDto extends PartialType(
  OmitType(CriarUsuarioDto, ['senha', 'aceitarTermos'] as const),
) {
  @IsEnum(Role, { message: 'Role inválida' })
  @IsOptional()
  role?: Role;

  @IsEnum(Status, { message: 'Status inválido' })
  @IsOptional()
  status?: Status;

  // 🆔 Permite alterar matrícula (apenas admin)
  @IsString({ message: 'Matrícula deve ser uma string' })
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase().trim())
  matricula?: string;
}

/**
 * 🔍 DTO para filtros de busca
 */
export class FiltroUsuariosDto {
  @IsString({ message: 'Nome deve ser uma string' })
  @IsOptional()
  nome?: string;

  @IsString({ message: 'Email deve ser uma string' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'Matrícula deve ser uma string' })
  @IsOptional()
  matricula?: string;

  @IsEnum(Role, { message: 'Role inválida' })
  @IsOptional()
  role?: Role;

  @IsEnum(Status, { message: 'Status inválido' })
  @IsOptional()
  status?: Status;

  @IsString({ message: 'Página deve ser uma string' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  pagina?: number;

  @IsString({ message: 'Limite deve ser uma string' })
  @IsOptional()
  @Transform(({ value }) => Math.min(parseInt(value) || 10, 100))
  limite?: number;
}
