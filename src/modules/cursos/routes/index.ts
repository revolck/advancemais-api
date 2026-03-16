import { Router } from 'express';
import { Roles } from '@prisma/client';

import { publicCache } from '@/middlewares/cache-control';
import { optionalSupabaseAuth, supabaseAuthMiddleware } from '@/modules/usuarios/auth';

import { CursosController } from '../controllers/cursos.controller';
import { CategoriasController } from '../controllers/categorias.controller';
import { AulasController } from '../controllers/aulas.controller';
import { TurmasController } from '../controllers/turmas.controller';
import { ModulosController } from '../controllers/modulos.controller';
import { ProvasController } from '../controllers/provas.controller';
import { QuestoesController } from '../controllers/questoes.controller';
import { AvaliacaoController } from '../controllers/avaliacao.controller';
import { AvaliacoesController } from '../controllers/avaliacoes.controller';
import { NotasController } from '../controllers/notas.controller';
import { FrequenciaController } from '../controllers/frequencia.controller';
import { AgendaController } from '../controllers/agenda.controller';
import { CertificadosController } from '../controllers/certificados.controller';
import { EstagiosController } from '../controllers/estagios.controller';
import cursosCheckoutRoutes from '../checkout/routes';
import aulasRoutes, { agendaRoutes } from '../aulas/routes';
import {
  cursosAulasGetResponseCache,
  cursosAulasInvalidateCacheOnMutation,
} from '../aulas/middlewares/aulas-response-cache';
import {
  cursosTurmasGetResponseCache,
  cursosTurmasInvalidateCacheOnMutation,
} from '../middlewares/turmas-response-cache';
import {
  cursosAlunosGetResponseCache,
  cursosAlunosInvalidateCacheOnMutation,
} from '../middlewares/alunos-response-cache';
import {
  cursosAvaliacoesGetResponseCache,
  cursosAvaliacoesInvalidateCacheOnMutation,
} from '../middlewares/avaliacoes-response-cache';

const router = Router();

// Cache HTTP transversal para rotas sob /:cursoId/turmas*
router.use('/:cursoId/turmas', cursosTurmasGetResponseCache, cursosTurmasInvalidateCacheOnMutation);

// ========================================
// ROTAS DE CHECKOUT DE CURSOS (Mercado Pago)
// ========================================
// Adicionar rotas de checkout de cursos (pagamento único via Mercado Pago)
router.use('/', cursosCheckoutRoutes);

// ========================================
// ROTAS DE GESTÃO DE AULAS
// ========================================
// Sistema completo de aulas (Online, Presencial, Ao Vivo, Semipresencial)
router.use('/aulas', cursosAulasGetResponseCache, cursosAulasInvalidateCacheOnMutation);
router.use('/aulas', aulasRoutes);

// ========================================
// ROTAS DE AGENDA
// ========================================
// Agenda unificada (aulas, provas, aniversários, turmas)
router.use('/agenda', agendaRoutes);

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

// ========================================
// BIBLIOTECA GLOBAL DE AVALIAÇÕES (TEMPLATES)
// ========================================
router.get(
  '/avaliacoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesGetResponseCache,
  AvaliacoesController.list,
);
// Rotas auxiliares para formulário de criação (ANTES do POST)
router.get(
  '/avaliacoes/turmas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesGetResponseCache,
  AvaliacoesController.listTurmas,
);
router.get(
  '/avaliacoes/instrutores',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesGetResponseCache,
  AvaliacoesController.listInstrutores,
);
router.post(
  '/avaliacoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  AvaliacoesController.create,
);
router.get(
  '/avaliacoes/historico',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesGetResponseCache,
  AvaliacoesController.listHistorico,
);
router.get(
  '/avaliacoes/:id/questoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesGetResponseCache,
  AvaliacoesController.listQuestoes,
);
router.get(
  '/avaliacoes/:id',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesGetResponseCache,
  AvaliacoesController.get,
);
router.get(
  '/avaliacoes/:avaliacaoId/respostas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesGetResponseCache,
  AvaliacoesController.listRespostas,
);
router.get(
  '/avaliacoes/:avaliacaoId/respostas/:respostaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesGetResponseCache,
  AvaliacoesController.getResposta,
);
router.patch(
  '/avaliacoes/:avaliacaoId/respostas/:respostaId/correcao',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  AvaliacoesController.corrigirResposta,
);
router.put(
  '/avaliacoes/:id',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  AvaliacoesController.update,
);
router.patch(
  '/avaliacoes/:id/publicar',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  AvaliacoesController.publicar,
);
router.delete(
  '/avaliacoes/:id',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  AvaliacoesController.delete,
);
router.post(
  '/:cursoId/turmas/:turmaId/avaliacoes/clone',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  AvaliacoesController.clonarParaTurma,
);

/**
 * @openapi
 * /api/v1/cursos/visaogeral:
 *   get:
 *     summary: 📊 Visão Geral de Cursos (Admin/Moderador/Pedagógico)
 *     description: |
 *       **ACESSO RESTRITO:** Apenas ADMIN, MODERADOR e PEDAGOGICO podem acessar esta rota.
 *
 *       Retorna métricas completas de cursos incluindo:
 *       - Métricas gerais (total de cursos, turmas, alunos)
 *       - Cursos próximos a começar (7, 15, 30 dias)
 *       - Faturamento por curso (dados sensíveis)
 *       - Performance e taxa de conclusão
 *
 *       **⚠️ DADOS SENSÍVEIS:** Esta rota contém informações de faturamento e receita.
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visão geral completa de cursos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     metricasGerais:
 *                       type: object
 *                       properties:
 *                         totalCursos:
 *                           type: integer
 *                           description: Total de cursos no sistema
 *                         cursosPublicados:
 *                           type: integer
 *                         cursosRascunho:
 *                           type: integer
 *                         totalTurmas:
 *                           type: integer
 *                         turmasAtivas:
 *                           type: integer
 *                         turmasInscricoesAbertas:
 *                           type: integer
 *                         totalAlunosInscritos:
 *                           type: integer
 *                         totalAlunosAtivos:
 *                           type: integer
 *                         totalAlunosConcluidos:
 *                           type: integer
 *                     cursosProximosInicio:
 *                       type: object
 *                       properties:
 *                         proximos7Dias:
 *                           type: array
 *                           items:
 *                             type: object
 *                         proximos15Dias:
 *                           type: array
 *                           items:
 *                             type: object
 *                         proximos30Dias:
 *                           type: array
 *                           items:
 *                             type: object
 *                     faturamento:
 *                       type: object
 *                       properties:
 *                         totalFaturamento:
 *                           type: number
 *                           description: Faturamento total de todos os cursos
 *                         faturamentoMesAtual:
 *                           type: number
 *                         faturamentoMesAnterior:
 *                           type: number
 *                         cursoMaiorFaturamento:
 *                           type: object
 *                           nullable: true
 *                         topCursosFaturamento:
 *                           type: array
 *                           items:
 *                             type: object
 *                     performance:
 *                       type: object
 *                       properties:
 *                         cursosMaisPopulares:
 *                           type: array
 *                           items:
 *                             type: object
 *                         taxaConclusao:
 *                           type: number
 *                         cursosComMaiorTaxaConclusao:
 *                           type: array
 *                           items:
 *                             type: object
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado - apenas ADMIN, MODERADOR e PEDAGOGICO
 *       500:
 *         description: Erro ao buscar visão geral
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/visaogeral',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CursosController.visaogeral,
);

/**
 * @openapi
 * /api/v1/cursos/visaogeral/faturamento:
 *   get:
 *     summary: 📈 Tendências de Faturamento (Cursos)
 *     description: |
 *       Retorna tendências e agregações de faturamento de cursos para o dashboard.
 *
 *       **ACESSO RESTRITO:** Apenas ADMIN, MODERADOR e PEDAGOGICO podem acessar esta rota.
 *
 *       Fonte de dados: `AuditoriaTransacoes` com registros associados a cursos (via `metadata.cursoId` ou `metadata.curso.id`).
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         required: false
 *         schema:
 *           type: string
 *           enum: [day, week, month, year, custom]
 *           default: month
 *         description: Período de agregação.
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           example: '2026-01-01'
 *         description: Obrigatório quando `period=custom` (YYYY-MM-DD).
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           example: '2026-01-31'
 *         description: Obrigatório quando `period=custom` (YYYY-MM-DD).
 *       - in: query
 *         name: tz
 *         required: false
 *         schema:
 *           type: string
 *           default: America/Sao_Paulo
 *         description: Timezone IANA para cálculo e agrupamento.
 *       - in: query
 *         name: top
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *         description: Quantidade máxima de cursos no ranking de faturamento.
 *     responses:
 *       200:
 *         description: Tendências de faturamento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                       example: month
 *                     startDate:
 *                       type: string
 *                       example: '2026-01-01'
 *                     endDate:
 *                       type: string
 *                       example: '2026-01-31'
 *                     faturamentoMesAtual:
 *                       type: number
 *                       example: 123456.78
 *                     faturamentoMesAnterior:
 *                       type: number
 *                       example: 100000.0
 *                     totalTransacoes:
 *                       type: number
 *                       example: 320
 *                     transacoesAprovadas:
 *                       type: number
 *                       example: 287
 *                     cursosAtivos:
 *                       type: number
 *                       example: 42
 *                     historicalData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: '2026-01-01'
 *                           faturamento:
 *                             type: number
 *                             example: 1234.56
 *                           transacoes:
 *                             type: number
 *                             example: 10
 *                           transacoesAprovadas:
 *                             type: number
 *                             example: 9
 *                           cursos:
 *                             type: number
 *                             example: 8
 *                     topCursosFaturamento:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           cursoId: { type: string }
 *                           cursoNome: { type: string }
 *                           cursoCodigo: { type: string }
 *                           totalFaturamento: { type: number }
 *                           totalTransacoes: { type: number }
 *                           transacoesAprovadas: { type: number }
 *                           transacoesPendentes: { type: number }
 *                           ultimaTransacao:
 *                             type: string
 *                             nullable: true
 *                     cursoMaiorFaturamento:
 *                       nullable: true
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado - apenas ADMIN, MODERADOR e PEDAGOGICO
 *       500:
 *         description: Erro ao buscar faturamento
 */
router.get(
  '/visaogeral/faturamento',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CursosController.visaogeralFaturamento,
);

