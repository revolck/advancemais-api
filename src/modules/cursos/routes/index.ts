import { Router } from 'express';
import { Roles } from '@prisma/client';

import { publicCache } from '@/middlewares/cache-control';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';

import { CursosController } from '../controllers/cursos.controller';
import { TurmasController } from '../controllers/turmas.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/cursos/meta:
 *   get:
 *     summary: Informações do módulo de cursos
 *     tags: [Cursos]
 *     responses:
 *       200:
 *         description: Metadados e endpoints disponíveis para o módulo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Cursos Module API' }
 *                 version: { type: string, example: 'v1' }
 *                 timestamp: { type: string, format: date-time }
 *                 endpoints:
 *                   type: object
 *                   additionalProperties: { type: string }
 */
router.get('/meta', publicCache, CursosController.meta);

/**
 * @openapi
 * /api/v1/cursos:
 *   get:
 *     summary: Listar cursos com paginação
 *     tags: [Cursos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Busca por nome ou código do curso
 *       - in: query
 *         name: statusPadrao
 *         schema: { $ref: '#/components/schemas/CursosStatusPadrao' }
 *       - in: query
 *         name: instrutorId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: includeTurmas
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Lista paginada de cursos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Curso'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       500:
 *         description: Erro ao listar cursos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', publicCache, CursosController.list);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}:
 *   get:
 *     summary: Obter detalhes de um curso específico
 *     tags: [Cursos]
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Dados completos do curso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Curso'
 *       404:
 *         description: Curso não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:cursoId', publicCache, CursosController.get);

/**
 * @openapi
 * /api/v1/cursos:
 *   post:
 *     summary: Criar um novo curso
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoCreateInput'
 *     responses:
 *       201:
 *         description: Curso criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Curso'
 *       400:
 *         description: Dados inválidos para criação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Permissões insuficientes
 */
router.post(
  '/',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  CursosController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}:
 *   put:
 *     summary: Atualizar dados de um curso
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoUpdateInput'
 *     responses:
 *       200:
 *         description: Curso atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Curso'
 *       400:
 *         description: Dados inválidos para atualização
 *       404:
 *         description: Curso não encontrado
 */
router.put(
  '/:cursoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  CursosController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}:
 *   delete:
 *     summary: Despublicar um curso (status padrão)
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Curso despublicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Curso'
 *       404:
 *         description: Curso não encontrado
 */
router.delete(
  '/:cursoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CursosController.archive,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas:
 *   get:
 *     summary: Listar turmas de um curso
 *     tags: ['Cursos - Turmas']
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Lista de turmas do curso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf: [{ $ref: '#/components/schemas/CursoTurma' }]
 *       404:
 *         description: Curso não encontrado
 */
router.get('/:cursoId/turmas', publicCache, TurmasController.list);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}:
 *   get:
 *     summary: Obter detalhes de uma turma específica
 *     tags: ['Cursos - Turmas']
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos da turma
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurma'
 *       404:
 *         description: Turma ou curso não encontrado
 */
router.get('/:cursoId/turmas/:turmaId', publicCache, TurmasController.get);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas:
 *   post:
 *     summary: Criar uma nova turma para o curso
 *     tags: ['Cursos - Turmas']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoTurmaCreateInput'
 *     responses:
 *       201:
 *         description: Turma criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurma'
 *       400:
 *         description: Dados inválidos para criação
 *       404:
 *         description: Curso não encontrado
 */
router.post(
  '/:cursoId/turmas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  TurmasController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}:
 *   put:
 *     summary: Atualizar informações de uma turma
 *     tags: ['Cursos - Turmas']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoTurmaUpdateInput'
 *     responses:
 *       200:
 *         description: Turma atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurma'
 *       400:
 *         description: Dados inválidos para atualização
 *       404:
 *         description: Turma ou curso não encontrado
 */
router.put(
  '/:cursoId/turmas/:turmaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  TurmasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/enrollments:
 *   post:
 *     summary: Matricular um aluno em uma turma
 *     tags: ['Cursos - Turmas']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoTurmaEnrollmentInput'
 *     responses:
 *       201:
 *         description: Matrícula registrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurma'
 *       400:
 *         description: Dados inválidos para matrícula
 *       404:
 *         description: Curso, turma ou aluno não encontrado
 *       409:
 *         description: Conflitos de matrícula ou falta de vagas
 */
router.post(
  '/:cursoId/turmas/:turmaId/enrollments',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  TurmasController.enroll,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/enrollments/{alunoId}:
 *   delete:
 *     summary: Remover matrícula de um aluno na turma
 *     tags: ['Cursos - Turmas']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: alunoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Matrícula removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurma'
 *       404:
 *         description: Turma ou aluno não encontrado
 */
router.delete(
  '/:cursoId/turmas/:turmaId/enrollments/:alunoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  TurmasController.unenroll,
);

export { router as cursosRoutes };
