import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 📋 DTO para criação/atualização de perfil
 * Dados complementares do usuário
 */
export class CriarPerfilDto {
  // 🏢 Dados empresariais (opcionais)
  @IsString({ message: 'Razão social deve ser uma string' })
  @IsOptional()
  @MaxLength(255, { message: 'Razão social deve ter no máximo 255 caracteres' })
  @Transform(({ value }) => value?.trim())
  razaoSocial?: string;

  @IsString({ message: 'Nome fantasia deve ser uma string' })
  @IsOptional()
  @MaxLength(255, {
    message: 'Nome fantasia deve ter no máximo 255 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  nomeFantasia?: string;

  // 📍 Endereço completo (todos opcionais)
  @IsString({ message: 'CEP deve ser uma string' })
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'CEP deve conter exatamente 8 dígitos' })
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  cep?: string;

  @IsString({ message: 'Logradouro deve ser uma string' })
  @IsOptional()
  @MaxLength(255, { message: 'Logradouro deve ter no máximo 255 caracteres' })
  @Transform(({ value }) => value?.trim())
  logradouro?: string;

  @IsString({ message: 'Número deve ser uma string' })
  @IsOptional()
  @MaxLength(20, { message: 'Número deve ter no máximo 20 caracteres' })
  @Transform(({ value }) => value?.trim())
  numero?: string;

  @IsString({ message: 'Complemento deve ser uma string' })
  @IsOptional()
  @MaxLength(100, { message: 'Complemento deve ter no máximo 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  complemento?: string;

  @IsString({ message: 'Bairro deve ser uma string' })
  @IsOptional()
  @MaxLength(100, { message: 'Bairro deve ter no máximo 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  bairro?: string;

  @IsString({ message: 'Cidade deve ser uma string' })
  @IsOptional()
  @MaxLength(100, { message: 'Cidade deve ter no máximo 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  cidade?: string;

  @IsString({ message: 'Estado deve ser uma string' })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'Estado deve ter formato UF (ex: SP, RJ)' })
  @Transform(({ value }) => value?.toUpperCase().trim())
  estado?: string;

  @IsString({ message: 'País deve ser uma string' })
  @IsOptional()
  @MaxLength(100, { message: 'País deve ter no máximo 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  pais?: string;

  @IsString({ message: 'Referência deve ser uma string' })
  @IsOptional()
  @MaxLength(255, { message: 'Referência deve ter no máximo 255 caracteres' })
  @Transform(({ value }) => value?.trim())
  referencia?: string;
}

/**
 * ✏️ DTO para atualização de perfil
 */
export class AtualizarPerfilDto extends CriarPerfilDto {}

/**
 * 📊 DTO de resposta do perfil completo
 */
export class PerfilCompletoDto {
  id: string;
  usuarioId: string;

  // Dados empresariais
  razaoSocial?: string;
  nomeFantasia?: string;

  // Endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  referencia?: string;

  // Timestamps
  criadoEm: Date;
  atualizadoEm: Date;
}