/**
 * @openapi
 * /api/v1/cursos/categorias:
 *   get:
 *     summary: Listar categorias de cursos
 *     tags: ['Cursos']
 *     responses:
 *       200:
 *         description: Lista de categorias com subcategorias associadas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CursoCategoria'
 *       500:
 *         description: Erro ao listar categorias
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/categorias', publicCache, CategoriasController.list);

/**
 * @openapi
 * /api/v1/cursos/categorias/{categoriaId}:
 *   get:
 *     summary: Obter detalhes de uma categoria específica
 *     tags: ['Cursos']
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Categoria encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoCategoriaDetalhe'
 *       400:
 *         description: Identificador inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Categoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/categorias/:categoriaId', publicCache, CategoriasController.get);

/**
 * @openapi
 * /api/v1/cursos/categorias:
 *   post:
 *     summary: Criar uma nova categoria de curso
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoCategoriaCreateInput'
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoCategoriaDetalhe'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Permissões insuficientes
 *       409:
 *         description: Categoria duplicada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/categorias',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CategoriasController.create,
);

/**
 * @openapi
 * /api/v1/cursos/categorias/{categoriaId}:
 *   put:
 *     summary: Atualizar uma categoria de curso
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoCategoriaUpdateInput'
 *     responses:
 *       200:
 *         description: Categoria atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoCategoriaDetalhe'
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Categoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/categorias/:categoriaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CategoriasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/categorias/{categoriaId}:
 *   delete:
 *     summary: Remover uma categoria de curso
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       204:
 *         description: Categoria removida com sucesso
 *       404:
 *         description: Categoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Categoria em uso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  '/categorias/:categoriaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CategoriasController.remove,
);

/**
 * @openapi
 * /api/v1/cursos/categorias/{categoriaId}/subcategorias:
 *   get:
 *     summary: Listar subcategorias de uma categoria de curso
 *     tags: ['Cursos']
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: page
 *         required: false
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *     responses:
 *       200:
 *         description: Lista de subcategorias retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoSubcategoria'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer, example: 1 }
 *                     pageSize: { type: integer, example: 50 }
 *                     totalItems: { type: integer, example: 3 }
 *                     totalPages: { type: integer, example: 1 }
 *       400:
 *         description: Parâmetros inválidos
 *       404:
 *         description: Categoria não encontrada
 */
router.get(
  '/categorias/:categoriaId/subcategorias',
  publicCache,
  CategoriasController.listSubcategorias,
);

/**
 * @openapi
 * /api/v1/cursos/categorias/{categoriaId}/subcategorias:
 *   post:
 *     summary: Criar uma subcategoria vinculada a uma categoria
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoSubcategoriaCreateInput'
 *     responses:
 *       201:
 *         description: Subcategoria criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoSubcategoria'
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Categoria não encontrada
 */
router.post(
  '/categorias/:categoriaId/subcategorias',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CategoriasController.createSubcategoria,
);

/**
 * @openapi
 * /api/v1/cursos/subcategorias/{subcategoriaId}:
 *   put:
 *     summary: Atualizar uma subcategoria existente
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subcategoriaId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoSubcategoriaUpdateInput'
 *     responses:
 *       200:
 *         description: Subcategoria atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoSubcategoria'
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Subcategoria não encontrada
 */
router.put(
  '/subcategorias/:subcategoriaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CategoriasController.updateSubcategoria,
);

/**
 * @openapi
 * /api/v1/cursos/subcategorias/{subcategoriaId}:
 *   delete:
 *     summary: Remover uma subcategoria de curso
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subcategoriaId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       204:
 *         description: Subcategoria removida com sucesso
 *       404:
 *         description: Subcategoria não encontrada
 */
router.delete(
  '/subcategorias/:subcategoriaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CategoriasController.removeSubcategoria,
);

/**
 * @openapi
 * /api/v1/cursos/alunos:
 *   get:
 *     summary: 👥 Listar alunos com inscrições em cursos
 *     description: |
 *       Retorna lista paginada de alunos que possuem inscrições em cursos,
 *       incluindo detalhes das inscrições, turmas e cursos associados.
 *
 *       **FILTROS DISPONÍVEIS:**
 *       - `cidade`: Filtra por cidade do aluno
 *       - `status`: Filtra por status da inscrição
 *       - `curso`: Filtra por ID do curso
 *       - `turma`: Filtra por ID da turma
 *       - `search`: Busca por nome, email, CPF ou matrícula
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *         description: Quantidade de itens por página
 *       - in: query
 *         name: cidade
 *         schema: { type: string }
 *         description: Filtrar por cidade do aluno
 *         example: "Campinas"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *         description: Filtrar por status da inscrição
 *       - in: query
 *         name: curso
 *         schema: { type: string }
 *         description: Filtrar por ID do curso
 *       - in: query
 *         name: turma
 *         schema: { type: string }
 *         description: Filtrar por ID da turma
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Buscar por nome, email, CPF ou código de inscrição do aluno
 *     responses:
 *       200:
 *         description: Lista paginada de alunos com inscrições
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       codigo:
 *                         type: string
 *                         description: "Código único do aluno (formato: MAT0001)"
 *                       nomeCompleto:
 *                         type: string
 *                       email:
 *                         type: string
 *                       cpf:
 *                         type: string
 *                       status:
 *                         type: string
 *                       cidade:
 *                         type: string
 *                         nullable: true
 *                         description: Cidade do aluno
 *                       estado:
 *                         type: string
 *                         nullable: true
 *                         description: Estado do aluno (UF)
 *                       ultimoLogin:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: Data/hora do último login do aluno
 *                       criadoEm:
 *                         type: string
 *                         format: date-time
 *                       ultimoCurso:
 *                         type: object
 *                         nullable: true
 *                         description: |
 *                           Dados da inscrição ATIVA do aluno (curso atual).
 *                           Prioriza EM_ANDAMENTO > INSCRITO.
 *                           Um aluno não pode estar em múltiplos cursos simultaneamente.
 *                         properties:
 *                           inscricaoId:
 *                             type: string
 *                             format: uuid
 *                           statusInscricao:
 *                             type: string
 *                             enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *                             description: "Status da inscrição do aluno na turma"
 *                           dataInscricao:
 *                             type: string
 *                             format: date-time
 *                           turma:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               nome:
 *                                 type: string
 *                               codigo:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                           curso:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               nome:
 *                                 type: string
 *                               codigo:
 *                                 type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       500:
 *         description: Erro ao listar alunos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/alunos',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAlunosGetResponseCache,
  CursosController.listAlunosComInscricoes,
);

/**
 * @openapi
 * /api/v1/cursos/alunos/{alunoId}:
 *   get:
 *     summary: 👤 Buscar detalhes completos de um aluno específico
 *     description: |
 *       Retorna informações detalhadas de um aluno, incluindo:
 *       - Dados pessoais completos
 *       - Redes sociais (LinkedIn, Instagram, etc.)
 *       - Todos os endereços cadastrados
 *       - **TODAS as inscrições em cursos** (não apenas a última)
 *       - Estatísticas de cursos (ativos, concluídos, cancelados)
 *
 *       **Diferença do /alunos (lista):**
 *       - Lista: Retorna apenas o último curso de cada aluno (performance)
 *       - Detalhes: Retorna TODOS os cursos do aluno específico
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alunoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do aluno (UUID)
 *         example: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *     responses:
 *       200:
 *         description: Detalhes do aluno retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     codigo:
 *                       type: string
 *                       description: "Código único do aluno"
 *                       example: "MAT0005"
 *                     nomeCompleto:
 *                       type: string
 *                       example: "Lucas Ferreira"
 *                     email:
 *                       type: string
 *                     cpf:
 *                       type: string
 *                     telefone:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       example: "ATIVO"
 *                     genero:
 *                       type: string
 *                       nullable: true
 *                     dataNasc:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                     descricao:
 *                       type: string
 *                       nullable: true
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                     ultimoLogin:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     criadoEm:
 *                       type: string
 *                       format: date-time
 *                     atualizadoEm:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     redesSociais:
 *                       type: object
 *                       nullable: true
 *                       description: "Redes sociais do aluno (LinkedIn, Instagram, Facebook, etc.)"
 *                       properties:
 *                         linkedin:
 *                           type: string
 *                           nullable: true
 *                           example: "https://linkedin.com/in/john-doe"
 *                         instagram:
 *                           type: string
 *                           nullable: true
 *                           example: "https://instagram.com/johndoe"
 *                         facebook:
 *                           type: string
 *                           nullable: true
 *                         youtube:
 *                           type: string
 *                           nullable: true
 *                         twitter:
 *                           type: string
 *                           nullable: true
 *                         tiktok:
 *                           type: string
 *                           nullable: true
 *                     enderecos:
 *                       type: array
 *                       description: "Lista de endereços do aluno"
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           logradouro:
 *                             type: string
 *                             nullable: true
 *                           numero:
 *                             type: string
 *                             nullable: true
 *                           bairro:
 *                             type: string
 *                             nullable: true
 *                           cidade:
 *                             type: string
 *                           estado:
 *                             type: string
 *                           cep:
 *                             type: string
 *                             nullable: true
 *                     inscricoes:
 *                       type: array
 *                       description: "TODAS as inscrições do aluno em cursos"
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           statusInscricao:
 *                             type: string
 *                             enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *                           criadoEm:
 *                             type: string
 *                             format: date-time
 *                           atualizadoEm:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           turma:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               nome:
 *                                 type: string
 *                               codigo:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                               dataInicio:
 *                                 type: string
 *                                 format: date
 *                               dataFim:
 *                                 type: string
 *                                 format: date
 *                                 nullable: true
 *                           curso:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               nome:
 *                                 type: string
 *                               codigo:
 *                                 type: string
 *                               descricao:
 *                                 type: string
 *                                 nullable: true
 *                               cargaHoraria:
 *                                 type: integer
 *                               imagemUrl:
 *                                 type: string
 *                                 nullable: true
 *                     totalInscricoes:
 *                       type: integer
 *                       description: "Total de inscrições do aluno"
 *                       example: 4
 *                     estatisticas:
 *                       type: object
 *                       description: "Resumo estatístico dos cursos do aluno"
 *                       properties:
 *                         cursosAtivos:
 *                           type: integer
 *                           description: "Cursos com status INSCRITO ou EM_ANDAMENTO"
 *                           example: 3
 *                         cursosConcluidos:
 *                           type: integer
 *                           example: 1
 *                         cursosCancelados:
 *                           type: integer
 *                           description: "Cursos CANCELADO ou TRANCADO"
 *                           example: 0
 *       400:
 *         description: ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "INVALID_ID"
 *                 message:
 *                   type: string
 *                   example: "ID do aluno inválido. Deve ser um UUID válido."
 *       404:
 *         description: Aluno não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "ALUNO_NOT_FOUND"
 *                 message:
 *                   type: string
 *                   example: "Aluno não encontrado ou não possui role de ALUNO_CANDIDATO."
 *       500:
 *         description: Erro ao buscar aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/alunos/:alunoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAlunosGetResponseCache,
  CursosController.getAlunoById,
);

/**
 * Listagem de estágios no contexto do aluno
 * GET /api/v1/cursos/alunos/:alunoId/estagios
 */
