/**
 * Controller para assinaturas de auditoria
 * @module auditoria/controllers/assinaturas
 */

import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { assinaturasService } from '../services/assinaturas.service';

const assinaturasControllerLogger = logger.child({ module: 'AssinaturasController' });

export const assinaturasController = {
  /**
   * @openapi
   * /api/v1/auditoria/assinaturas:
   *   get:
   *     summary: Lista auditoria de assinaturas
   *     tags: [Auditoria - Assinaturas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
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
   *         description: Data de início para filtrar (ISO 8601)
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Data de fim para filtrar (ISO 8601)
   *       - in: query
   *         name: usuarioId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário relacionado
   *       - in: query
   *         name: empresasPlanoId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do plano empresarial relacionado
   *       - in: query
   *         name: tipo
   *         schema:
   *           type: string
   *         description: Tipo de log/transação
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Status da transação
   *     responses:
   *       200:
   *         description: Lista de itens de auditoria de assinaturas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
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
  list: async (req: Request, res: Response) => {
    try {
      const filters = req.query;
      const result = await assinaturasService.obterLogsAssinaturas(filters);

      assinaturasControllerLogger.info(
        { filters, total: result.total },
        'Auditoria de assinaturas obtida com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      assinaturasControllerLogger.error({ err: error }, 'Erro ao obter auditoria de assinaturas');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter auditoria de assinaturas',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/assinaturas/{id}:
   *   get:
   *     summary: Obtém um item de auditoria de assinatura por ID
   *     tags: [Auditoria - Assinaturas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: ID do item de auditoria de assinatura
   *     responses:
   *       200:
   *         description: Detalhes do item de auditoria de assinatura
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  get: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ message: 'ID do item é obrigatório' });
      }

      // Por enquanto, retorna um item genérico
      // Implementar busca específica se necessário
      res.json({ id, message: 'Item de auditoria de assinatura' });
    } catch (error: any) {
      assinaturasControllerLogger.error(
        { err: error, params: req.params },
        'Erro ao obter item de auditoria de assinatura',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter item de auditoria de assinatura',
        error: error.message,
      });
    }
  },
  /**
   * @openapi
   * /api/v1/auditoria/assinaturas/logs:
   *   get:
   *     summary: Obtém logs de assinaturas
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
   *         name: empresaId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID da empresa
   *       - in: query
   *         name: tipo
   *         schema:
   *           type: string
   *         description: Tipo da ação
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Status da assinatura
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
   *         description: Logs de assinaturas
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
  getLogs: async (req: Request, res: Response) => {
    try {
      const filters = req.query;
      const result = await assinaturasService.obterLogsAssinaturas(filters);

      assinaturasControllerLogger.info(
        { filters, total: result.total },
        'Logs de assinaturas obtidos com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      assinaturasControllerLogger.error({ err: error }, 'Erro ao obter logs de assinaturas');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs de assinaturas',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/assinaturas/pagamentos:
   *   get:
   *     summary: Obtém logs de pagamentos de assinaturas
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
   *         name: empresasPlanoId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do plano empresarial
   *       - in: query
   *         name: tipo
   *         schema:
   *           type: string
   *         description: Tipo do pagamento
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Status do pagamento
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
   *         description: Logs de pagamentos
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
   *                       usuarioId:
   *                         type: string
   *                       empresasPlanoId:
   *                         type: string
   *                       tipo:
   *                         type: string
   *                       status:
   *                         type: string
   *                       externalRef:
   *                         type: string
   *                       mpResourceId:
   *                         type: string
   *                       payload:
   *                         type: object
   *                       mensagem:
   *                         type: string
   *                       criadoEm:
   *                         type: string
   *                         format: date-time
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
  getPagamentos: async (req: Request, res: Response) => {
    try {
      const filters = req.query;
      const result = await assinaturasService.obterLogsPagamentos(filters);

      assinaturasControllerLogger.info(
        { filters, total: result.total },
        'Logs de pagamentos obtidos com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      assinaturasControllerLogger.error({ err: error }, 'Erro ao obter logs de pagamentos');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs de pagamentos',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/assinaturas/planos:
   *   get:
   *     summary: Obtém logs de planos empresariais
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: empresaId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID da empresa
   *       - in: query
   *         name: planoId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do plano
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Status do plano
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
   *         description: Logs de planos
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
   *                       usuarioId:
   *                         type: string
   *                       planosEmpresariaisId:
   *                         type: string
   *                       modo:
   *                         type: string
   *                       status:
   *                         type: string
   *                       origin:
   *                         type: string
   *                       inicio:
   *                         type: string
   *                         format: date-time
   *                       fim:
   *                         type: string
   *                         format: date-time
   *                       criadoEm:
   *                         type: string
   *                         format: date-time
   *                       empresa:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           nomeCompleto:
   *                             type: string
   *                           email:
   *                             type: string
   *                           role:
   *                             type: string
   *                       plano:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           nome:
   *                             type: string
   *                           descricao:
   *                             type: string
   *                           valor:
   *                             type: string
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
  getPlanos: async (req: Request, res: Response) => {
    try {
      const filters = req.query;
      const result = await assinaturasService.obterLogsPlanos(filters);

      assinaturasControllerLogger.info(
        { filters, total: result.total },
        'Logs de planos obtidos com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      assinaturasControllerLogger.error({ err: error }, 'Erro ao obter logs de planos');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter logs de planos',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/assinaturas/estatisticas:
   *   get:
   *     summary: Obtém estatísticas de assinaturas
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Estatísticas de assinaturas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalAssinaturas:
   *                   type: integer
   *                 assinaturasPorStatus:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                 assinaturasPorTipo:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                 assinaturasPorPeriodo:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       data:
   *                         type: string
   *                       total:
   *                         type: integer
   *                 receitaTotal:
   *                   type: number
   *                 receitaPorPeriodo:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       data:
   *                         type: string
   *                       valor:
   *                         type: number
   *       500:
   *         description: Erro interno do servidor
   */
  getEstatisticas: async (req: Request, res: Response) => {
    try {
      const result = await assinaturasService.obterEstatisticasAssinaturas();

      assinaturasControllerLogger.info('Estatísticas de assinaturas obtidas com sucesso');

      res.json(result);
    } catch (error: any) {
      assinaturasControllerLogger.error(
        { err: error },
        'Erro ao obter estatísticas de assinaturas',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter estatísticas de assinaturas',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/assinaturas/resumo:
   *   get:
   *     summary: Obtém resumo de assinaturas ativas
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Resumo de assinaturas ativas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalAtivas:
   *                   type: integer
   *                 novasEsteMes:
   *                   type: integer
   *                 canceladasEsteMes:
   *                   type: integer
   *                 renovacoesEsteMes:
   *                   type: integer
   *                 receitaEsteMes:
   *                   type: number
   *                 taxaRetencao:
   *                   type: number
   *       500:
   *         description: Erro interno do servidor
   */
  getResumo: async (req: Request, res: Response) => {
    try {
      const result = await assinaturasService.obterResumoAssinaturasAtivas();

      assinaturasControllerLogger.info('Resumo de assinaturas ativas obtido com sucesso');

      res.json(result);
    } catch (error: any) {
      assinaturasControllerLogger.error(
        { err: error },
        'Erro ao obter resumo de assinaturas ativas',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter resumo de assinaturas ativas',
        error: error.message,
      });
    }
  },
};
