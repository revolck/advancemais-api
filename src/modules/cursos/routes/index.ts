import { Router } from 'express';
import { Roles } from '@prisma/client';

import { publicCache } from '@/middlewares/cache-control';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';

import { CursosController } from '../controllers/cursos.controller';
import { AulasController } from '../controllers/aulas.controller';
import { TurmasController } from '../controllers/turmas.controller';
import { ModulosController } from '../controllers/modulos.controller';
import { ProvasController } from '../controllers/provas.controller';
import { AvaliacaoController } from '../controllers/avaliacao.controller';
import { NotasController } from '../controllers/notas.controller';
import { FrequenciaController } from '../controllers/frequencia.controller';

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
 * /api/v1/cursos/publico/cursos:
 *   get:
 *     summary: Listar cursos publicados para vitrine pública
 *     tags: [Cursos - Público]
 *     responses:
 *       200:
 *         description: Lista de cursos disponíveis publicamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoPublico'
 *       500:
 *         description: Erro ao listar cursos públicos
 */
router.get('/publico/cursos', publicCache, CursosController.publicList);

/**
 * @openapi
 * /api/v1/cursos/publico/cursos/{cursoId}:
 *   get:
 *     summary: Detalhar curso publicado
 *     tags: [Cursos - Público]
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Detalhes do curso com turmas e módulos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoPublicoDetalhado'
 *       404:
 *         description: Curso não encontrado ou indisponível
 */
router.get('/publico/cursos/:cursoId', publicCache, CursosController.publicGet);

/**
 * @openapi
 * /api/v1/cursos/publico/turmas/{turmaId}:
 *   get:
 *     summary: Detalhar turma publicada
 *     tags: [Cursos - Público]
 *     parameters:
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detalhes da turma com módulos, aulas e provas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TurmaPublicaDetalhada'
 *       404:
 *         description: Turma não encontrada ou indisponível
 */
router.get('/publico/turmas/:turmaId', publicCache, TurmasController.publicGet);

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

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas:
 *   get:
 *     summary: Listar aulas de uma turma
 *     tags: ['Cursos - Aulas']
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
 *         description: Lista de aulas cadastradas para a turma
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoTurmaAula'
 *       404:
 *         description: Turma não encontrada para o curso informado
 */
router.get('/:cursoId/turmas/:turmaId/aulas', publicCache, AulasController.list);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas/{aulaId}:
 *   get:
 *     summary: Obter detalhes de uma aula específica
 *     tags: ['Cursos - Aulas']
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
 *         name: aulaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos da aula
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurmaAula'
 *       404:
 *         description: Aula ou turma não encontrada
 */
router.get('/:cursoId/turmas/:turmaId/aulas/:aulaId', publicCache, AulasController.get);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas:
 *   post:
 *     summary: Criar uma nova aula para a turma
 *     tags: ['Cursos - Aulas']
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
 *             $ref: '#/components/schemas/CursoTurmaAulaCreateInput'
 *     responses:
 *       201:
 *         description: Aula criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurmaAula'
 *       400:
 *         description: Dados inválidos ou configuração incompatível com o método da turma
 *       404:
 *         description: Turma não encontrada para o curso informado
 */