router.get(
  '/alunos/:alunoId/estagios',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  EstagiosController.listAluno,
);

/**
 * Detalhe de estágio no contexto do aluno
 * GET /api/v1/cursos/alunos/:alunoId/estagios/:estagioId
 */
router.get(
  '/alunos/:alunoId/estagios/:estagioId',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  EstagiosController.getAlunoById,
);

/**
 * Listagem de frequência do estágio no contexto do aluno
 * GET /api/v1/cursos/alunos/:alunoId/estagios/:estagioId/frequencias
 */
router.get(
  '/alunos/:alunoId/estagios/:estagioId/frequencias',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  EstagiosController.listFrequenciasProgramaAluno,
);

/**
 * Listagem agregada de frequência por período no contexto do aluno
 * GET /api/v1/cursos/alunos/:alunoId/estagios/:estagioId/frequencias/periodo
 */
router.get(
  '/alunos/:alunoId/estagios/:estagioId/frequencias/periodo',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  EstagiosController.listFrequenciasPeriodoProgramaAluno,
);

/**
 * Upsert de frequência no contexto do aluno
 * POST /api/v1/cursos/alunos/:alunoId/estagios/:estagioId/frequencias/lancamentos
 */
router.post(
  '/alunos/:alunoId/estagios/:estagioId/frequencias/lancamentos',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.upsertFrequenciaProgramaAluno,
);

/**
 * Histórico de frequência no contexto do aluno
 * GET /api/v1/cursos/alunos/:alunoId/estagios/:estagioId/frequencias/:frequenciaId/historico
 */
router.get(
  '/alunos/:alunoId/estagios/:estagioId/frequencias/:frequenciaId/historico',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  EstagiosController.listFrequenciaHistoricoProgramaAluno,
);

/**
 * Listagem de notas por aluno (com filtro obrigatório de curso + turma)
 * GET /api/v1/cursos/alunos/:alunoId/notas
 */
router.get(
  '/alunos/:alunoId/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.listAluno,
);

/**
 * Listagem de frequência por aluno (com filtro obrigatório de curso + turma)
 * GET /api/v1/cursos/alunos/:alunoId/frequencias
 */
router.get(
  '/alunos/:alunoId/frequencias',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.listAluno,
);

/**
 * Upsert de lançamento de frequência no contexto do aluno (cria/atualiza por chave natural)
 * POST /api/v1/cursos/alunos/:alunoId/frequencias/lancamentos
 */
router.post(
  '/alunos/:alunoId/frequencias/lancamentos',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.upsertLancamentoAluno,
);

/**
 * Histórico de frequência por chave natural no contexto do aluno
 * GET /api/v1/cursos/alunos/:alunoId/frequencias/historico?cursoId=...&turmaId=...&inscricaoId=...&tipoOrigem=...&origemId=...
 */
router.get(
  '/alunos/:alunoId/frequencias/historico',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.listHistoricoByNaturalKeyAluno,
);

/**
 * Histórico de frequência por ID persistido no contexto do aluno
 * GET /api/v1/cursos/alunos/:alunoId/frequencias/:frequenciaId/historico
 */
router.get(
  '/alunos/:alunoId/frequencias/:frequenciaId/historico',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.listHistoricoAluno,
);

/**
 * @openapi
 * /api/v1/cursos/alunos/{alunoId}/inscricoes:
 *   get:
 *     summary: 📚 Histórico de inscrições do aluno
 *     description: |
 *       Retorna o histórico paginado de inscrições do aluno em cursos, similar ao histórico de empresas.
 *       Permite filtrar por status de inscrição e suporta paginação.
 *
 *       **Status disponíveis:**
 *       - `INSCRITO`: Aluno inscrito (status inicial)
 *       - `EM_ANDAMENTO`: Curso em andamento
 *       - `CONCLUIDO`: Curso concluído com sucesso
 *       - `REPROVADO`: Aluno reprovado
 *       - `EM_ESTAGIO`: Aluno em estágio obrigatório
 *       - `CANCELADO`: Inscrição cancelada
 *       - `TRANCADO`: Inscrição trancada
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alunoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do aluno (UUID)
 *         example: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página atual da paginação
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Quantidade de registros por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: |
 *           Filtrar por status de inscrição. Pode ser um único status ou múltiplos separados por vírgula.
 *           Exemplos: `?status=CONCLUIDO` ou `?status=CONCLUIDO,EM_ANDAMENTO`
 *         example: "CONCLUIDO"
 *     responses:
 *       200:
 *         description: Histórico de inscrições retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: ID da inscrição
 *                       statusInscricao:
 *                         type: string
 *                         enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *                         description: Status da inscrição
 *                       criadoEm:
 *                         type: string
 *                         format: date-time
 *                         description: Data de criação da inscrição
 *                       progresso:
 *                         type: integer
 *                         minimum: 0
 *                         maximum: 100
 *                         description: Percentual de progresso do curso (0-100)
 *                       turma:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nome:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                           status:
 *                             type: string
 *                           dataInicio:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           dataFim:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                       curso:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nome:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                           descricao:
 *                             type: string
 *                             nullable: true
 *                           cargaHoraria:
 *                             type: integer
 *                           imagemUrl:
 *                             type: string
 *                             nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *             examples:
 *               default:
 *                 summary: Histórico paginado
 *                 value:
 *                   data:
 *                     - id: "f8a6c3b5-1234-4d9c-9a1b-abcdef123456"
 *                       statusInscricao: "CONCLUIDO"
 *                       criadoEm: "2024-01-15T10:30:00Z"
 *                       progresso: 100
 *                       turma:
 *                         id: "80288180-a09c-4a2a-bade-022c7268e395"
 *                         nome: "Turma 1 - React Avançado e Next.js"
 *                         codigo: "TUR0001"
 *                         status: "CONCLUIDO"
 *                         dataInicio: "2024-01-01T00:00:00Z"
 *                         dataFim: "2024-03-31T23:59:59Z"
 *                       curso:
 *                         id: "550e8400-e29b-41d4-a716-446655440000"
 *                         nome: "React Avançado e Next.js"
 *                         codigo: "CUR0001"
 *                         descricao: "Curso completo de React e Next.js"
 *                         cargaHoraria: 120
 *                         imagemUrl: "https://example.com/curso.jpg"
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 1
 *                     totalPages: 1
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "VALIDATION_ERROR"
 *                 message:
 *                   type: string
 *                   example: "Parâmetros inválidos"
 *                 issues:
 *                   type: object
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Aluno não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "ALUNO_NOT_FOUND"
 *                 message:
 *                   type: string
 *                   example: "Aluno não encontrado ou não possui role de ALUNO_CANDIDATO."
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "ALUNOS_HISTORICO_ERROR"
 *                 message:
 *                   type: string
 *                   example: "Erro ao buscar histórico de inscrições do aluno"
 */
router.get(
  '/alunos/:alunoId/inscricoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAlunosGetResponseCache,
  CursosController.listHistoricoInscricoes,
);

/**
 * @openapi
 * /api/v1/cursos/alunos/{alunoId}:
 *   put:
 *     summary: ✏️ Atualizar informações de um aluno
 *     description: |
 *       Atualiza informações de um aluno específico.
 *       Apenas ADMIN e MODERADOR podem atualizar.
 *       Campos opcionais: nomeCompleto, email, senha, confirmarSenha, telefone, genero, dataNasc, descricao, avatarUrl, endereco, redesSociais
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alunoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do aluno (UUID)
 *         example: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nomeCompleto:
 *                 type: string
 *                 example: "João da Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao.silva@example.com"
 *                 description: "Novo e-mail do aluno (deve ser único)"
 *               senha:
 *                 type: string
 *                 minLength: 8
 *                 example: "NovaSenha123!"
 *                 description: "Nova senha (mínimo 8 caracteres)"
 *               confirmarSenha:
 *                 type: string
 *                 minLength: 8
 *                 example: "NovaSenha123!"
 *                 description: "Confirmação da nova senha"
 *               telefone:
 *                 type: string
 *                 nullable: true
 *               genero:
 *                 type: string
 *                 nullable: true
 *               dataNasc:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               descricao:
 *                 type: string
 *                 nullable: true
 *               avatarUrl:
 *                 type: string
 *                 nullable: true
 *               endereco:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   logradouro: { type: string, nullable: true }
 *                   numero: { type: string, nullable: true }
 *                   bairro: { type: string, nullable: true }
 *                   cidade: { type: string, nullable: true }
 *                   estado: { type: string, nullable: true }
 *                   cep: { type: string, nullable: true }
 *               redesSociais:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   linkedin:
 *                     type: string
 *                     nullable: true
 *                   instagram:
 *                     type: string
 *                     nullable: true
 *                   facebook:
 *                     type: string
 *                     nullable: true
 *                   youtube:
 *                     type: string
 *                     nullable: true
 *                   twitter:
 *                     type: string
 *                     nullable: true
 *                   tiktok:
 *                     type: string
 *                     nullable: true
 *     responses:
 *       200:
 *         description: Informações atualizadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Informações do aluno atualizadas com sucesso"
 *                 data:
 *                   type: object
 *       400:
 *         description: ID inválido ou dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "PASSWORD_MISMATCH"
 *                 message:
 *                   type: string
 *                   example: "Senha e confirmarSenha devem ser iguais"
 *       404:
 *         description: Aluno não encontrado
 *       409:
 *         description: Email já está em uso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "EMAIL_ALREADY_EXISTS"
 *                 message:
 *                   type: string
 *                   example: "Este e-mail já está em uso por outro usuário"
 *       500:
 *         description: Erro ao atualizar aluno
 */
router.put(
  '/alunos/:alunoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR]),
  cursosAlunosInvalidateCacheOnMutation,
  CursosController.atualizarAlunoById,
);

