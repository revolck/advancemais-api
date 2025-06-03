import {
  IsEmail,
  IsString,
  IsEnum,
  MinLength,
  IsOptional,
  IsPhoneNumber,
  ValidateIf,
  Matches,
} from 'class-validator';
import { TipoUsuario } from '../../../generated/prisma';

export class CriarUsuarioDto {
  @IsEmail({}, { message: 'Email deve ter formato válido' })
  email: string;

  @IsString({ message: 'Senha é obrigatória' })
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/, {
    message:
      'Senha deve conter ao menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial',
  })
  senha: string;

  @IsEnum(TipoUsuario, { message: 'Tipo de usuário inválido' })
  tipoUsuario: TipoUsuario;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsPhoneNumber('BR', {
    message: 'Telefone deve ser um número brasileiro válido',
  })
  telefone?: string;

  // Campos condicionais baseados no tipo de usuário
  @ValidateIf((o) => o.tipoUsuario === TipoUsuario.PESSOA_FISICA)
  @IsString({ message: 'CPF é obrigatório para pessoa física' })
  @Matches(/^\d{11}$/, { message: 'CPF deve conter exatamente 11 dígitos' })
  cpf?: string;

  @ValidateIf((o) => o.tipoUsuario === TipoUsuario.PESSOA_JURIDICA)
  @IsString({ message: 'CNPJ é obrigatório para pessoa jurídica' })
  @Matches(/^\d{14}$/, { message: 'CNPJ deve conter exatamente 14 dígitos' })
  cnpj?: string;

  @ValidateIf((o) => o.tipoUsuario === TipoUsuario.PESSOA_JURIDICA)
  @IsString({ message: 'Razão social é obrigatória para pessoa jurídica' })
  razaoSocial?: string;

  // Campos de endereço opcionais
  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'Estado deve ter 2 letras maiúsculas' })
  estado?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'CEP deve conter exatamente 8 dígitos' })
  cep?: string;
}
