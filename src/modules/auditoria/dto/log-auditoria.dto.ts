import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';
import { TipoAcao } from '../../../generated/prisma';

export class CriarLogAuditoriaDto {
  @IsOptional()
  @IsUUID(4, { message: 'ID do usuário deve ser um UUID válido' })
  usuarioId?: string;

  @IsEnum(TipoAcao, { message: 'Tipo de ação inválido' })
  acao: TipoAcao;

  @IsString({ message: 'Descrição é obrigatória' })
  descricao: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
