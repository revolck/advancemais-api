import { Router } from 'express';
import { Roles } from '@prisma/client';

import { publicCache } from '@/middlewares/cache-control';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';

import { CursosController } from '../controllers/cursos.controller';
import { CategoriasController } from '../controllers/categorias.controller';
import { AulasController } from '../controllers/aulas.controller';
import { TurmasController } from '../controllers/turmas.controller';
import { ModulosController } from '../controllers/modulos.controller';
import { ProvasController } from '../controllers/provas.controller';
import { AvaliacaoController } from '../controllers/avaliacao.controller';
import { NotasController } from '../controllers/notas.controller';
import { FrequenciaController } from '../controllers/frequencia.controller';
import { AgendaController } from '../controllers/agenda.controller';
import { CertificadosController } from '../controllers/certificados.controller';
import { EstagiosController } from '../controllers/estagios.controller';

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
  CursosController.getAlunoById,
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
router.get('/:cursoId', publicCache, CursosController.get);

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
router.get('/:cursoId/turmas', publicCache, TurmasController.list);

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
 *         schema: { type: integer, minimum: 1 }
 *         description: ID numérico do curso
 *         example: 4
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: UUID da turma
 *         example: "80288180-a09c-4a2a-bade-022c7268e395"
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
router.get('/:cursoId/turmas/:turmaId', publicCache, TurmasController.get);

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
 *         schema: { type: integer, minimum: 1 }
 *         description: ID numérico do curso
 *         example: 4
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
router.get('/:cursoId/turmas/:turmaId/inscricoes', TurmasController.listInscricoes);

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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
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
router.get('/:cursoId/turmas/:turmaId/aulas', publicCache, AulasController.list);

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
router.get('/:cursoId/turmas/:turmaId/aulas/:aulaId', publicCache, AulasController.get);

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
  ProvasController.registrarNota,
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
 * /api/v1/cursos/estagios/{estagioId}:
 *   get:
 *     summary: Consultar detalhes de um estágio
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estagioId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos do estágio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoEstagio'
 *       404:
 *         description: Estágio não encontrado
 */
router.get(
  '/estagios/:estagioId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO, Roles.INSTRUTOR]),
  EstagiosController.get,
);

/**
 * @openapi
 * /api/v1/cursos/estagios/{estagioId}:
 *   put:
 *     summary: Atualizar dados cadastrais do estágio
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estagioId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoEstagioUpdateInput'
 *     responses:
 *       200:
 *         description: Estágio atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoEstagio'
 *       404:
 *         description: Estágio não encontrado
 */
router.put(
  '/estagios/:estagioId',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  EstagiosController.update,
);

/**
 * @openapi
 * /api/v1/cursos/estagios/{estagioId}/status:
 *   patch:
 *     summary: Atualizar status de andamento do estágio
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estagioId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoEstagioStatusInput'
 *     responses:
 *       200:
 *         description: Estágio com status atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoEstagio'
 *       404:
 *         description: Estágio não encontrado
 */
router.patch(
  '/estagios/:estagioId/status',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  EstagiosController.updateStatus,
);

/**
 * @openapi
 * /api/v1/cursos/estagios/{estagioId}/reenviar-confirmacao:
 *   post:
 *     summary: Reenviar email de confirmação do estágio ao aluno
 *     tags: ['Cursos']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estagioId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoEstagioReenviarInput'
 *     responses:
 *       200:
 *         description: Estágio retornado após reenvio do email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoEstagio'
 */
router.post(
  '/estagios/:estagioId/reenviar-confirmacao',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]),
  EstagiosController.reenviarConfirmacao,
);

/**
 * @openapi
 * /api/v1/cursos/estagios/confirmacoes/{token}:
 *   post:
 *     summary: Confirmar ciência do estágio pelo aluno
 *     tags: ['Cursos']
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CursoEstagioConfirmacaoInput'
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Estágio atualizado após confirmação do aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursoEstagio'
 *       404:
 *         description: Confirmação inválida ou expirada
 */
router.post('/estagios/confirmacoes/:token', EstagiosController.confirmar);

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
