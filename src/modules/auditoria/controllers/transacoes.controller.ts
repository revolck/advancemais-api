/**
 * Controller para transações de auditoria
 * @module auditoria/controllers/transacoes
 */

import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { transacoesService } from '../services/transacoes.service';
import { auditoriaTransacaoInputSchema } from '../validators/auditoria.validators';

const transacoesControllerLogger = logger.child({ module: 'TransacoesController' });

export const transacoesController = {
  /**
   * @openapi
   * /api/v1/auditoria/transacoes:
   *   get:
   *     summary: Lista transações de auditoria
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: tipo
   *         schema:
   *           type: string
   *           enum: [PAGAMENTO, REEMBOLSO, ESTORNO, ASSINATURA, CUPOM, TAXA]
   *         description: Tipo da transação
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [PENDENTE, PROCESSANDO, APROVADA, RECUSADA, CANCELADA, ESTORNADA]
   *         description: Status da transação
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
   *         name: gateway
   *         schema:
   *           type: string
   *         description: Gateway de pagamento
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
   *         description: Lista de transações
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaTransacaoResponse'
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
  list: async (req: Request, res: Response) => {
    try {
      const filters = req.query;
      const result = await transacoesService.listarTransacoes(filters);

      transacoesControllerLogger.info(
        { filters, total: result.total },
        'Transações listadas com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      transacoesControllerLogger.error({ err: error }, 'Erro ao listar transações');
      res.status(500).json({
        success: false,
        message: 'Erro ao listar transações',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/transacoes:
   *   post:
   *     summary: Registra uma nova transação
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AuditoriaTransacaoInput'
   *     responses:
   *       201:
   *         description: Transação registrada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaTransacaoResponse'
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro interno do servidor
   */
  create: async (req: Request, res: Response) => {
    try {
      const input = auditoriaTransacaoInputSchema.parse(req.body);
      const result = await transacoesService.registrarTransacao(input);

      transacoesControllerLogger.info(
        { transacaoId: result.id, tipo: result.tipo, valor: result.valor },
        'Transação registrada com sucesso',
      );

      res.status(201).json(result);
    } catch (error: any) {
      transacoesControllerLogger.error({ err: error }, 'Erro ao registrar transação');
      res.status(400).json({
        success: false,
        message: 'Erro ao registrar transação',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/transacoes/{id}:
   *   get:
   *     summary: Obtém uma transação específica
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
   *         description: ID da transação
   *     responses:
   *       200:
   *         description: Transação encontrada
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaTransacaoResponse'
   *       404:
   *         description: Transação não encontrada
   *       500:
   *         description: Erro interno do servidor
   */
  get: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const transacao = await transacoesService.obterTransacaoPorId(id);

      if (!transacao) {
        return res.status(404).json({
          success: false,
          message: 'Transação não encontrada',
        });
      }

      transacoesControllerLogger.info({ transacaoId: id }, 'Transação obtida com sucesso');
      res.json(transacao);
    } catch (error: any) {
      transacoesControllerLogger.error(
        { err: error, id: req.params.id },
        'Erro ao obter transação',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter transação',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/transacoes/{id}:
   *   patch:
   *     summary: Atualiza uma transação
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
   *         description: ID da transação
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [PENDENTE, PROCESSANDO, APROVADA, RECUSADA, CANCELADA, ESTORNADA]
   *                 description: Novo status da transação
   *               metadata:
   *                 type: object
   *                 description: Metadados adicionais
   *     responses:
   *       200:
   *         description: Transação atualizada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaTransacaoResponse'
   *       400:
   *         description: Dados inválidos
   *       404:
   *         description: Transação não encontrada
   *       500:
   *         description: Erro interno do servidor
   */
  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, metadata } = req.body;

      const result = await transacoesService.atualizarStatusTransacao(id, status, metadata);

      transacoesControllerLogger.info(
        { transacaoId: id, status },
        'Transação atualizada com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      transacoesControllerLogger.error(
        { err: error, id: req.params.id },
        'Erro ao atualizar transação',
      );
      res.status(400).json({
        success: false,
        message: 'Erro ao atualizar transação',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/transacoes/{id}/status:
   *   patch:
   *     summary: Atualiza status de uma transação
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
   *         description: ID da transação
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [PENDENTE, PROCESSANDO, APROVADA, RECUSADA, CANCELADA, ESTORNADA]
   *                 description: Novo status da transação
   *               metadata:
   *                 type: object
   *                 description: Metadados adicionais
   *             required:
   *               - status
   *     responses:
   *       200:
   *         description: Status atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaTransacaoResponse'
   *       400:
   *         description: Dados inválidos
   *       404:
   *         description: Transação não encontrada
   *       500:
   *         description: Erro interno do servidor
   */
  updateStatus: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, metadata } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status é obrigatório',
        });
      }

      const result = await transacoesService.atualizarStatusTransacao(id, status, metadata);

      transacoesControllerLogger.info(
        { transacaoId: id, status },
        'Status da transação atualizado com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      transacoesControllerLogger.error(
        { err: error, id: req.params.id },
        'Erro ao atualizar status da transação',
      );
      res.status(400).json({
        success: false,
        message: 'Erro ao atualizar status da transação',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/transacoes/usuario/{usuarioId}:
   *   get:
   *     summary: Obtém transações de um usuário específico
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
   *         description: Transações do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaTransacaoResponse'
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

      const result = await transacoesService.obterTransacoesPorUsuario(
        usuarioId,
        Number(page),
        Number(pageSize),
      );

      transacoesControllerLogger.info(
        { usuarioId, total: result.total },
        'Transações do usuário obtidas com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      transacoesControllerLogger.error(
        { err: error, usuarioId: req.params.usuarioId },
        'Erro ao obter transações do usuário',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter transações do usuário',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/transacoes/empresa/{empresaId}:
   *   get:
   *     summary: Obtém transações de uma empresa específica
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: empresaId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID da empresa
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
   *         description: Transações da empresa
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaTransacaoResponse'
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
  getByEmpresa: async (req: Request, res: Response) => {
    try {
      const { empresaId } = req.params;
      const { page = 1, pageSize = 20 } = req.query;

      const result = await transacoesService.obterTransacoesPorEmpresa(
        empresaId,
        Number(page),
        Number(pageSize),
      );

      transacoesControllerLogger.info(
        { empresaId, total: result.total },
        'Transações da empresa obtidas com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      transacoesControllerLogger.error(
        { err: error, empresaId: req.params.empresaId },
        'Erro ao obter transações da empresa',
      );
      res.status(500).json({
        success: false,
        message: 'Erro ao obter transações da empresa',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/transacoes/estatisticas:
   *   get:
   *     summary: Obtém estatísticas de transações
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Estatísticas de transações
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalTransacoes:
   *                   type: integer
   *                 transacoesPorTipo:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                 transacoesPorStatus:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                 transacoesPorGateway:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                 transacoesPorPeriodo:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       data:
   *                         type: string
   *                       total:
   *                         type: integer
   *                 valorTotal:
   *                   type: number
   *                 valorPorPeriodo:
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
      const result = await transacoesService.obterEstatisticasTransacoes();

      transacoesControllerLogger.info('Estatísticas de transações obtidas com sucesso');

      res.json(result);
    } catch (error: any) {
      transacoesControllerLogger.error({ err: error }, 'Erro ao obter estatísticas de transações');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter estatísticas de transações',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/transacoes/resumo:
   *   get:
   *     summary: Obtém resumo financeiro
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Resumo financeiro
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 receitaHoje:
   *                   type: number
   *                 receitaOntem:
   *                   type: number
   *                 receitaSemana:
   *                   type: number
   *                 receitaMes:
   *                   type: number
   *                 transacoesHoje:
   *                   type: integer
   *                 transacoesOntem:
   *                   type: integer
   *                 transacoesSemana:
   *                   type: integer
   *                 transacoesMes:
   *                   type: integer
   *                 tendenciaReceita:
   *                   type: string
   *                   enum: [crescendo, diminuindo, estavel]
   *                 tendenciaTransacoes:
   *                   type: string
   *                   enum: [crescendo, diminuindo, estavel]
   *       500:
   *         description: Erro interno do servidor
   */
  getResumo: async (req: Request, res: Response) => {
    try {
      const result = await transacoesService.obterResumoFinanceiro();

      transacoesControllerLogger.info('Resumo financeiro obtido com sucesso');

      res.json(result);
    } catch (error: any) {
      transacoesControllerLogger.error({ err: error }, 'Erro ao obter resumo financeiro');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter resumo financeiro',
        error: error.message,
      });
    }
  },
};
