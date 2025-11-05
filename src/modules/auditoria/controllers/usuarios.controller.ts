/**
 * Controller para histórico de usuários
 * @module auditoria/controllers/usuarios
 */

import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { usuariosService } from '../services/usuarios.service';

const usuariosControllerLogger = logger.child({ module: 'UsuariosController' });

export const usuariosController = {
  /**
   * @openapi
   * /api/v1/auditoria/usuarios/{usuarioId}/historico:
   *   get:
   *     summary: Lista o histórico de auditoria de um usuário específico
   *     tags: [Auditoria - Histórico de Usuários]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: usuarioId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: ID do usuário para o qual o histórico será listado
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Número da página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Tamanho da página (máx. 100)
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de início para filtrar logs (ISO 8601)
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de fim para filtrar logs (ISO 8601)
   *       - in: query
   *         name: acao
   *         schema:
   *           type: string
   *         description: Ação registrada no log
   *       - in: query
   *         name: entidadeTipo
   *         schema:
   *           type: string
   *         description: Tipo da entidade afetada pelo log
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *         description: Role do usuário no momento da ação (para logs de permissão)
   *     responses:
   *       200:
   *         description: Histórico de auditoria do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       tipo:
   *                         type: string
   *                       acao:
   *                         type: string
   *                       descricao:
   *                         type: string
   *                       data:
   *                         type: string
   *                         format: date-time
   *                       fonte:
   *                         type: string
   *                       detalhes:
   *                         type: object
   *                 total:
   *                   type: integer
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  listUserHistory: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const filters = req.query;

      const result = await usuariosService.obterHistoricoUsuario(
        usuarioId,
        Number(filters.page) || 1,
        Number(filters.pageSize) || 20,
      );

      usuariosControllerLogger.info(
        { usuarioId, total: result.total },
        'Histórico do usuário obtido com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      usuariosControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter histórico do usuário',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter histórico do usuário',
        error: error.message,
      });
    }
  },
  /**
   * @openapi
   * /api/v1/auditoria/usuarios/{usuarioId}/historico:
   *   get:
   *     summary: Obtém histórico completo de um usuário
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: usuarioId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Tamanho da página
   *     responses:
   *       200:
   *         description: Histórico do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaLogResponse'
   *                 total:
   *                   type: integer
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       500:
   *         description: Erro interno do servidor
   */
  getHistorico: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const { page = 1, pageSize = 20 } = req.query;

      const result = await usuariosService.obterHistoricoUsuario(
        usuarioId,
        Number(page),
        Number(pageSize),
      );

      usuariosControllerLogger.info(
        { usuarioId, total: result.total },
        'Histórico do usuário obtido com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      usuariosControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter histórico do usuário',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter histórico do usuário',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/usuarios/{usuarioId}/login:
   *   get:
   *     summary: Obtém histórico de login de um usuário
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: usuarioId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de início
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de fim
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Tamanho da página
   *     responses:
   *       200:
   *         description: Histórico de login
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaLogResponse'
   *                 total:
   *                   type: integer
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       500:
   *         description: Erro interno do servidor
   */
  getLogin: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const { startDate, endDate, page = 1, pageSize = 20 } = req.query;

      const result = await usuariosService.obterHistoricoLogin(
        usuarioId,
        startDate as string,
        endDate as string,
        Number(page),
        Number(pageSize),
      );

      usuariosControllerLogger.info(
        { usuarioId, total: result.total },
        'Histórico de login obtido com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      usuariosControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter histórico de login',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter histórico de login',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/usuarios/{usuarioId}/perfil:
   *   get:
   *     summary: Obtém histórico de alterações de perfil
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: usuarioId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de início
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de fim
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Tamanho da página
   *     responses:
   *       200:
   *         description: Histórico de alterações de perfil
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaLogResponse'
   *                 total:
   *                   type: integer
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       500:
   *         description: Erro interno do servidor
   */
  getPerfil: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const { startDate, endDate, page = 1, pageSize = 20 } = req.query;

      const result = await usuariosService.obterHistoricoAlteracoesPerfil(
        usuarioId,
        startDate as string,
        endDate as string,
        Number(page),
        Number(pageSize),
      );

      usuariosControllerLogger.info(
        { usuarioId, total: result.total },
        'Histórico de alterações de perfil obtido com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      usuariosControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter histórico de alterações de perfil',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter histórico de alterações de perfil',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/usuarios/{usuarioId}/acoes:
   *   get:
   *     summary: Obtém histórico de ações de um usuário
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: usuarioId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *       - in: query
   *         name: tipo
   *         schema:
   *           type: string
   *         description: Tipo da ação
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de início
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de fim
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Tamanho da página
   *     responses:
   *       200:
   *         description: Histórico de ações
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaLogResponse'
   *                 total:
   *                   type: integer
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       500:
   *         description: Erro interno do servidor
   */
  getAcoes: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const { tipo, startDate, endDate, page = 1, pageSize = 20 } = req.query;

      const result = await usuariosService.obterHistoricoAcoes(
        usuarioId,
        tipo as string,
        startDate as string,
        endDate as string,
        Number(page),
        Number(pageSize),
      );

      usuariosControllerLogger.info(
        { usuarioId, tipo, total: result.total },
        'Histórico de ações obtido com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      usuariosControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter histórico de ações',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter histórico de ações',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/usuarios/{usuarioId}/acessos:
   *   get:
   *     summary: Obtém histórico de acessos a recursos
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: usuarioId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *       - in: query
   *         name: recurso
   *         schema:
   *           type: string
   *         description: Nome do recurso
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de início
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de fim
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Tamanho da página
   *     responses:
   *       200:
   *         description: Histórico de acessos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaLogResponse'
   *                 total:
   *                   type: integer
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       500:
   *         description: Erro interno do servidor
   */
  getAcessos: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const { recurso, startDate, endDate, page = 1, pageSize = 20 } = req.query;

      const result = await usuariosService.obterHistoricoAcessos(
        usuarioId,
        recurso as string,
        startDate as string,
        endDate as string,
        Number(page),
        Number(pageSize),
      );

      usuariosControllerLogger.info(
        { usuarioId, recurso, total: result.total },
        'Histórico de acessos obtido com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      usuariosControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter histórico de acessos',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter histórico de acessos',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/usuarios/{usuarioId}/estatisticas:
   *   get:
   *     summary: Obtém estatísticas de um usuário
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: usuarioId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *     responses:
   *       200:
   *         description: Estatísticas do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalAcoes:
   *                   type: integer
   *                 acoesPorTipo:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                 acoesPorPeriodo:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       data:
   *                         type: string
   *                       total:
   *                         type: integer
   *                 ultimaAtividade:
   *                   type: object
   *                   properties:
   *                     tipo:
   *                       type: string
   *                     acao:
   *                       type: string
   *                     descricao:
   *                       type: string
   *                     criadoEm:
   *                       type: string
   *                       format: date-time
   *       500:
   *         description: Erro interno do servidor
   */
  getEstatisticas: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const result = await usuariosService.obterEstatisticasUsuario(usuarioId);

      usuariosControllerLogger.info({ usuarioId }, 'Estatísticas do usuário obtidas com sucesso');

      res.json(result);
    } catch (error: any) {
      usuariosControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter estatísticas do usuário',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter estatísticas do usuário',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/usuarios/{usuarioId}/resumo:
   *   get:
   *     summary: Obtém resumo de atividade de um usuário
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: usuarioId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *     responses:
   *       200:
   *         description: Resumo de atividade
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 acoesHoje:
   *                   type: integer
   *                 acoesOntem:
   *                   type: integer
   *                 acoesSemana:
   *                   type: integer
   *                 acoesMes:
   *                   type: integer
   *                 tendencia:
   *                   type: string
   *                   enum: [crescendo, diminuindo, estavel]
   *       500:
   *         description: Erro interno do servidor
   */
  getResumo: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const result = await usuariosService.obterResumoAtividade(usuarioId);

      usuariosControllerLogger.info({ usuarioId }, 'Resumo de atividade obtido com sucesso');

      res.json(result);
    } catch (error: any) {
      usuariosControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter resumo de atividade',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter resumo de atividade',
        error: error.message,
      });
    }
  },
};
