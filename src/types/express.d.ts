/**
 * Extensão dos tipos do Express para incluir dados do usuário
 */
declare namespace Express {
  interface Request {
    id: string;
    user?: {
      id: string;
      email: string;
      role: string;
      authId?: string;
      [key: string]: any;
    };
  }
}
