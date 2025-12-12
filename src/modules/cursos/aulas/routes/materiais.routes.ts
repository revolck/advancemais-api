import { Router } from 'express';
import { MateriaisController } from '../controllers/materiais.controller';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@prisma/client';

const router = Router();

/**
 * Rotas de materiais complementares
 * Base: /api/v1/cursos/aulas
 */

// CRUD de materiais (requer autenticação)
router.post(
  '/:aulaId/materiais',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  MateriaisController.create,
);

router.get(
  '/:aulaId/materiais',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  MateriaisController.list,
);

router.put(
  '/:aulaId/materiais/:materialId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  MateriaisController.update,
);

router.delete(
  '/:aulaId/materiais/:materialId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  MateriaisController.delete,
);

router.patch(
  '/:aulaId/materiais/reordenar',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  MateriaisController.reordenar,
);

// Token e download
router.post(
  '/:aulaId/materiais/:materialId/gerar-token',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  MateriaisController.gerarToken,
);

// Download protegido (rota sem :aulaId)
router.get(
  '/materiais/download/:token',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  MateriaisController.download,
);

export default router;
