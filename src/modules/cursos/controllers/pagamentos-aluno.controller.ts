import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { pagamentosAlunoService } from '../services/pagamentos-aluno.service';
import {
  acessoRecuperacaoQuerySchema,
  checkoutRecuperacaoSchema,
  listMeusPagamentosQuerySchema,
} from '../validators/pagamentos-aluno.schema';

export class PagamentosAlunoController {
  static listMeus = async (req: Request, res: Response) => {
    try {
      const query = listMeusPagamentosQuerySchema.parse(req.query);
      const data = await pagamentosAlunoService.list(req.user!.id, query);
      res.json({ success: true, data });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Filtros de pagamentos invalidos',
          issues: error.flatten().fieldErrors,
        });
      }
      res.status(500).json({
        success: false,
        code: 'PAGAMENTOS_ALUNO_LIST_ERROR',
        message: 'Erro ao listar pagamentos',
        error: error?.message,
      });
    }
  };

  static checkoutRecuperacao = async (req: Request, res: Response) => {
    try {
      const payload = checkoutRecuperacaoSchema.parse(req.body);
      const result = await pagamentosAlunoService.checkoutRecuperacao(
        req.user!.id,
        req.params.pagamentoId,
        payload,
      );
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados do pagamento invalidos',
          issues: error.flatten().fieldErrors,
        });
      }
      if (error?.code === 'PAGAMENTO_NOT_FOUND') {
        return res.status(404).json({ success: false, code: error.code, message: error.message });
      }
      if (error?.code === 'PAGAMENTO_JA_APROVADO') {
        return res.status(409).json({ success: false, code: error.code, message: error.message });
      }
      res.status(500).json({
        success: false,
        code: 'RECUPERACAO_CHECKOUT_ERROR',
        message: error?.message || 'Erro ao iniciar pagamento',
      });
    }
  };

  static acessoRecuperacao = async (req: Request, res: Response) => {
    try {
      const query = acessoRecuperacaoQuerySchema.parse(req.query);
      const data = await pagamentosAlunoService.getAcessoRecuperacao(
        req.user!.id,
        query.inscricaoId,
        req.params.provaId,
      );
      res.json({ success: true, data });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR' });
      }
      if (error?.code === 'INSCRICAO_NOT_FOUND') {
        return res.status(404).json({ success: false, code: error.code, message: error.message });
      }
      res.status(500).json({
        success: false,
        code: 'RECUPERACAO_ACESSO_ERROR',
        message: 'Erro ao verificar acesso a recuperacao',
      });
    }
  };
}
