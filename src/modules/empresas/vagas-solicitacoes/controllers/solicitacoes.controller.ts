import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '@/utils/logger';
import { solicitacoesService } from '../services/solicitacoes.service';
import {
  solicitacoesListQuerySchema,
  aprovarSolicitacaoSchema,
  rejeitarSolicitacaoSchema,
  solicitacaoParamSchema,
} from '../validators/solicitacoes.schema';

const solicitacoesControllerLogger = logger.child({ module: 'SolicitacoesController' });

export class SolicitacoesController {
  /**
   * Busca detalhes completos de uma solicitação
   */
  static get = async (req: Request, res: Response) => {
    try {
      const params = solicitacaoParamSchema.parse(req.params);
      const result = await solicitacoesService.get(params.id);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'SOLICITACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'SOLICITACAO_NOT_FOUND',
          message: 'Solicitação não encontrada',
        });
      }

      solicitacoesControllerLogger.error({ err: error }, 'Erro ao buscar detalhes da solicitação');
      res.status(500).json({
        success: false,
        code: 'SOLICITACOES_GET_ERROR',
        message: 'Erro ao buscar detalhes da solicitação',
        error: error?.message || 'Erro desconhecido',
      });
    }
  };

  /**
   * Lista solicitações de publicação de vagas
   */
  static list = async (req: Request, res: Response) => {
    try {
      const query = solicitacoesListQuerySchema.parse(req.query);
      const result = await solicitacoesService.list(query);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      solicitacoesControllerLogger.error({ err: error }, 'Erro ao listar solicitações');
      res.status(500).json({
        success: false,
        code: 'SOLICITACOES_LIST_ERROR',
        message: 'Erro ao listar solicitações',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  /**
   * Aprova uma solicitação de publicação
   */
  static aprovar = async (req: Request, res: Response) => {
    try {
      const params = solicitacaoParamSchema.parse(req.params);
      const body = aprovarSolicitacaoSchema.parse(req.body || {});
      const aprovadorId = req.user?.id;

      if (!aprovadorId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const result = await solicitacoesService.aprovar(params.id, body, aprovadorId);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'SOLICITACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'SOLICITACAO_NOT_FOUND',
          message: 'Solicitação não encontrada',
        });
      }

      if (error?.code === 'SOLICITACAO_INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          code: 'SOLICITACAO_INVALID_STATUS',
          message: error.message || 'Solicitação não está pendente',
        });
      }

      solicitacoesControllerLogger.error({ err: error }, 'Erro ao aprovar solicitação');
      res.status(500).json({
        success: false,
        code: 'SOLICITACOES_APROVAR_ERROR',
        message: 'Erro ao aprovar solicitação',
        error: error?.message || 'Erro desconhecido',
      });
    }
  };

  /**
   * Rejeita uma solicitação de publicação
   */
  static rejeitar = async (req: Request, res: Response) => {
    try {
      const params = solicitacaoParamSchema.parse(req.params);
      const body = rejeitarSolicitacaoSchema.parse(req.body);
      const rejeitadorId = req.user?.id;

      if (!rejeitadorId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const result = await solicitacoesService.rejeitar(params.id, body, rejeitadorId);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'SOLICITACAO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'SOLICITACAO_NOT_FOUND',
          message: 'Solicitação não encontrada',
        });
      }

      if (error?.code === 'SOLICITACAO_INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          code: 'SOLICITACAO_INVALID_STATUS',
          message: error.message || 'Solicitação não está pendente',
        });
      }

      solicitacoesControllerLogger.error({ err: error }, 'Erro ao rejeitar solicitação');
      res.status(500).json({
        success: false,
        code: 'SOLICITACOES_REJEITAR_ERROR',
        message: 'Erro ao rejeitar solicitação',
        error: error?.message || 'Erro desconhecido',
      });
    }
  };
}
