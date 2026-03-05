import { Router } from 'express';
import { AulasController } from '../controllers/aulas.controller';
import { AgendaController } from '../controllers/agenda.controller';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@prisma/client';
import materiaisRoutes from './materiais.routes';

const router = Router();

/**
 * Rotas de gestão de aulas
 * Base: /api/v1/cursos/aulas
 *
 * Permissões:
 * - ADMIN, MODERADOR, PEDAGOGICO: acesso total
 * - INSTRUTOR: apenas aulas de turmas vinculadas
 * - ALUNO_CANDIDATO: apenas progresso e presença próprias
 */

const rolesGestaoAulas = [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR];
const rolesAlunoOuGestao = [...rolesGestaoAulas, Roles.ALUNO_CANDIDATO];

// CRUD de aulas
router.get('/', supabaseAuthMiddleware(rolesGestaoAulas), AulasController.list);
router.get('/:id', supabaseAuthMiddleware(rolesGestaoAulas), AulasController.get);
router.post('/', supabaseAuthMiddleware(rolesGestaoAulas), AulasController.create);
router.put('/:id', supabaseAuthMiddleware(rolesGestaoAulas), AulasController.update);
router.patch('/:id/publicar', supabaseAuthMiddleware(rolesGestaoAulas), AulasController.publicar); // Publicar/despublicar (antes de :id para evitar conflito)
router.delete(
  '/:id',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  AulasController.delete,
);

// Histórico de alterações
router.get(
  '/:id/historico',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  AulasController.getHistorico,
);

// Progresso do aluno
router.post(
  '/:id/progresso',
  supabaseAuthMiddleware(rolesAlunoOuGestao),
  AulasController.updateProgresso,
);
router.get(
  '/:id/progresso',
  supabaseAuthMiddleware(rolesAlunoOuGestao),
  AulasController.getProgresso,
);

// Presença em aula ao vivo
router.post(
  '/:id/presenca',
  supabaseAuthMiddleware(rolesAlunoOuGestao),
  AulasController.registrarPresenca,
);
router.get('/:id/presenca', supabaseAuthMiddleware(rolesGestaoAulas), AulasController.getPresencas);

// Materiais complementares
router.use('/', materiaisRoutes);

export default router;

/**
 * Rotas de agenda (exportar separadamente)
 */
export const agendaRoutes = Router();
agendaRoutes.use(
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
);
agendaRoutes.get(
  '/aniversariantes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  AgendaController.getAniversariantes,
);
agendaRoutes.get('/', AgendaController.getEventos);