router.post(
  '/:cursoId/turmas/:turmaId/aulas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  AulasController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas/{aulaId}:
 *   put:
 *     summary: Atualizar informações de uma aula
 *     tags: ['Cursos - Aulas']
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
 *         name: aulaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoTurmaAulaUpdateInput'
 *     responses:
 *       200:
 *         description: Aula atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurmaAula'
 *       400:
 *         description: Dados inválidos ou configuração incompatível com o método da turma
 *       404:
 *         description: Aula ou turma não encontrada
 */
router.put(
  '/:cursoId/turmas/:turmaId/aulas/:aulaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  AulasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas/{aulaId}:
 *   delete:
 *     summary: Remover uma aula da turma
 *     tags: ['Cursos - Aulas']
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
 *         name: aulaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Aula removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *       404:
 *         description: Aula ou turma não encontrada
 */
router.delete(
  '/:cursoId/turmas/:turmaId/aulas/:aulaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  AulasController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos:
 *   get:
 *     summary: Listar módulos da turma
 *     tags: ['Cursos - Módulos']
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
 *     responses:
 *       200:
 *         description: Lista de módulos da turma
 *       404:
 *         description: Turma não encontrada
 */
router.get(
  '/:cursoId/turmas/:turmaId/modulos',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ModulosController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos/{moduloId}:
 *   get:
 *     summary: Detalhar módulo da turma
 *     tags: ['Cursos - Módulos']
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
 *         name: moduloId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados do módulo
 *       404:
 *         description: Módulo não encontrado
 */
router.get(
  '/:cursoId/turmas/:turmaId/modulos/:moduloId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ModulosController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos:
 *   post:
 *     summary: Criar módulo na turma
 *     tags: ['Cursos - Módulos']
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
 *             $ref: '#/components/schemas/CursoTurmaModuloCreateInput'
 *     responses:
 *       201:
 *         description: Módulo criado
 */
router.post(
  '/:cursoId/turmas/:turmaId/modulos',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ModulosController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos/{moduloId}:
 *   put:
 *     summary: Atualizar módulo da turma
 *     tags: ['Cursos - Módulos']
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
 *         name: moduloId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoTurmaModuloUpdateInput'
 *     responses:
 *       200:
 *         description: Módulo atualizado
 */
router.put(
  '/:cursoId/turmas/:turmaId/modulos/:moduloId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ModulosController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos/{moduloId}:
 *   delete:
 *     summary: Remover módulo da turma
 *     tags: ['Cursos - Módulos']
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
 *         name: moduloId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Módulo removido
 */
router.delete(
  '/:cursoId/turmas/:turmaId/modulos/:moduloId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ModulosController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas:
 *   get:
 *     summary: Listar provas da turma
 *     tags: ['Cursos - Provas']
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
 *     responses:
 *       200:
 *         description: Lista de provas atreladas à turma
 */
router.get(
  '/:cursoId/turmas/:turmaId/provas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ProvasController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}:
 *   get:
 *     summary: Detalhar prova da turma
 *     tags: ['Cursos - Provas']
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
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados da prova
 */
router.get(
  '/:cursoId/turmas/:turmaId/provas/:provaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ProvasController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas:
 *   post:
 *     summary: Criar prova para a turma
 *     tags: ['Cursos - Provas']
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
 *             $ref: '#/components/schemas/CursoTurmaProvaCreateInput'
 *     responses:
 *       201:
 *         description: Prova criada
 */
router.post(
  '/:cursoId/turmas/:turmaId/provas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ProvasController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}:
 *   put:
 *     summary: Atualizar prova da turma
 *     tags: ['Cursos - Provas']
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
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoTurmaProvaUpdateInput'
 *     responses:
 *       200:
 *         description: Prova atualizada
 */
router.put(
  '/:cursoId/turmas/:turmaId/provas/:provaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ProvasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}:
 *   delete:
 *     summary: Remover prova da turma
 *     tags: ['Cursos - Provas']
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
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Prova removida
 */
router.delete(
  '/:cursoId/turmas/:turmaId/provas/:provaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ProvasController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias:
 *   get:
 *     summary: Listar registros de frequência da turma
 *     tags: ['Cursos - Frequências']
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
 *       - in: query
 *         name: matriculaId
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: Filtra registros de frequência de uma matrícula específica
 *       - in: query
 *         name: aulaId
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: Filtra registros vinculados a uma aula específica
 *       - in: query
 *         name: status
 *         required: false
 *         schema: { $ref: '#/components/schemas/CursosFrequenciaStatus' }
 *       - in: query
 *         name: dataInicio
 *         required: false
 *         schema: { type: string, format: date-time }
 *         description: Data inicial do período (inclusive)
 *       - in: query
 *         name: dataFim
 *         required: false
 *         schema: { type: string, format: date-time }
 *         description: Data final do período (inclusive)
 *     responses:
 *       200:
 *         description: Lista de registros de frequência
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoFrequencia'
 */
router.get(
  '/:cursoId/turmas/:turmaId/frequencias',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  FrequenciaController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias:
 *   post:
 *     summary: Registrar frequência para a turma
 *     tags: ['Cursos - Frequências']
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
 *             $ref: '#/components/schemas/CursoFrequenciaCreateInput'
 *     responses:
 *       201:
 *         description: Frequência registrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoFrequencia'
 */
router.post(
  '/:cursoId/turmas/:turmaId/frequencias',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  FrequenciaController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias/{frequenciaId}:
 *   get:
 *     summary: Detalhar registro de frequência
 *     tags: ['Cursos - Frequências']
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
 *         name: frequenciaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos do registro de frequência
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoFrequencia'
 */
router.get(
  '/:cursoId/turmas/:turmaId/frequencias/:frequenciaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  FrequenciaController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias/{frequenciaId}:
 *   put:
 *     summary: Atualizar registro de frequência
 *     tags: ['Cursos - Frequências']
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
 *         name: frequenciaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoFrequenciaUpdateInput'
 *     responses:
 *       200:
 *         description: Frequência atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoFrequencia'
 */
router.put(
  '/:cursoId/turmas/:turmaId/frequencias/:frequenciaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  FrequenciaController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias/{frequenciaId}:
 *   delete:
 *     summary: Remover registro de frequência
 *     tags: ['Cursos - Frequências']
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
 *         name: frequenciaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Frequência removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 */
router.delete(
  '/:cursoId/turmas/:turmaId/frequencias/:frequenciaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  FrequenciaController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas:
 *   get:
 *     summary: Listar notas lançadas da turma
 *     tags: ['Cursos - Notas']
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
 *       - in: query
 *         name: matriculaId
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: Filtra notas lançadas para uma matrícula específica
 *     responses:
 *       200:
 *         description: Lista de notas lançadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoNota'
 */
router.get(
  '/:cursoId/turmas/:turmaId/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  NotasController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas:
 *   post:
 *     summary: Registrar nota manualmente para a turma
 *     tags: ['Cursos - Notas']
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
 *             $ref: '#/components/schemas/CursoNotaCreateInput'
 *     responses:
 *       201:
 *         description: Nota registrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoNota'
 */
router.post(
  '/:cursoId/turmas/:turmaId/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  NotasController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas/{notaId}:
 *   get:
 *     summary: Detalhar nota lançada
 *     tags: ['Cursos - Notas']
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
 *         name: notaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos da nota
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoNota'
 */
router.get(
  '/:cursoId/turmas/:turmaId/notas/:notaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  NotasController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas/{notaId}:
 *   put:
 *     summary: Atualizar nota lançada
 *     tags: ['Cursos - Notas']
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
 *         name: notaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoNotaUpdateInput'
 *     responses:
 *       200:
 *         description: Nota atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoNota'
 */
router.put(
  '/:cursoId/turmas/:turmaId/notas/:notaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  NotasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas/{notaId}:
 *   delete:
 *     summary: Remover nota lançada
 *     tags: ['Cursos - Notas']
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
 *         name: notaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Nota removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 */
router.delete(
  '/:cursoId/turmas/:turmaId/notas/:notaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  NotasController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/matriculas/{matriculaId}/frequencias-detalhadas:
 *   get:
 *     summary: Consultar registros de frequência de uma matrícula (admin)
 *     tags: ['Cursos - Frequências']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matriculaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Frequência lançada e informações da matrícula
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoFrequenciaResumoMatricula'
 */
router.get(
  '/matriculas/:matriculaId/frequencias-detalhadas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  FrequenciaController.listByMatricula,
);

/**
 * @openapi
 * /api/v1/cursos/me/matriculas/{matriculaId}/frequencias-detalhadas:
 *   get:
 *     summary: Consultar registros de frequência do aluno autenticado
 *     tags: ['Cursos - Frequências']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matriculaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Frequência lançada associada à matrícula do aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoFrequenciaResumoMatricula'
 */
router.get(
  '/me/matriculas/:matriculaId/frequencias-detalhadas',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  FrequenciaController.listMy,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/notas:
 *   put:
 *     summary: Registrar ou atualizar nota de prova
 *     tags: ['Cursos - Provas']
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
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoTurmaProvaNotaInput'
 *     responses:
 *       200:
 *         description: Nota registrada com sucesso
 */
router.put(
  '/:cursoId/turmas/:turmaId/provas/:provaId/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  ProvasController.registrarNota,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/regras-avaliacao:
 *   get:
 *     summary: Obter regras de avaliação da turma
 *     tags: ['Cursos - Avaliação']
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
 */
router.get(
  '/:cursoId/turmas/:turmaId/regras-avaliacao',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  AvaliacaoController.getRules,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/regras-avaliacao:
 *   put:
 *     summary: Atualizar regras de avaliação da turma
 *     tags: ['Cursos - Avaliação']
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
 *             $ref: '#/components/schemas/CursoTurmaRegrasAvaliacaoInput'
 */
router.put(
  '/:cursoId/turmas/:turmaId/regras-avaliacao',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  AvaliacaoController.updateRules,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/recuperacoes:
 *   post:
 *     summary: Registrar tentativa de recuperação
 *     tags: ['Cursos - Avaliação']
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
 *             $ref: '#/components/schemas/CursoTurmaRecuperacaoInput'
 */
router.post(
  '/:cursoId/turmas/:turmaId/recuperacoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  AvaliacaoController.registrarRecuperacao,
);

/**
 * @openapi
 * /api/v1/cursos/matriculas/{matriculaId}/notas-detalhadas:
 *   get:
 *     summary: Consultar notas lançadas de uma matrícula (admin)
 *     tags: ['Cursos - Notas']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matriculaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notas lançadas e informações da matrícula
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoNotaResumoMatricula'
 */
router.get(
  '/matriculas/:matriculaId/notas-detalhadas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.PROFESSOR]),
  NotasController.listByMatricula,
);

/**
 * @openapi
 * /api/v1/cursos/me/matriculas/{matriculaId}/notas-detalhadas:
 *   get:
 *     summary: Consultar notas lançadas do aluno autenticado
 *     tags: ['Cursos - Notas']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matriculaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notas lançadas associadas à matrícula do aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoNotaResumoMatricula'
 */
router.get(
  '/me/matriculas/:matriculaId/notas-detalhadas',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  NotasController.listMy,
);

/**
 * @openapi
 * /api/v1/cursos/matriculas/{matriculaId}/notas:
 *   get:
 *     summary: Consultar notas consolidadas de uma matrícula (admin)
 *     tags: ['Cursos - Avaliação']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matriculaId
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/matriculas/:matriculaId/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  AvaliacaoController.getGrades,
);

/**
 * @openapi
 * /api/v1/cursos/me/matriculas/{matriculaId}/notas:
 *   get:
 *     summary: Consultar notas consolidadas do aluno autenticado
 *     tags: ['Cursos - Avaliação']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matriculaId
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/me/matriculas/:matriculaId/notas',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  AvaliacaoController.getMyGrades,
);

export { router as cursosRoutes };