/**
 * @openapi
 * /api/v1/cursos:
 *   get:
 *     summary: 📋 Listar TODOS os cursos (Administrativo)
 *     description: |
 *       **USO:** Dashboard administrativo, gestão de cursos
 *
 *       Retorna todos os cursos do sistema com paginação e filtros avançados.
 *       Inclui cursos em RASCUNHO, PUBLICADOS e ARQUIVADOS.
 *
 *       **ROTA PÚBLICA ALTERNATIVA:** Para listar apenas cursos publicados use `/api/v1/cursos/publico/cursos`
 *
 *       **EXEMPLO:** `GET /api/v1/cursos?page=1&pageSize=10&search=Excel`
 *     tags: [Cursos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Número da página
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *         description: Quantidade de itens por página
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Busca por nome ou código do curso
 *         example: "Excel"
 *       - in: query
 *         name: statusPadrao
 *         schema: { $ref: '#/components/schemas/CursosStatusPadrao' }
 *         description: Filtrar por status (RASCUNHO, PUBLICADO, ARQUIVADO)
 *       - in: query
 *         name: instrutorId
 *         schema: { type: string, format: uuid }
 *         description: Filtrar por instrutor
 *       - in: query
 *         name: includeTurmas
 *         schema: { type: boolean }
 *         description: Incluir turmas vinculadas ao curso
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
 *     summary: 🔍 Buscar curso por ID (Administrativo)
 *     description: |
 *       **USO:** Visualizar detalhes completos de um curso específico no dashboard
 *
 *       Retorna todos os dados de um curso, independente do status (RASCUNHO, PUBLICADO, ARQUIVADO).
 *       Inclui informações completas como categoria, subcategoria, carga horária, etc.
 *
 *       **ROTA PÚBLICA ALTERNATIVA:** Para buscar apenas cursos publicados use `/api/v1/cursos/publico/cursos/{cursoId}`
 *
 *       **EXEMPLO:** `GET /api/v1/cursos/4`
 *     tags: [Cursos]
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: ID numérico do curso
 *         example: 4
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
 *             example:
 *               message: "Curso não encontrado"
 *               statusCode: 404
 */
// Rotas específicas de estágios (devem vir ANTES das rotas parametrizadas /:cursoId para evitar conflito)
/**
 * Listar estágios (dashboard)
 * GET /api/v1/cursos/estagios?cursoId?&turmaIds?&status?&search?&page&pageSize
 */
router.get(
  '/estagios',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.list,
);

/**
 * Cadastrar estágio (visão geral de estágios)
 * POST /api/v1/cursos/estagios
 */
router.post(
  '/estagios',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.createPrograma,
);

/**
 * Atualizar status de um estágio
 * PATCH /api/v1/cursos/estagios/:estagioId/status
 */
router.patch(
  '/estagios/:estagioId/status',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  EstagiosController.updateStatus,
);

/**
 * Detalhar estágio
 * GET /api/v1/cursos/estagios/:estagioId
 */
router.get(
  '/estagios/:estagioId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.getPrograma,
);

/**
 * Editar estágio
 * PUT /api/v1/cursos/estagios/:estagioId
 */
router.put(
  '/estagios/:estagioId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.updatePrograma,
);

/**
 * Vincular alunos ao estágio
 * POST /api/v1/cursos/estagios/:estagioId/alunos/vincular
 */
router.post(
  '/estagios/:estagioId/alunos/vincular',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.vincularAlunosPrograma,
);

/**
 * Alocar aluno em grupo de estágio
 * PUT /api/v1/cursos/estagios/:estagioId/alunos/:estagioAlunoId/grupo
 */
router.put(
  '/estagios/:estagioId/alunos/:estagioAlunoId/grupo',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.alocarAlunoGrupoPrograma,
);

/**
 * Listar frequência por estágio
 * GET /api/v1/cursos/estagios/:estagioId/frequencias
 */
router.get(
  '/estagios/:estagioId/frequencias',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.listFrequenciasPrograma,
);

/**
 * Listar frequência agregada por período (evita N chamadas por data)
 * GET /api/v1/cursos/estagios/:estagioId/frequencias/periodo
 */
router.get(
  '/estagios/:estagioId/frequencias/periodo',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.listFrequenciasPeriodoPrograma,
);

/**
 * Upsert de frequência do estágio
 * POST /api/v1/cursos/estagios/:estagioId/frequencias/lancamentos
 */
router.post(
  '/estagios/:estagioId/frequencias/lancamentos',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.upsertFrequenciaPrograma,
);

/**
 * Histórico de alterações da frequência de estágio
 * GET /api/v1/cursos/estagios/:estagioId/frequencias/:frequenciaId/historico
 */
router.get(
  '/estagios/:estagioId/frequencias/:frequenciaId/historico',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.listFrequenciaHistoricoPrograma,
);

/**
 * Concluir participação do aluno no estágio
 * POST /api/v1/cursos/estagios/:estagioId/alunos/:estagioAlunoId/concluir
 */
router.post(
  '/estagios/:estagioId/alunos/:estagioAlunoId/concluir',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.concluirAlunoPrograma,
);

/**
 * Listagem consolidada de notas (todos os cursos, com filtros opcionais)
 * GET /api/v1/cursos/notas
 */
router.get(
  '/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.listGeral,
);

/**
 * Listagem consolidada de frequências (todos os cursos/turmas acessíveis, com filtros opcionais)
 * GET /api/v1/cursos/frequencias
 */
router.get(
  '/frequencias',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.listGeral,
);

router.get(
  '/:cursoId/meta',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CursosController.metaCurso,
);
router.get('/:cursoId([0-9a-fA-F-]{36})', publicCache, CursosController.get);

/**
 * @openapi
 * /api/v1/cursos/publico/cursos:
 *   get:
 *     summary: 🌐 Listar cursos PUBLICADOS (Público)
 *     description: |
 *       **USO:** Vitrine pública de cursos, catálogo no site
 *
 *       ⚠️ **ATENÇÃO:** Esta rota retorna apenas cursos com `statusPadrao = PUBLICADO`
 *
 *       Ideal para exibição pública no site/app onde usuários não autenticados navegam pelo catálogo.
 *       Cursos em RASCUNHO ou ARQUIVADOS não aparecem nesta lista.
 *
 *       **ROTA ADMINISTRATIVA:** Para ver todos os cursos use `/api/v1/cursos`
 *
 *       **EXEMPLO:** `GET /api/v1/cursos/publico/cursos`
 *     tags: [Cursos]
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
 *     summary: 🔍 Buscar curso PUBLICADO por ID (Público)
 *     description: |
 *       **USO:** Página de detalhes do curso no site público
 *
 *       ⚠️ **ATENÇÃO:** Esta rota retorna apenas cursos com `statusPadrao = PUBLICADO`
 *
 *       Retorna detalhes completos do curso incluindo turmas disponíveis e módulos.
 *       Ideal para a landing page do curso no site onde usuários podem se inscrever.
 *
 *       **ROTA ADMINISTRATIVA:** Para ver qualquer curso (incluindo rascunhos) use `/api/v1/cursos/{cursoId}`
 *
 *       **EXEMPLO:** `GET /api/v1/cursos/publico/cursos/4`
 *     tags: [Cursos]
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: ID numérico do curso
 *         example: 4
 *     responses:
 *       200:
 *         description: Detalhes do curso com turmas e módulos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoPublicoDetalhado'
 *       404:
 *         description: Curso não encontrado ou indisponível (não publicado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Curso não encontrado ou indisponível"
 *               statusCode: 404
 */
router.get('/publico/cursos/:cursoId', publicCache, CursosController.publicGet);

/**
 * @openapi
 * /api/v1/cursos/publico/turmas/{turmaId}:
 *   get:
 *     summary: Detalhar turma publicada
 *     tags: [Cursos]
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CursosController.create,
);

/**
 * @openapi
 * /api/v1/cursos/templates/vincular:
 *   post:
 *     summary: Vincular templates de aula/avaliação a um curso
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cursoId]
 *             properties:
 *               cursoId:
 *                 type: string
 *                 format: uuid
 *               aulaTemplateIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               avaliacaoTemplateIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Templates vinculados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedAulas: { type: integer }
 *                     updatedAvaliacoes: { type: integer }
 *       400:
 *         description: Payload inválido
 *       404:
 *         description: Curso ou templates não encontrados
 */
