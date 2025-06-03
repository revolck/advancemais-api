import { Status, TipoUsuario } from '../../../generated/prisma';

export class UsuarioResponseDto {
  id: string;
  email: string;
  matricula: string;
  tipoUsuario: TipoUsuario;
  status: Status;
  nome?: string;
  telefone?: string;
  criadoEm: Date;
  atualizadoEm: Date;
  ultimoLogin?: Date;

  // Dados do perfil (quando necessário)
  perfil?: {
    cpf?: string;
    cnpj?: string;
    razaoSocial?: string;
    endereco?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
}
