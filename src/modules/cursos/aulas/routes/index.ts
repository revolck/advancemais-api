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

// Middleware de autenticação para todas as rotas
router.use(
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO, // Para progresso e presença
  ]),
);

// CRUD de aulas
router.get('/', AulasController.list);
router.get('/:id', AulasController.get);
router.post('/', AulasController.create);
router.put('/:id', AulasController.update);
router.delete('/:id', AulasController.delete);

// Histórico de alterações
router.get('/:id/historico', AulasController.getHistorico);

// Progresso do aluno
router.post('/:id/progresso', AulasController.updateProgresso);
router.get('/:id/progresso', AulasController.getProgresso);

// Presença em aula ao vivo
router.post('/:id/presenca', AulasController.registrarPresenca);
router.get('/:id/presenca', AulasController.getPresencas);

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
agendaRoutes.get('/', AgendaController.getEventos);
