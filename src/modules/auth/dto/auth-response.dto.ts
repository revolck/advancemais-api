import { Role, Status, TipoUsuario } from '@prisma/client';

/**
 * 🔐 DTO de resposta da autenticação
 * Contém tokens e dados do usuário autenticado
 */
export class AuthResponseDto {
  /**
   * 🎫 Token de acesso JWT
   */
  accessToken: string;

  /**
   * 🔄 Token de renovação
   */
  refreshToken: string;

  /**
   * 👤 Dados do usuário autenticado
   */
  usuario: {
    id: string;
    email: string;
    matricula: string;
    nome?: string;
    tipoUsuario: TipoUsuario;
    role: Role;
    status: Status;
  };
}
