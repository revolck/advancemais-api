// authMiddleware deprecated - usar jwtAuthMiddleware de ./auth
// Re-exportando como legacyAuthMiddleware para evitar conflito
export { authMiddleware as legacyAuthMiddleware, authMiddlewareWithDB } from './auth-middleware';
