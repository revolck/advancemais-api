import { Router } from 'express';
import { GoogleOAuthController } from '@/modules/cursos/aulas/controllers/google-oauth.controller';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@prisma/client';

const router = Router();

/**
 * Rotas de autenticação Google
 * Base: /api/v1/auth/google
 *
 * Usado para integração com Google Calendar e Google Meet
 */

// GET /auth/google/connect - Gerar URL de autorização
router.get(
  '/connect',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.RECRUTADOR,
  ]),
  GoogleOAuthController.connect,
);

// GET /auth/google/callback - Callback do OAuth (público)
router.get('/callback', GoogleOAuthController.callback);

// POST /auth/google/disconnect - Desconectar Google
router.post(
  '/disconnect',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.RECRUTADOR,
  ]),
  GoogleOAuthController.disconnect,
);

// GET /auth/google/status - Verificar status da conexão
router.get(
  '/status',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.RECRUTADOR,
  ]),
  GoogleOAuthController.status,
);

export default router;
