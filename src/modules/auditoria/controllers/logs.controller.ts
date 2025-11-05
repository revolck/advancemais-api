/**
 * Controller para logs de auditoria
 * @module auditoria/controllers/logs
 */

import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { logsService } from '../services/logs.service';
import { auditoriaFiltersSchema } from '../validators/auditoria.validators';

const logsControllerLogger = logger.child({ module: 'LogsController' });

export const logsController = {
  /**
   * @openapi
   * /api/v1/auditoria/logs:
   *   get:
   *     summary: Lista logs de auditoria
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: categoria
   *         schema:
   *           type: string
   *           enum: [SISTEMA, USUARIO, EMPRESA, VAGA, CURSO, PAGAMENTO, SCRIPT, SEGURANCA]
   *         description: Categoria do log
   *       - in: query
   *         name: tipo
   *         schema:
   *           type: string
   *         description: Tipo do log
   *       - in: query
   *         name: usuarioId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *       - in: query
   *         name: entidadeId
   *         schema:
   *           type: string
   *         description: ID da entidade
   *       - in: query
   *         name: entidadeTipo
   *         schema:
   *           type: string
   *         description: Tipo da entidade
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
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Termo de busca
   *     responses:
   *       200:
   *         description: Lista de logs
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
   *       400:
   *         description: Dados inválidos
   *       401:
   *         description: Não autenticado
   *       403:
   *         description: Acesso negado
   *       500:
   *         description: Erro interno do servidor
   */
  list: async (req: Request, res: Response) => {
    try {
      const filters = auditoriaFiltersSchema.parse(req.query);
      const result = await logsService.listarLogs(filters);

      logsControllerLogger.info({ filters, total: result.total }, 'Logs listados com sucesso');

      res.json(result);
    } catch (error: any) {
      logsControllerLogger.error({ err: error }, 'Erro ao listar logs');
      res.status(400).json({
        success: false,
        message: 'Erro ao listar logs',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/logs/{id}:
   *   get:
   *     summary: Obtém um log específico
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do log
   *     responses:
   *       200:
   *         description: Log encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaLogResponse'
   *       404:
   *         description: Log não encontrado
   *       500:
   *         description: Erro interno do servidor
   */
  get: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const log = await logsService.obterLogPorId(id);

      if (!log) {
        return res.status(404).json({
          success: false,
          message: 'Log não encontrado',
        });
      }

      logsControllerLogger.info({ logId: id }, 'Log obtido com sucesso');
      res.json(log);
    } catch (error: any) {
      logsControllerLogger.error({ err: error, id: req.params.id }, 'Erro ao obter log');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter log',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/logs/usuario/{usuarioId}:
   *   get:
   *     summary: Obtém logs de um usuário específico
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
   *         description: Logs do usuário
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
  getByUsuario: async (req: Request, res: Response) => {
    try {
      const { usuarioId } = req.params;
      const { page = 1, pageSize = 20 } = req.query;

      const result = await logsService.obterLogsPorUsuario(
        usuarioId,
        Number(page),
        Number(pageSize),
      );

      logsControllerLogger.info(
        { usuarioId, total: result.total },
        'Logs do usuário obtidos com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      logsControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter logs do usuário',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs do usuário',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/logs/entidade/{entidadeId}:
   *   get:
   *     summary: Obtém logs de uma entidade específica
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: entidadeId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da entidade
   *       - in: query
   *         name: entidadeTipo
   *         schema:
   *           type: string
   *         description: Tipo da entidade
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
   *         description: Logs da entidade
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
  getByEntidade: async (req: Request, res: Response) => {
    try {
      const { entidadeId } = req.params;
      const { entidadeTipo, page = 1, pageSize = 20 } = req.query;

      const result = await logsService.obterLogsPorEntidade(
        entidadeId,
        entidadeTipo as string,
        Number(page),
        Number(pageSize),
      );

      logsControllerLogger.info(
        { entidadeId, entidadeTipo, total: result.total },
        'Logs da entidade obtidos com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      logsControllerLogger.error(
        { err: error, entidadeId: req.params.entidadeId },
        'Erro ao obter logs da entidade',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs da entidade',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/logs/erro:
   *   get:
   *     summary: Obtém logs de erro do sistema
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
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
   *         description: Logs de erro
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
  getErros: async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, page = 1, pageSize = 20 } = req.query;

      const result = await logsService.obterLogsErro(
        startDate as string,
        endDate as string,
        Number(page),
        Number(pageSize),
      );

      logsControllerLogger.info({ total: result.total }, 'Logs de erro obtidos com sucesso');

      res.json(result);
    } catch (error: any) {
      logsControllerLogger.error({ err: error }, 'Erro ao obter logs de erro');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs de erro',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/logs/acesso:
   *   get:
   *     summary: Obtém logs de acesso
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: usuarioId
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
   *         description: Logs de acesso
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
      const { usuarioId, startDate, endDate, page = 1, pageSize = 20 } = req.query;

      const result = await logsService.obterLogsAcesso(
        usuarioId as string,
        startDate as string,
        endDate as string,
        Number(page),
        Number(pageSize),
      );

      logsControllerLogger.info(
        { usuarioId, total: result.total },
        'Logs de acesso obtidos com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      logsControllerLogger.error({ err: error }, 'Erro ao obter logs de acesso');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs de acesso',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/logs/alteracao:
   *   get:
   *     summary: Obtém logs de alteração de dados
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: entidadeTipo
   *         schema:
   *           type: string
   *         description: Tipo da entidade
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
   *         description: Logs de alteração
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
  getAlteracoes: async (req: Request, res: Response) => {
    try {
      const { entidadeTipo, startDate, endDate, page = 1, pageSize = 20 } = req.query;

      const result = await logsService.obterLogsAlteracao(
        entidadeTipo as string,
        startDate as string,
        endDate as string,
        Number(page),
        Number(pageSize),
      );

      logsControllerLogger.info(
        { entidadeTipo, total: result.total },
        'Logs de alteração obtidos com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      logsControllerLogger.error({ err: error }, 'Erro ao obter logs de alteração');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs de alteração',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/logs/estatisticas:
   *   get:
   *     summary: Obtém estatísticas de logs
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
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
   *         name: categoria
   *         schema:
   *           type: string
   *           enum: [SISTEMA, USUARIO, EMPRESA, VAGA, CURSO, PAGAMENTO, SCRIPT, SEGURANCA]
   *         description: Categoria do log
   *       - in: query
   *         name: usuarioId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário
   *     responses:
   *       200:
   *         description: Estatísticas de logs
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaStats'
   *       500:
   *         description: Erro interno do servidor
   */
  getEstatisticas: async (req: Request, res: Response) => {
    try {
      const filters = req.query;
      const result = await logsService.obterEstatisticas(filters);

      logsControllerLogger.info({ filters }, 'Estatísticas de logs obtidas com sucesso');

      res.json(result);
    } catch (error: any) {
      logsControllerLogger.error({ err: error }, 'Erro ao obter estatísticas de logs');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter estatísticas de logs',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/logs/exportar:
   *   get:
   *     summary: Exporta logs para CSV
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: categoria
   *         schema:
   *           type: string
   *           enum: [SISTEMA, USUARIO, EMPRESA, VAGA, CURSO, PAGAMENTO, SCRIPT, SEGURANCA]
   *         description: Categoria do log
   *       - in: query
   *         name: tipo
   *         schema:
   *           type: string
   *         description: Tipo do log
   *       - in: query
   *         name: usuarioId
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
   *     responses:
   *       200:
   *         description: Arquivo CSV com logs
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   *       500:
   *         description: Erro interno do servidor
   */
  exportar: async (req: Request, res: Response) => {
    try {
      const filters = auditoriaFiltersSchema.parse(req.query);
      const csvContent = await logsService.exportarLogs(filters);

      const filename = `logs_auditoria_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);

      logsControllerLogger.info({ filters, filename }, 'Logs exportados com sucesso');
    } catch (error: any) {
      logsControllerLogger.error({ err: error }, 'Erro ao exportar logs');
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar logs',
        error: error.message,
      });
    }
  },
};
