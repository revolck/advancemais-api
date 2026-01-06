// Exportar storage genérico
export { storage, uploadImage } from '@/config/storage';

// Exportar middlewares JWT genéricos (substituem Supabase)
import { jwtAuthMiddleware as jwtAuth, optionalJWTAuth as optionalJWT } from './jwt-middleware';
export { jwtAuthMiddleware, optionalJWTAuth } from './jwt-middleware';

// Alias para facilitar migração (compatibilidade durante transição)
export const authMiddleware = jwtAuth;
export const optionalAuth = optionalJWT;

// Alias temporário para compatibilidade (será removido após migração completa)
// TODO: Remover após migração completa
export const supabaseAuthMiddleware = jwtAuth;
export const optionalSupabaseAuth = optionalJWT;
