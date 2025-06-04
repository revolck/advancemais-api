import { Request } from 'express';
import { Role, Status, TipoUsuario } from '@prisma/client';

/**
 * 👤 Interface do usuário autenticado
 * Contém informações essenciais do usuário logado
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  matricula: string;
  nome?: string;
  tipoUsuario: TipoUsuario;
  role: Role;
  status: Status;

  // 🚫 Informações de banimento (se aplicável)
  tipoBanimento?: string | null;
  dataFimBanimento?: Date | null;
  banidoPor?: string | null;
}

/**
 * 🔒 Interface da requisição autenticada
 * Estende a requisição do Express com dados do usuário
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * 🎯 Interface para payload do JWT
 * Dados que serão incluídos no token
 */
export interface JwtUserPayload {
  sub: string;
  email: string;
  matricula: string;
  tipoUsuario: TipoUsuario;
  role: Role;
  status: Status;
}