router.post(
  '/templates/vincular',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CursosController.vincularTemplates,
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CursosController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/exclusao-definitiva:
 *   delete:
 *     summary: Exclusão lógica de curso (somente sem turmas vinculadas)
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Curso excluído logicamente
 *       404:
 *         description: Curso não encontrado
 *       409:
 *         description: Curso possui turmas vinculadas e não pode ser excluído
 */
router.delete(
  '/:cursoId/exclusao-definitiva',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  CursosController.deleteDefinitivo,
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
 *     summary: Listar turmas de um curso (Paginado com filtros e contagem de inscrições)
 *     description: |
 *       **✅ OTIMIZAÇÃO DE PERFORMANCE:**
 *
 *       Este endpoint retorna turmas paginadas com contagem automática de inscrições ativas,
 *       eliminando a necessidade de múltiplas requisições do frontend.
 *
 *       **Campos adicionados:**
 *       - `inscricoesCount`: Número de inscrições ativas (calculado em tempo real)
 *       - `vagasOcupadas`: Vagas ocupadas (igual a inscricoesCount)
 *       - `vagasDisponiveisCalculadas`: Vagas disponíveis calculadas (vagasTotais - inscricoesCount)
 *       - `curso`: Objeto com informações do curso vinculado (id, nome, codigo)
 *
 *       **Inscrição ativa:** Status não é CANCELADO/TRANCADO E aluno está ATIVO.
 *
 *       **Performance:** Contagem é calculada em batch usando agregação SQL, garantindo eficiência mesmo com muitas turmas.
 *
 *       **Paginação:** Padrão de 10 itens por página, máximo 100.
 *
 *       **Filtros disponíveis:** status, turno, metodo, instrutorId
 *     tags: ['Cursos']
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: ID numérico do curso
 *         example: 1
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Número da página
 *         example: 1
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *         description: Quantidade de itens por página
 *         example: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [RASCUNHO, PUBLICADO, INSCRICOES_ABERTAS, INSCRICOES_ENCERRADAS, EM_ANDAMENTO, CONCLUIDO, SUSPENSO, CANCELADO]
 *         description: Filtrar por status da turma
 *         example: "INSCRICOES_ABERTAS"
 *       - in: query
 *         name: turno
 *         schema:
 *           type: string
 *           enum: [MANHA, TARDE, NOITE, INTEGRAL]
 *         description: Filtrar por turno
 *         example: "NOITE"
 *       - in: query
 *         name: metodo
 *         schema:
 *           type: string
 *           enum: [ONLINE, PRESENCIAL, LIVE, SEMIPRESENCIAL]
 *         description: Filtrar por método de ensino
 *         example: "ONLINE"
 *       - in: query
 *         name: instrutorId
 *         schema: { type: string, format: uuid }
 *         description: Filtrar por instrutor (UUID)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Lista paginada de turmas do curso com contagem de inscrições
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       codigo:
 *                         type: string
 *                       nome:
 *                         type: string
 *                       turno:
 *                         type: string
 *                       metodo:
 *                         type: string
 *                       status:
 *                         type: string
 *                       vagasTotais:
 *                         type: integer
 *                       vagasDisponiveis:
 *                         type: integer
 *                       inscricoesCount:
 *                         type: integer
 *                         description: Número de inscrições ativas (calculado)
 *                       vagasOcupadas:
 *                         type: integer
 *                         description: Vagas ocupadas (igual a inscricoesCount)
 *                       vagasDisponiveisCalculadas:
 *                         type: integer
 *                         description: Vagas disponíveis calculadas (vagasTotais - inscricoesCount)
 *                       curso:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           nome:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *                 filters:
 *                   type: object
 *                   properties:
 *                     applied:
 *                       type: object
 *                       properties:
 *                         cursoId:
 *                           type: integer
 *                         status:
 *                           type: string
 *                           nullable: true
 *                         turno:
 *                           type: string
 *                           nullable: true
 *                         metodo:
 *                           type: string
 *                           nullable: true
 *                         instrutorId:
 *                           type: string
 *                           nullable: true
 *                 meta:
 *                   type: object
 *                   properties:
 *                     empty:
 *                       type: boolean
 *       400:
 *         description: Parâmetros de consulta inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Curso não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @openapi
 * /api/v1/cursos/{cursoId}/inscricoes:
 *   get:
 *     summary: 📚 Histórico de inscrições do curso
 *     description: |
 *       Retorna o histórico paginado de inscrições de um curso específico.
 *       Permite filtrar por status de inscrição e turma, com suporte a paginação.
 *
 *       **Status disponíveis:**
 *       - `INSCRITO`: Aluno inscrito (status inicial)
 *       - `EM_ANDAMENTO`: Curso em andamento
 *       - `CONCLUIDO`: Curso concluído com sucesso
 *       - `REPROVADO`: Aluno reprovado
 *       - `EM_ESTAGIO`: Aluno em estágio obrigatório
 *       - `CANCELADO`: Inscrição cancelada
 *       - `TRANCADO`: Inscrição trancada
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do curso (UUID)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página atual da paginação
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 20
 *         description: Quantidade de registros por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: |
 *           Filtrar por status de inscrição. Pode ser um único status ou múltiplos separados por vírgula.
 *           Exemplos: `?status=CONCLUIDO` ou `?status=CONCLUIDO,EM_ANDAMENTO`
 *         example: "CONCLUIDO"
 *       - in: query
 *         name: turmaId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID da turma (UUID)
 *         example: "80288180-a09c-4a2a-bade-022c7268e395"
 *       - in: query
 *         name: statusPagamento
 *         schema:
 *           type: string
 *         description: |
 *           Filtrar por status de pagamento. Aceita valor único ou múltiplos separados por vírgula.
 *           Exemplos: `?statusPagamento=APROVADO` ou `?statusPagamento=APROVADO,PENDENTE`
 *         example: "APROVADO"
 *       - in: query
 *         name: includeProgress
 *         schema:
 *           type: boolean
 *           default: false
 *         description: |
 *           Quando `false` (padrão), não calcula progresso para reduzir latência da listagem.
 *           Use `true` quando precisar do percentual no payload.
 *     responses:
 *       200:
 *         description: Histórico de inscrições retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: ID da inscrição
 *                       statusInscricao:
 *                         type: string
 *                         enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *                         description: Status da inscrição
 *                       statusPagamento:
 *                         type: string
 *                         description: Status do pagamento da inscrição
 *                         example: "APROVADO"
 *                       criadoEm:
 *                         type: string
 *                         format: date-time
 *                         description: Data de criação da inscrição
 *                       progresso:
 *                         type: integer
 *                         nullable: true
 *                         minimum: 0
 *                         maximum: 100
 *                         description: Percentual de progresso do curso (0-100). Quando `includeProgress=false`, retorna `null`.
 *                       aluno:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nomeCompleto:
 *                             type: string
 *                           email:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                           cpf:
 *                             type: string
 *                           status:
 *                             type: string
 *                           avatarUrl:
 *                             type: string
 *                             nullable: true
 *                           cidade:
 *                             type: string
 *                             nullable: true
 *                           estado:
 *                             type: string
 *                             nullable: true
 *                       turma:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nome:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                           status:
 *                             type: string
 *                           dataInicio:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           dataFim:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                       curso:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nome:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                           descricao:
 *                             type: string
 *                             nullable: true
 *                           cargaHoraria:
 *                             type: integer
 *                           imagemUrl:
 *                             type: string
 *                             nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *             examples:
 *               default:
 *                 summary: Histórico paginado
 *                 value:
 *                   data:
 *                     - id: "f8a6c3b5-1234-4d9c-9a1b-abcdef123456"
 *                       statusInscricao: "CONCLUIDO"
 *                       statusPagamento: "APROVADO"
 *                       criadoEm: "2024-01-15T10:30:00Z"
 *                       progresso: 100
 *                       aluno:
 *                         id: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *                         nomeCompleto: "João da Silva"
 *                         email: "joao.silva@example.com"
 *                         codigo: "MAT0001"
 *                         cpf: "123.123.123-12"
 *                         status: "ATIVO"
 *                         avatarUrl: "https://example.com/avatar.jpg"
 *                         cidade: "São Paulo"
 *                         estado: "SP"
 *                       turma:
 *                         id: "80288180-a09c-4a2a-bade-022c7268e395"
 *                         nome: "Turma 1 - React Avançado e Next.js"
 *                         codigo: "TUR0001"
 *                         status: "CONCLUIDO"
 *                         dataInicio: "2024-01-01T00:00:00Z"
 *                         dataFim: "2024-03-31T23:59:59Z"
 *                       curso:
 *                         id: "550e8400-e29b-41d4-a716-446655440000"
 *                         nome: "React Avançado e Next.js"
 *                         codigo: "CUR0001"
 *                         descricao: "Curso completo de React e Next.js"
 *                         cargaHoraria: 120
 *                         imagemUrl: "https://example.com/curso.jpg"
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 1
 *                     totalPages: 1
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "VALIDATION_ERROR"
 *                 message:
 *                   type: string
 *                   example: "Parâmetros inválidos"
 *                 issues:
 *                   type: object
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Curso não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "CURSO_NOT_FOUND"
 *                 message:
 *                   type: string
 *                   example: "Curso não encontrado."
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "CURSO_HISTORICO_ERROR"
 *                 message:
 *                   type: string
 *                   example: "Erro ao buscar histórico de inscrições do curso"
 */
router.get(
  '/:cursoId/inscricoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CursosController.listHistoricoInscricoesPorCurso,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/auditoria:
 *   get:
 *     summary: 📋 Histórico de auditoria do curso
 *     description: |
 *       Retorna o histórico completo de alterações realizadas em um curso, incluindo:
 *       - Quem editou (usuário e role)
 *       - Quando foi editado (data e hora)
 *       - O que foi alterado (campo específico)
 *       - Valores anterior e novo
 *       - Descrição da alteração
 *
 *       **Campos rastreados:**
 *       - Nome do curso
 *       - Descrição
 *       - Imagem do curso
 *       - Carga horária
 *       - Categoria
 *       - Subcategoria
 *       - Status padrão
 *       - Estágio obrigatório
 *
 *       **Ordenação:** Por data (mais recentes primeiro)
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do curso (UUID)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página atual da paginação
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Quantidade de registros por página
 *     responses:
 *       200:
 *         description: Histórico de auditoria retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: ID do registro de auditoria
 *                       tipo:
 *                         type: string
 *                         example: "CURSO_ALTERACAO"
 *                       acao:
 *                         type: string
 *                         example: "CURSO_ATUALIZADO"
 *                       campo:
 *                         type: string
 *                         nullable: true
 *                         example: "nome"
 *                         description: Campo que foi alterado
 *                       valorAnterior:
 *                         type: string
 *                         nullable: true
 *                         example: "React Avançado"
 *                         description: Valor anterior do campo
 *                       valorNovo:
 *                         type: string
 *                         nullable: true
 *                         example: "React Avançado e Next.js"
 *                         description: Novo valor do campo
 *                       descricao:
 *                         type: string
 *                         example: "Nome do curso alterado de \"React Avançado\" para \"React Avançado e Next.js\""
 *                       metadata:
 *                         type: object
 *                         nullable: true
 *                         description: Metadados adicionais da alteração
 *                       criadoEm:
 *                         type: string
 *                         format: date-time
 *                         description: Data e hora da alteração
 *                       alteradoPor:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nomeCompleto:
 *                             type: string
 *                             example: "João Silva"
 *                           email:
 *                             type: string
 *                             example: "joao.silva@example.com"
 *                           role:
 *                             type: string
 *                             example: "ADMIN"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *             examples:
 *               default:
 *                 summary: Histórico paginado
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                       tipo: "CURSO_ALTERACAO"
 *                       acao: "CURSO_ATUALIZADO"
 *                       campo: "nome"
 *                       valorAnterior: "React Avançado"
 *                       valorNovo: "React Avançado e Next.js"
 *                       descricao: "Nome do curso alterado de \"React Avançado\" para \"React Avançado e Next.js\""
 *                       metadata:
 *                         cursoId: "550e8400-e29b-41d4-a716-446655440000"
 *                         campo: "nome"
 *                       criadoEm: "2024-01-15T10:30:00Z"
 *                       alteradoPor:
 *                         id: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *                         nomeCompleto: "João Silva"
 *                         email: "joao.silva@example.com"
 *                         role: "ADMIN"
 *                     - id: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *                       tipo: "CURSO_ALTERACAO"
 *                       acao: "CURSO_ATUALIZADO"
 *                       campo: "imagemUrl"
 *                       valorAnterior: "https://old-image.jpg"
 *                       valorNovo: "https://new-image.jpg"
 *                       descricao: "Imagem do curso alterada"
 *                       metadata:
 *                         cursoId: "550e8400-e29b-41d4-a716-446655440000"
 *                         campo: "imagemUrl"
 *                       criadoEm: "2024-01-14T15:20:00Z"
 *                       alteradoPor:
 *                         id: "1c2d3e4f-5a6b-7890-cdef-123456789012"
 *                         nomeCompleto: "Maria Santos"
 *                         email: "maria.santos@example.com"
 *                         role: "MODERADOR"
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 2
 *                     totalPages: 1
 *       400:
 *         description: ID do curso inválido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "INVALID_CURSO_ID"
 *                 message:
 *                   type: string
 *                   example: "ID do curso inválido. Deve ser um UUID válido."
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Curso não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "CURSO_NOT_FOUND"
 *                 message:
 *                   type: string
 *                   example: "Curso não encontrado."
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "CURSO_AUDITORIA_ERROR"
 *                 message:
 *                   type: string
 *                   example: "Erro ao buscar histórico de auditoria do curso"
 */
router.get(
  '/:cursoId/auditoria',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CursosController.getHistoricoAuditoria,
);

router.get('/:cursoId/turmas', optionalSupabaseAuth(), publicCache, TurmasController.list);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}:
 *   get:
 *     summary: Obter detalhes de uma turma específica (Otimizado com contagem de inscrições)
 *     description: |
 *       **✅ OTIMIZAÇÃO DE PERFORMANCE:**
 *
 *       Este endpoint retorna dados completos da turma incluindo automaticamente a contagem de inscrições ativas,
 *       eliminando a necessidade de múltiplas requisições do frontend.
 *
 *       **Campos adicionados:**
 *       - `inscricoesCount`: Número de inscrições ativas (calculado em tempo real)
 *       - `vagasOcupadas`: Vagas ocupadas (igual a inscricoesCount)
 *       - `vagasDisponiveisCalculadas`: Vagas disponíveis calculadas (vagasTotais - inscricoesCount)
 *
 *       **Inscrição ativa:** Status não é CANCELADO/TRANCADO E aluno está ATIVO.
 *
 *       **Performance:** Contagem é calculada usando agregação SQL eficiente, garantindo resposta rápida mesmo com muitas inscrições.
 *
 *       **Tratamento de Erros:** Se o cálculo de inscrições falhar, os campos serão retornados como `null` e o endpoint não falhará.
 *     tags: ['Cursos']
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: UUID do curso
 *         example: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: UUID da turma
 *         example: "80288180-a09c-4a2a-bade-022c7268e395"
 *       - in: query
 *         name: includeAlunos
 *         schema:
 *           type: boolean
 *           default: false
 *         description: |
 *           Quando `true`, inclui a lista completa de alunos da turma no payload.
 *           Para melhor performance, mantenha `false` e use a aba/rota de inscrições dedicada.
 *       - in: query
 *         name: includeEstrutura
 *         schema:
 *           type: boolean
 *           default: true
 *         description: |
 *           Quando `false`, não carrega módulos/aulas/provas/itens da estrutura.
 *           Use para otimizar o carregamento inicial quando a aba Estrutura não estiver ativa.
 *     responses:
 *       200:
 *         description: Dados completos da turma com contagem de inscrições
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurma'
 *             example:
 *               id: "80288180-a09c-4a2a-bade-022c7268e395"
 *               codigo: "GEST-PROJ-T1"
 *               nome: "Turma 1 - Gestão de Projetos Ágeis"
 *               vagasTotais: 30
 *               vagasDisponiveis: 30
 *               inscricoesCount: 3
 *               vagasOcupadas: 3
 *               vagasDisponiveisCalculadas: 27
 *               status: "INSCRICOES_ABERTAS"
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Turma ou curso não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: "TURMA_NOT_FOUND"
 *               message: "Turma não encontrada para o curso informado"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:cursoId/turmas/:turmaId', optionalSupabaseAuth(), publicCache, TurmasController.get);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes:
 *   get:
 *     summary: Listar inscrições de uma turma
 *     description: |
 *       Retorna a lista completa de inscrições de uma turma específica, incluindo dados dos alunos.
 *
 *       **✅ OTIMIZAÇÃO:**
 *       - Este endpoint retorna dados completos das inscrições com informações dos alunos
 *       - Inclui dados de contato, endereço e informações adicionais dos alunos
 *       - Ordenado por data de criação (mais recentes primeiro)
 *     tags: ['Cursos']
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: UUID do curso
 *         example: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: UUID da turma
 *         example: "80288180-a09c-4a2a-bade-022c7268e395"
 *     responses:
 *       200:
 *         description: Lista de inscrições da turma
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "f8a6c3b5-1234-4d9c-9a1b-abcdef123456"
 *                       alunoId:
 *                         type: string
 *                         format: uuid
 *                       turmaId:
 *                         type: string
 *                         format: uuid
 *                       status:
 *                         type: string
 *                         enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *                         description: |
 *                           Status da inscrição:
 *                           - **INSCRITO**: Aluno inscrito (status inicial padrão)
 *                           - **EM_ANDAMENTO**: Curso em andamento
 *                           - **CONCLUIDO**: Curso concluído com sucesso
 *                           - **REPROVADO**: Aluno reprovado
 *                           - **EM_ESTAGIO**: Aluno em estágio obrigatório
 *                           - **CANCELADO**: Inscrição cancelada
 *                           - **TRANCADO**: Inscrição trancada
 *                         example: "INSCRITO"
 *                       criadoEm:
 *                         type: string
 *                         format: date-time
 *                       aluno:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nome:
 *                             type: string
 *                           email:
 *                             type: string
 *                           inscricao:
 *                             type: string
 *                             nullable: true
 *                           telefone:
 *                             type: string
 *                             nullable: true
 *                           endereco:
 *                             type: object
 *                             nullable: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *             example:
 *               success: true
 *               data:
 *                 - id: "f8a6c3b5-1234-4d9c-9a1b-abcdef123456"
 *                   alunoId: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *                   turmaId: "80288180-a09c-4a2a-bade-022c7268e395"
 *                   status: "INSCRITO"
 *                   criadoEm: "2024-01-01T00:00:00Z"
 *                   atualizadoEm: "2024-01-01T00:00:00Z"
 *                   aluno:
 *                     id: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *                     nome: "João da Silva"
 *                     email: "joao.silva@example.com"
 *                     inscricao: "MAT0001"
 *                     telefone: "11988881111"
 *                     endereco:
 *                       cidade: "São Paulo"
 *                       estado: "SP"
 *               count: 3
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Turma ou curso não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:cursoId/turmas/:turmaId/inscricoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  TurmasController.listInscricoes,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas:
 *   post:
 *     summary: Criar uma nova turma para o curso
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  TurmasController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}:
 *   put:
 *     summary: Atualizar informações de uma turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  TurmasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes:
 *   post:
 *     summary: Inscrever um aluno em uma turma
 *     description: >-
 *       Inscreve um aluno em uma turma específica de um curso.
 *
 *       **AUTORIZAÇÕES ESPECIAIS (ADMIN/MODERADOR):**
 *       - ✅ Podem inscrever alunos mesmo **após o término** do período de inscrição
 *       - ✅ Podem inscrever alunos mesmo em turmas **sem vagas disponíveis**
 *       - ✅ Logs automáticos de todas as ações privilegiadas
 *
 *       **VALIDAÇÕES AUTOMÁTICAS:**
 *       - Verifica se curso existe
 *       - Verifica se turma pertence ao curso
 *       - Verifica se aluno existe e é do tipo ALUNO_CANDIDATO
 *       - Verifica se aluno já está inscrito na turma
 *       - Verifica período de inscrição (restringido para usuários sem privilégio)
 *       - Verifica vagas disponíveis (restringido para usuários sem privilégio)
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: ID numérico do curso
 *         example: 4
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID da turma (UUID)
 *         example: "8438a571-d7ca-4cf7-92d3-3cecf272c9a0"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alunoId]
 *             properties:
 *               alunoId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do aluno a ser inscrito
 *                 example: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *           examples:
 *             exemplo:
 *               summary: Inscrição simples
 *               value:
 *                 alunoId: "0b89ee94-f3ab-4682-999b-36574f81751a"
 *     responses:
 *       201:
 *         description: Inscrição registrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurma'
 *       400:
 *         description: Dados inválidos para inscrição
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "VALIDATION_ERROR"
 *                 message:
 *                   type: string
 *                   example: "Dados inválidos para inscrição na turma"
 *       404:
 *         description: Curso, turma ou aluno não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "TURMA_NOT_FOUND"
 *                 message:
 *                   type: string
 *                   example: "Turma não encontrada para o curso informado"
 *       409:
 *         description: Conflitos de inscrição ou período de inscrição encerrado para perfis sem privilégio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "ALUNO_JA_INSCRITO"
 *                 message:
 *                   type: string
 *                   example: "Aluno já está inscrito nesta turma"
 */
