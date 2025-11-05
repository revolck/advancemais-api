/**
 * Controller para scripts de auditoria
 * @module auditoria/controllers/scripts
 */

import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { scriptsService } from '../services/scripts.service';
import { auditoriaScriptInputSchema } from '../validators/auditoria.validators';

const scriptsControllerLogger = logger.child({ module: 'ScriptsController' });

export const scriptsController = {
  /**
   * @openapi
   * /api/v1/auditoria/scripts:
   *   get:
   *     summary: Lista scripts de auditoria
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: tipo
   *         schema:
   *           type: string
   *           enum: [MIGRACAO, BACKUP, LIMPEZA, RELATORIO, INTEGRACAO, MANUTENCAO]
   *         description: Tipo do script
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [PENDENTE, EXECUTANDO, CONCLUIDO, ERRO, CANCELADO]
   *         description: Status do script
   *       - in: query
   *         name: executadoPor
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do usuário que executou
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
   *         description: Lista de scripts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditoriaScriptResponse'
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
      const result = await scriptsService.listarScripts(filters);

      scriptsControllerLogger.info(
        { filters, total: result.total },
        'Scripts listados com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      scriptsControllerLogger.error({ err: error }, 'Erro ao listar scripts');
      res.status(500).json({
        success: false,
        message: 'Erro ao listar scripts',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/scripts:
   *   post:
   *     summary: Registra um novo script
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AuditoriaScriptInput'
   *     responses:
   *       201:
   *         description: Script registrado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaScriptResponse'
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro interno do servidor
   */
  create: async (req: Request, res: Response) => {
    try {
      const input = auditoriaScriptInputSchema.parse(req.body);
      const executadoPor = (req.user as any)?.id;

      if (!executadoPor) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      const result = await scriptsService.registrarScript(input, executadoPor);

      scriptsControllerLogger.info(
        { scriptId: result.id, nome: result.nome },
        'Script registrado com sucesso',
      );

      res.status(201).json(result);
    } catch (error: any) {
      scriptsControllerLogger.error({ err: error }, 'Erro ao registrar script');
      res.status(400).json({
        success: false,
        message: 'Erro ao registrar script',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/scripts/{id}:
   *   get:
   *     summary: Obtém um script específico
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
   *         description: ID do script
   *     responses:
   *       200:
   *         description: Script encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaScriptResponse'
   *       404:
   *         description: Script não encontrado
   *       500:
   *         description: Erro interno do servidor
   */
  get: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const script = await scriptsService.obterScriptPorId(id);

      if (!script) {
        return res.status(404).json({
          success: false,
          message: 'Script não encontrado',
        });
      }

      scriptsControllerLogger.info({ scriptId: id }, 'Script obtido com sucesso');
      res.json(script);
    } catch (error: any) {
      scriptsControllerLogger.error({ err: error, id: req.params.id }, 'Erro ao obter script');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter script',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/scripts/{id}/executar:
   *   post:
   *     summary: Executa um script
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
   *         description: ID do script
   *     responses:
   *       200:
   *         description: Script executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaScriptResponse'
   *       400:
   *         description: Script não pode ser executado
   *       404:
   *         description: Script não encontrado
   *       500:
   *         description: Erro interno do servidor
   */
  executar: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const executadoPor = (req.user as any)?.id;

      if (!executadoPor) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
      }

      const result = await scriptsService.executarScript(id, executadoPor);

      scriptsControllerLogger.info(
        { scriptId: id, status: result.status },
        'Script executado com sucesso',
      );

      res.json(result);
    } catch (error: any) {
      scriptsControllerLogger.error({ err: error, id: req.params.id }, 'Erro ao executar script');
      res.status(400).json({
        success: false,
        message: 'Erro ao executar script',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/scripts/{id}:
   *   patch:
   *     summary: Atualiza um script
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
   *         description: ID do script
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               nome:
   *                 type: string
   *                 description: Nome do script
   *               descricao:
   *                 type: string
   *                 description: Descrição do script
   *               tipo:
   *                 type: string
   *                 enum: [MIGRACAO, BACKUP, LIMPEZA, RELATORIO, INTEGRACAO, MANUTENCAO]
   *                 description: Tipo do script
   *               status:
   *                 type: string
   *                 enum: [PENDENTE, EXECUTANDO, CONCLUIDO, ERRO, CANCELADO]
   *                 description: Status do script
   *               parametros:
   *                 type: object
   *                 description: Parâmetros do script
   *     responses:
   *       200:
   *         description: Script atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaScriptResponse'
   *       400:
   *         description: Dados inválidos
   *       404:
   *         description: Script não encontrado
   *       500:
   *         description: Erro interno do servidor
   */
  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const result = await scriptsService.atualizarScript(id, updates);

      scriptsControllerLogger.info({ scriptId: id }, 'Script atualizado com sucesso');

      res.json(result);
    } catch (error: any) {
      scriptsControllerLogger.error({ err: error, id: req.params.id }, 'Erro ao atualizar script');
      res.status(400).json({
        success: false,
        message: 'Erro ao atualizar script',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/scripts/{id}/cancelar:
   *   post:
   *     summary: Cancela um script pendente
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
   *         description: ID do script
   *     responses:
   *       200:
   *         description: Script cancelado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuditoriaScriptResponse'
   *       400:
   *         description: Script não pode ser cancelado
   *       404:
   *         description: Script não encontrado
   *       500:
   *         description: Erro interno do servidor
   */
  cancelar: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await scriptsService.cancelarScript(id);

      scriptsControllerLogger.info({ scriptId: id }, 'Script cancelado com sucesso');

      res.json(result);
    } catch (error: any) {
      scriptsControllerLogger.error({ err: error, id: req.params.id }, 'Erro ao cancelar script');
      res.status(400).json({
        success: false,
        message: 'Erro ao cancelar script',
        error: error.message,
      });
    }
  },

  /**
   * @openapi
   * /api/v1/auditoria/scripts/estatisticas:
   *   get:
   *     summary: Obtém estatísticas de scripts
   *     tags: [Auditoria]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Estatísticas de scripts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalScripts:
   *                   type: integer
   *                 scriptsPorTipo:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                 scriptsPorStatus:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                 scriptsPorUsuario:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       usuarioId:
   *                         type: string
   *                       nomeCompleto:
   *                         type: string
   *                       total:
   *                         type: integer
   *                 scriptsPorPeriodo:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       data:
   *                         type: string
   *                       total:
   *                         type: integer
   *       500:
   *         description: Erro interno do servidor
   */
  getEstatisticas: async (req: Request, res: Response) => {
    try {
      const result = await scriptsService.obterEstatisticas();

      scriptsControllerLogger.info('Estatísticas de scripts obtidas com sucesso');

      res.json(result);
    } catch (error: any) {
      scriptsControllerLogger.error({ err: error }, 'Erro ao obter estatísticas de scripts');
      res.status(500).json({
        success: false,
        message: 'Erro ao obter estatísticas de scripts',
        error: error.message,
      });
    }
  },
};
