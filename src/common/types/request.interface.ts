import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  matricula: string;
  tipoUsuario: string;
  status: string;
  nome?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