router.post(
  '/:cursoId/turmas/:turmaId/inscricoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  TurmasController.enroll,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes/{alunoId}:
 *   delete:
 *     summary: Remover inscrição de um aluno na turma
 *     tags: ['Cursos']
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
 *         description: Inscrição removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoTurma'
 *       404:
 *         description: Turma ou aluno não encontrado
 */
/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes/{inscricaoId}:
 *   patch:
 *     summary: Atualizar status de uma inscrição
 *     description: |
 *       Atualiza o status de uma inscrição específica em uma turma.
 *
 *       **Status disponíveis:**
 *       - `INSCRITO`: Aluno inscrito (status inicial)
 *       - `EM_ANDAMENTO`: Curso em andamento
 *       - `CONCLUIDO`: Curso concluído com sucesso
 *       - `REPROVADO`: Aluno reprovado
 *       - `EM_ESTAGIO`: Aluno em estágio obrigatório
 *       - `CANCELADO`: Inscrição cancelada
 *       - `TRANCADO`: Inscrição trancada
 *
 *       **Permissões:** ADMIN, MODERADOR, PEDAGOGICO, INSTRUTOR
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: ID numérico do curso
 *         example: 4
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: UUID da turma
 *         example: "80288180-a09c-4a2a-bade-022c7268e395"
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: UUID da inscrição
 *         example: "ed7b4507-8965-4c82-8872-48845c861854"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *                 description: Novo status da inscrição
 *                 example: "EM_ANDAMENTO"
 *           examples:
 *             emAndamento:
 *               summary: Marcar como em andamento
 *               value:
 *                 status: "EM_ANDAMENTO"
 *             concluido:
 *               summary: Marcar como concluído
 *               value:
 *                 status: "CONCLUIDO"
 *             cancelado:
 *               summary: Cancelar inscrição
 *               value:
 *                 status: "CANCELADO"
 *     responses:
 *       200:
 *         description: Status da inscrição atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     alunoId:
 *                       type: string
 *                       format: uuid
 *                     turmaId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *                       example: "EM_ANDAMENTO"
 *                     criadoEm:
 *                       type: string
 *                       format: date-time
 *                     aluno:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         nome:
 *                           type: string
 *                         email:
 *                           type: string
 *       400:
 *         description: Dados inválidos ou status inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Inscrição não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:cursoId/turmas/:turmaId/inscricoes/:inscricaoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  TurmasController.updateInscricaoStatus,
);

