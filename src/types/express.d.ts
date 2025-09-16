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
      supabaseId?: string;
      [key: string]: any;
    };
  }
}
