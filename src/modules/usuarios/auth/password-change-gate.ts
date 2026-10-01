/**
 * Usuário com senha provisória (precisaTrocarSenha) só pode acessar as rotas
 * necessárias para trocar a senha. GET /perfil precisa continuar liberado:
 * o front trata qualquer 403 nele como "usuário bloqueado".
 */
const ALLOWED_ROUTES: readonly { method: string; path: string }[] = [
  { method: 'POST', path: '/api/v1/usuarios/logout' },
  { method: 'GET', path: '/api/v1/usuarios/perfil' },
  { method: 'PUT', path: '/api/v1/usuarios/perfil/alterar-senha' },
];

export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';

export function isAllowedDuringPasswordChange(method: string, originalUrl: string): boolean {
  const path = (originalUrl || '').split('?')[0].replace(/\/+$/, '');
  const normalizedMethod = (method || '').toUpperCase();
  return ALLOWED_ROUTES.some((route) => route.method === normalizedMethod && route.path === path);
}
