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
// ✅ Permitir todas as roles - todos podem conectar Google Calendar
router.get(
  '/connect',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.FINANCEIRO,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.EMPRESA,
    Roles.SETOR_DE_VAGAS,
    Roles.RECRUTADOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  GoogleOAuthController.connect,
);

// GET /auth/google/callback - Callback do OAuth (público)
router.get('/callback', GoogleOAuthController.callback);

// POST /auth/google/disconnect - Desconectar Google
// ✅ Permitir todas as roles
router.post(
  '/disconnect',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.FINANCEIRO,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.EMPRESA,
    Roles.SETOR_DE_VAGAS,
    Roles.RECRUTADOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  GoogleOAuthController.disconnect,
);

// GET /auth/google/status - Verificar status da conexão
// ✅ Permitir todas as roles
router.get(
  '/status',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.FINANCEIRO,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.EMPRESA,
    Roles.SETOR_DE_VAGAS,
    Roles.RECRUTADOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  GoogleOAuthController.status,
);

export default router;
