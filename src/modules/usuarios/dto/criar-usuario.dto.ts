import {
  IsEmail,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoUsuario, Role } from '@prisma/client';

/**
 * 👤 DTO para criação de usuário
 * Contém validações específicas para cada tipo de usuário
 */
export class CriarUsuarioDto {
  // 📝 Dados básicos obrigatórios
  @IsString({ message: 'Nome deve ser uma string' })
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  @MaxLength(255, { message: 'Nome deve ter no máximo 255 caracteres' })
  @Transform(({ value }) => value?.trim())
  nome: string;

  @IsEmail({}, { message: 'Email deve ter formato válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString({ message: 'Senha é obrigatória' })
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/, {
    message:
      'Senha deve conter: maiúscula, minúscula, número e caractere especial',
  })
  senha: string;

  @IsEnum(TipoUsuario, { message: 'Tipo de usuário inválido' })
  tipoUsuario: TipoUsuario;

  @IsEnum(Role, { message: 'Role inválida' })
  @IsOptional()
  role?: Role = Role.STUDENT;

  // 📋 Aceite de termos
  @IsBoolean({ message: 'Aceite dos termos deve ser verdadeiro ou falso' })
  aceitarTermos: boolean;

  // 🆔 CPF (obrigatório para pessoa física)
  @ValidateIf((o) => o.tipoUsuario === TipoUsuario.PESSOA_FISICA)
  @IsString({ message: 'CPF é obrigatório para pessoa física' })
  @Matches(/^\d{11}$/, { message: 'CPF deve conter exatamente 11 dígitos' })
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  cpf?: string;

  // 🏢 CNPJ (obrigatório para pessoa jurídica)
  @ValidateIf((o) => o.tipoUsuario === TipoUsuario.PESSOA_JURIDICA)
  @IsString({ message: 'CNPJ é obrigatório para pessoa jurídica' })
  @Matches(/^\d{14}$/, { message: 'CNPJ deve conter exatamente 14 dígitos' })
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  cnpj?: string;

  // 📅 Dados opcionais
  @IsDateString({}, { message: 'Data de nascimento deve ser válida' })
  @IsOptional()
  dataNasc?: string;

  @IsString({ message: 'Telefone deve ser uma string' })
  @IsOptional()
  @MaxLength(20, { message: 'Telefone deve ter no máximo 20 caracteres' })
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  telefone?: string;

  @IsString({ message: 'Gênero deve ser uma string' })
  @IsOptional()
  @MaxLength(20, { message: 'Gênero deve ter no máximo 20 caracteres' })
  genero?: string;
}