router.delete(
  '/:cursoId/turmas/:turmaId/inscricoes/:alunoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  TurmasController.unenroll,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/publicar:
 *   patch:
 *     summary: Publicar ou despublicar turma
 *     description: >-
 *       Controla a visibilidade da turma no site para os alunos.
 *
 *       **SOBRE STATUS DE PUBLICAÇÃO:**
 *       - `publicar: true` → Status muda para **PUBLICADO** (turma visível no site para todos)
 *       - `publicar: false` → Status muda para **RASCUNHO** (turma visível apenas para admin/moderador/pedagógico)
 *
 *       **IMPORTANTE:**
 *       - Este controle é **independente** das datas de início/fim da turma
 *       - Este controle é **independente** das datas de inscrição
 *       - Uma turma em RASCUNHO NÃO aparece no site para alunos, mesmo que as datas estejam vigentes
 *       - Uma turma PUBLICADA aparece no site, respeitando as demais regras de inscrição e datas
 *
 *       **VALIDAÇÕES:**
 *       - Para publicar, a turma deve ter **pelo menos 1 aula** e **1 avaliação** cadastradas
 *       - Se já estiver no status desejado, não faz nada (operação idempotente)
 *
 *       **PERMISSÕES:**
 *       - Apenas ADMIN, MODERADOR e PEDAGÓGICO podem publicar/despublicar turmas
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID do curso (UUID)
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID da turma (UUID)
 *         example: "8438a571-d7ca-4cf7-92d3-3cecf272c9a0"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicar
 *             properties:
 *               publicar:
 *                 type: boolean
 *                 description: true para publicar, false para despublicar (colocar em rascunho)
 *                 example: true
 *     responses:
 *       200:
 *         description: Turma publicada/despublicada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Turma publicada com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/CursoTurmaDetailed'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Turma ou curso não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Pré-requisitos não atendidos (ex. sem aulas ou avaliações cadastradas)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:cursoId/turmas/:turmaId/publicar',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  TurmasController.togglePublicacao,
);

router.delete(
  '/:cursoId/turmas/:turmaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  TurmasController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas:
 *   get:
 *     summary: Listar aulas de uma turma
 *     tags: ['Cursos']
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
router.get(
  '/:cursoId/turmas/:turmaId/aulas',
  optionalSupabaseAuth(),
  publicCache,
  AulasController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas/{aulaId}:
 *   get:
 *     summary: Obter detalhes de uma aula específica
 *     tags: ['Cursos']
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
router.get(
  '/:cursoId/turmas/:turmaId/aulas/:aulaId',
  optionalSupabaseAuth(),
  publicCache,
  AulasController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas:
 *   post:
 *     summary: Criar uma nova aula para a turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AulasController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas/{aulaId}:
 *   put:
 *     summary: Atualizar informações de uma aula
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AulasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/aulas/{aulaId}:
 *   delete:
 *     summary: Remover uma aula da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AulasController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos:
 *   get:
 *     summary: Listar módulos da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ModulosController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos/{moduloId}:
 *   get:
 *     summary: Detalhar módulo da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ModulosController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos:
 *   post:
 *     summary: Criar módulo na turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ModulosController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos/{moduloId}:
 *   put:
 *     summary: Atualizar módulo da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ModulosController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/modulos/{moduloId}:
 *   delete:
 *     summary: Remover módulo da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ModulosController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas:
 *   get:
 *     summary: Listar provas da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ProvasController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}:
 *   get:
 *     summary: Detalhar prova da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ProvasController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas:
 *   post:
 *     summary: Criar prova para a turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ProvasController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}:
 *   put:
 *     summary: Atualizar prova da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ProvasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}:
 *   delete:
 *     summary: Remover prova da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  ProvasController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias:
 *   get:
 *     summary: Listar registros de frequência da turma
 *     tags: ['Cursos']
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
 *         name: inscricaoId
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: Filtra registros de frequência de uma inscrição específica
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias:
 *   post:
 *     summary: Registrar frequência para a turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.create,
);

/**
 * Upsert de lançamento de frequência pela modal (cria ou atualiza por chave natural)
 * POST /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/lancamentos
 */
router.post(
  '/:cursoId/turmas/:turmaId/frequencias/lancamentos',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.upsertLancamento,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias/resumo:
 *   get:
 *     summary: Resumo de frequência por aluno da turma
 *     description: |
 *       Retorna resumo agregado de frequência por aluno.
 *       Permite filtrar por período (TOTAL, DIA, SEMANA, MES) e data âncora.
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: periodo
 *         schema: { type: string, enum: [TOTAL, DIA, SEMANA, MES] }
 *         description: Período para filtrar frequências
 *       - in: query
 *         name: anchorDate
 *         schema: { type: string, format: date }
 *         description: Data âncora para o período (YYYY-MM-DD)
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Busca por nome ou email do aluno
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: Resumo de frequência por aluno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalAulasNoPeriodo: { type: integer }
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           alunoId: { type: string }
 *                           alunoNome: { type: string }
 *                           alunoCodigo: { type: string }
 *                           totalAulas: { type: integer }
 *                           presencas: { type: integer }
 *                           ausencias: { type: integer }
 *                           atrasados: { type: integer }
 *                           justificadas: { type: integer }
 *                           taxaPresencaPct: { type: integer }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         pageSize: { type: integer }
 *                         total: { type: integer }
 *                         totalPages: { type: integer }
 */
router.get(
  '/:cursoId/turmas/:turmaId/frequencias/resumo',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.resumo,
);

/**
 * Histórico de frequência por chave natural (fallback para itens não persistidos no front)
 * GET /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/historico?inscricaoId=...&tipoOrigem=...&origemId=...
 */
router.get(
  '/:cursoId/turmas/:turmaId/frequencias/historico',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.listHistoricoByNaturalKey,
);

/**
 * Histórico de frequência por ID persistido
 * GET /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/:frequenciaId/historico
 */
router.get(
  '/:cursoId/turmas/:turmaId/frequencias/:frequenciaId/historico',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.listHistorico,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias/{frequenciaId}:
 *   get:
 *     summary: Detalhar registro de frequência
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias/{frequenciaId}:
 *   put:
 *     summary: Atualizar registro de frequência
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/frequencias/{frequenciaId}:
 *   delete:
 *     summary: Remover registro de frequência
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.delete,
);

/**
 * Listagem consolidada de notas (curso + múltiplas turmas)
 * GET /api/v1/cursos/:cursoId/notas?turmaIds=uuid,uuid
 */
router.get(
  '/:cursoId/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.listCurso,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas:
 *   get:
 *     summary: Listar notas lançadas da turma
 *     tags: ['Cursos']
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
 *         name: inscricaoId
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: Filtra notas lançadas para uma inscrição específica
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas:
 *   post:
 *     summary: Registrar nota manualmente para a turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.create,
);

/**
 * Limpar lançamentos manuais (nota extra) por aluno na turma
 * DELETE /api/v1/cursos/:cursoId/turmas/:turmaId/notas?alunoId=uuid
 */
router.delete(
  '/:cursoId/turmas/:turmaId/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.clearManuais,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas/{notaId}:
 *   get:
 *     summary: Detalhar nota lançada
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas/{notaId}:
 *   put:
 *     summary: Atualizar nota lançada
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/notas/{notaId}:
 *   delete:
 *     summary: Remover nota lançada
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/agenda:
 *   get:
 *     summary: Listar eventos de agenda da turma
 *     tags: ['Cursos']
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
 *         name: tipo
 *         schema: { $ref: '#/components/schemas/CursosAgendaTipo' }
 *       - in: query
 *         name: dataInicio
 *         schema: { type: string, format: date-time }
 *         description: Filtra eventos com início igual ou posterior à data informada
 *       - in: query
 *         name: dataFim
 *         schema: { type: string, format: date-time }
 *         description: Limita eventos com início até a data informada
 *       - in: query
 *         name: apenasFuturos
 *         schema: { type: boolean }
 *         description: Retorna apenas eventos com início futuro em relação à consulta
 *     responses:
 *       200:
 *         description: Lista de eventos da turma
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoAgendaEvento'
 */
router.get(
  '/:cursoId/turmas/:turmaId/agenda',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AgendaController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/agenda/{agendaId}:
 *   get:
 *     summary: Obter evento específico da agenda da turma
 *     tags: ['Cursos']
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
 *         name: agendaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Evento de agenda
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoAgendaEvento'
 */
router.get(
  '/:cursoId/turmas/:turmaId/agenda/:agendaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AgendaController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/agenda:
 *   post:
 *     summary: Criar evento na agenda da turma
 *     tags: ['Cursos']
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
 *             $ref: '#/components/schemas/CursoAgendaCreateInput'
 *     responses:
 *       201:
 *         description: Evento criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoAgendaEvento'
 */
router.post(
  '/:cursoId/turmas/:turmaId/agenda',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AgendaController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/agenda/{agendaId}:
 *   put:
 *     summary: Atualizar evento da agenda da turma
 *     tags: ['Cursos']
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
 *         name: agendaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoAgendaUpdateInput'
 *     responses:
 *       200:
 *         description: Evento atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoAgendaEvento'
 */
router.put(
  '/:cursoId/turmas/:turmaId/agenda/:agendaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AgendaController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/agenda/{agendaId}:
 *   delete:
 *     summary: Remover evento da agenda da turma
 *     tags: ['Cursos']
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
 *         name: agendaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Evento removido com sucesso
 */
router.delete(
  '/:cursoId/turmas/:turmaId/agenda/:agendaId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AgendaController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/me/agenda:
 *   get:
 *     summary: Consultar eventos das turmas em que o aluno está inscrito
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema: { $ref: '#/components/schemas/CursosAgendaTipo' }
 *       - in: query
 *         name: dataInicio
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dataFim
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: apenasFuturos
 *         schema: { type: boolean }
 *       - in: query
 *         name: turmaId
 *         schema: { type: string, format: uuid }
 *         description: Filtra eventos para uma turma específica do aluno
 *     responses:
 *       200:
 *         description: Eventos das turmas do aluno autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoAgendaEventoAluno'
 */
router.get('/me/agenda', supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]), AgendaController.listMy);

/**
 * @openapi
 * /api/v1/cursos/inscricoes/{inscricaoId}/frequencias-detalhadas:
 *   get:
 *     summary: Consultar registros de frequência de uma inscrição (admin)
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Frequência lançada e informações da inscrição
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoFrequenciaResumoInscricao'
 */
router.get(
  '/inscricoes/:inscricaoId/frequencias-detalhadas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  FrequenciaController.listByInscricao,
);

/**
 * @openapi
 * /api/v1/cursos/me/inscricoes/{inscricaoId}/frequencias-detalhadas:
 *   get:
 *     summary: Consultar registros de frequência do aluno autenticado
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Frequência lançada associada à inscrição do aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoFrequenciaResumoInscricao'
 */
router.get(
  '/me/inscricoes/:inscricaoId/frequencias-detalhadas',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  FrequenciaController.listMy,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/notas:
 *   put:
 *     summary: Registrar ou atualizar nota de prova
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  ProvasController.registrarNota,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/questoes:
 *   get:
 *     summary: Listar questões da prova
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *         description: Lista de questões da prova
 */
router.get(
  '/:cursoId/turmas/:turmaId/provas/:provaId/questoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  QuestoesController.list,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/questoes/{questaoId}:
 *   get:
 *     summary: Detalhar questão da prova
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: questaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados da questão
 */
router.get(
  '/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  QuestoesController.get,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/questoes:
 *   post:
 *     summary: Criar questão para a prova
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *             type: object
 *             properties:
 *               enunciado:
 *                 type: string
 *               tipo:
 *                 type: string
 *                 enum: [TEXTO, MULTIPLA_ESCOLHA, ANEXO]
 *               alternativas:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Questão criada
 */
router.post(
  '/:cursoId/turmas/:turmaId/provas/:provaId/questoes',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  QuestoesController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/questoes/{questaoId}:
 *   put:
 *     summary: Atualizar questão da prova
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: questaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Questão atualizada
 */
router.put(
  '/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  QuestoesController.update,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/questoes/{questaoId}:
 *   delete:
 *     summary: Remover questão da prova
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: questaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Questão removida
 */
router.delete(
  '/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  QuestoesController.delete,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/questoes/{questaoId}/responder:
 *   put:
 *     summary: Responder questão da prova
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: questaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resposta registrada
 */
router.put(
  '/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId/responder',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  QuestoesController.responder,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/questoes/{questaoId}/corrigir:
 *   put:
 *     summary: Corrigir resposta de questão
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: questaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resposta corrigida
 */
router.put(
  '/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId/corrigir',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  cursosAvaliacoesInvalidateCacheOnMutation,
  QuestoesController.corrigir,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}/respostas:
 *   get:
 *     summary: Listar respostas da prova
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: provaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: questaoId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: inscricaoId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de respostas
 */
router.get(
  '/:cursoId/turmas/:turmaId/provas/:provaId/respostas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  QuestoesController.listarRespostas,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/regras-avaliacao:
 *   get:
 *     summary: Obter regras de avaliação da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AvaliacaoController.getRules,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/regras-avaliacao:
 *   put:
 *     summary: Atualizar regras de avaliação da turma
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AvaliacaoController.updateRules,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/recuperacoes:
 *   post:
 *     summary: Registrar tentativa de recuperação
 *     tags: ['Cursos']
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  AvaliacaoController.registrarRecuperacao,
);

/**
 * @openapi
 * /api/v1/cursos/inscricoes/{inscricaoId}/notas-detalhadas:
 *   get:
 *     summary: Consultar notas lançadas de uma inscrição (admin)
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notas lançadas e informações da inscrição
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoNotaResumoInscricao'
 */
router.get(
  '/inscricoes/:inscricaoId/notas-detalhadas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  NotasController.listByInscricao,
);

/**
 * @openapi
 * /api/v1/cursos/me/inscricoes/{inscricaoId}/notas-detalhadas:
 *   get:
 *     summary: Consultar notas lançadas do aluno autenticado
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notas lançadas associadas à inscrição do aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoNotaResumoInscricao'
 */
router.get(
  '/me/inscricoes/:inscricaoId/notas-detalhadas',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  NotasController.listMy,
);

/**
 * @openapi
 * /api/v1/cursos/inscricoes/{inscricaoId}/notas:
 *   get:
 *     summary: Consultar notas consolidadas de uma inscrição (admin)
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/inscricoes/:inscricaoId/notas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  AvaliacaoController.getGrades,
);

/**
 * @openapi
 * /api/v1/cursos/me/inscricoes/{inscricaoId}/notas:
 *   get:
 *     summary: Consultar notas consolidadas do aluno autenticado
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/me/inscricoes/:inscricaoId/notas',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  AvaliacaoController.getMyGrades,
);

/**
 * @openapi
 * /api/v1/cursos/certificados:
 *   get:
 *     summary: Listagem global de certificados
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/certificados',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CertificadosController.listarGlobal,
);

/**
 * @openapi
 * /api/v1/cursos/certificados:
 *   post:
 *     summary: Emitir certificado por curso/turma/aluno
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/certificados',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CertificadosController.emitirGlobal,
);

/**
 * @openapi
 * /api/v1/cursos/certificados/modelos:
 *   get:
 *     summary: Listar modelos disponíveis de certificado
 *     tags: ['Cursos']
 */
router.get(
  '/certificados/modelos',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CertificadosController.listarModelos,
);

/**
 * @openapi
 * /api/v1/cursos/certificados/{certificadoId}:
 *   get:
 *     summary: Detalhe de certificado
 *     tags: ['Cursos']
 */
router.get(
  '/certificados/:certificadoId',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  CertificadosController.getById,
);

/**
 * @openapi
 * /api/v1/cursos/certificados/{certificadoId}/preview:
 *   get:
 *     summary: Preview HTML de certificado
 *     tags: ['Cursos']
 */
router.get(
  '/certificados/:certificadoId/preview',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  CertificadosController.previewById,
);

/**
 * @openapi
 * /api/v1/cursos/certificados/{certificadoId}/pdf:
 *   get:
 *     summary: Download PDF de certificado
 *     tags: ['Cursos']
 */
router.get(
  '/certificados/:certificadoId/pdf',
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.PEDAGOGICO,
    Roles.INSTRUTOR,
    Roles.ALUNO_CANDIDATO,
  ]),
  CertificadosController.pdfById,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/certificados:
 *   post:
 *     summary: Emitir certificado para um aluno inscrito na turma
 *     tags: ['Cursos']
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
 *             $ref: '#/components/schemas/CursoCertificadoCreateInput'
 *     responses:
 *       201:
 *         description: Certificado emitido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoCertificado'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Turma ou inscrição não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:cursoId/turmas/:turmaId/certificados',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CertificadosController.emitir,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes/{inscricaoId}/estagios:
 *   post:
 *     summary: Criar estágio supervisionado para a inscrição
 *     tags: ['Cursos']
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
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoEstagioCreateInput'
 *     responses:
 *       201:
 *         description: Estágio criado com sucesso e notificação enviada ao aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoEstagio'
 *       400:
 *         description: Dados inválidos para criação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Curso, turma ou inscrição não localizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:cursoId/turmas/:turmaId/inscricoes/:inscricaoId/estagios',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  EstagiosController.create,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes/{inscricaoId}/estagios:
 *   get:
 *     summary: Listar estágios cadastrados para a inscrição
 *     tags: ['Cursos']
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
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de estágios vinculados à inscrição
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoEstagio'
 *       404:
 *         description: Curso, turma ou inscrição não localizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:cursoId/turmas/:turmaId/inscricoes/:inscricaoId/estagios',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.listByInscricao,
);

/**
 * @openapi
 * /api/v1/cursos/{cursoId}/turmas/{turmaId}/certificados:
 *   get:
 *     summary: Listar certificados emitidos para uma turma
 *     tags: ['Cursos']
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
 *         name: inscricaoId
 *         schema: { type: string, format: uuid }
 *         description: Filtra certificados de uma inscrição específica
 *       - in: query
 *         name: tipo
 *         schema: { $ref: '#/components/schemas/CursosCertificados' }
 *       - in: query
 *         name: formato
 *         schema: { $ref: '#/components/schemas/CursosCertificadosTipos' }
 *     responses:
 *       200:
 *         description: Lista de certificados emitidos para a turma
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoCertificado'
 */
router.get(
  '/:cursoId/turmas/:turmaId/certificados',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CertificadosController.listar,
);

/**
 * @openapi
 * /api/v1/cursos/inscricoes/{inscricaoId}/certificados:
 *   get:
 *     summary: Consultar certificados emitidos de uma inscrição (admin)
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Certificados emitidos para a inscrição informada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoCertificadoResumoInscricao'
 */
router.get(
  '/inscricoes/:inscricaoId/certificados',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  CertificadosController.listarPorInscricao,
);

/**
 * @openapi
 * /api/v1/cursos/me/inscricoes/{inscricaoId}/estagios:
 *   get:
 *     summary: Listar estágios do aluno autenticado para a inscrição
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Estágios vinculados à inscrição do aluno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoEstagio'
 *       403:
 *         description: Inscrição não pertence ao aluno autenticado
 */
router.get(
  '/me/inscricoes/:inscricaoId/estagios',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  EstagiosController.listMe,
);

/**
 * @openapi
 * /api/v1/cursos/me/inscricoes/{inscricaoId}/certificados:
 *   get:
 *     summary: Consultar certificados emitidos do aluno autenticado para uma inscrição
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inscricaoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Certificados emitidos associados à inscrição do aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoCertificadoResumoInscricao'
 */
router.get(
  '/me/inscricoes/:inscricaoId/certificados',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CertificadosController.listarMePorInscricao,
);

/**
 * @openapi
 * /api/v1/cursos/me/certificados:
 *   get:
 *     summary: Listar certificados do aluno autenticado
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Certificados emitidos para o aluno autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CursoCertificado'
 */
router.get(
  '/me/certificados',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CertificadosController.listarMe,
);

/**
 * @openapi
 * /api/v1/cursos/certificados/codigo/{codigo}:
 *   get:
 *     summary: Verificar autenticidade de um certificado via código
 *     tags: ['Cursos']
 *     parameters:
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema: { type: string }
 *         description: Código alfanumérico impresso no certificado
 *     responses:
 *       200:
 *         description: Certificado válido encontrado para o código informado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoCertificado'
 *       404:
 *         description: Certificado não encontrado para o código informado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/certificados/codigo/:codigo', CertificadosController.verificarPorCodigo);

export { router as cursosRoutes };
