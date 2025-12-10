import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { cursosCheckoutService } from '../services/cursos-checkout.service';
import {
  startCursoCheckoutSchema,
  validarTokenAcessoSchema,
  consultarPagamentoSchema,
} from '../validators/cursos-checkout.schema';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

/**
 * Controller para checkout de cursos
 *
 * Diferente de planos empresariais:
 * - Pagamento único (não recorrente)
 * - Gera token de acesso único por inscrição
 * - Valida vagas disponíveis na turma
 * - Não permite inscrições duplicadas
 */
export class CursosCheckoutController {
  /**
   * POST /api/cursos/checkout
   * Iniciar checkout de curso (pagamento único)
   */
  static checkout = async (req: Request, res: Response) => {
    try {
      const payload = startCursoCheckoutSchema.parse(req.body);
      const result = await cursosCheckoutService.startCheckout(payload);

      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        logger.warn('[CHECKOUT_VALIDATION_ERROR]', {
          issues: error.flatten().fieldErrors,
        });
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Erro de validação nos dados enviados',
          issues: error.flatten().fieldErrors,
        });
      }

      logger.error('[CHECKOUT_ERROR]', {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
      });

      res.status(500).json({
        success: false,
        code: error?.code || 'CHECKOUT_ERROR',
        message: error?.message || 'Erro ao iniciar checkout',
        details: error?.details || undefined,
      });
    }
  };

  /**
   * POST /api/cursos/checkout/webhook
   * Webhook do Mercado Pago para processar pagamentos de cursos
   */
  static webhook = async (req: Request, res: Response) => {
    try {
      logger.info('[WEBHOOK_RECEIVED]', {
        type: req.body?.type,
        action: req.body?.action,
        dataId: req.body?.data?.id,
      });

      await cursosCheckoutService.handleWebhookPagamento({
        type: req.body?.type,
        action: req.body?.action,
        data: req.body?.data || req.body,
      });

      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error('[WEBHOOK_ERROR]', {
        message: error?.message,
        stack: error?.stack,
      });

      res.status(500).json({
        success: false,
        code: 'WEBHOOK_ERROR',
        message: 'Erro ao processar webhook',
      });
    }
  };

  /**
   * GET /api/cursos/checkout/validar-token/:token
   * Validar token de acesso ao curso
   */
  static validarToken = async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_TOKEN',
          message: 'Token não fornecido',
        });
      }

      const result = await cursosCheckoutService.validarTokenAcesso(token);

      if (!result.valido) {
        return res.status(403).json({
          success: false,
          code: 'INVALID_TOKEN',
          message: result.erro || 'Token inválido',
        });
      }

      res.json({
        success: true,
        valido: true,
        inscricao: {
          id: result.inscricao.id,
          codigo: result.inscricao.codigo,
          status: result.inscricao.status,
          statusPagamento: result.inscricao.statusPagamento,
          aluno: result.inscricao.Usuarios,
          curso: result.inscricao.CursosTurmas.Cursos,
          turma: {
            id: result.inscricao.CursosTurmas.id,
            nome: result.inscricao.CursosTurmas.nome,
          },
          tokenExpiraEm: result.inscricao.tokenAcessoExpiraEm,
        },
      });
    } catch (error: any) {
      logger.error('[VALIDAR_TOKEN_ERROR]', {
        message: error?.message,
        stack: error?.stack,
      });

      res.status(500).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: error?.message || 'Erro ao validar token',
      });
    }
  };

  /**
   * GET /api/cursos/checkout/pagamento/:paymentId
   * Consultar status do pagamento
   */
  static consultarPagamento = async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_PAYMENT_ID',
          message: 'Payment ID não fornecido',
        });
      }

      const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
        where: { mpPaymentId: paymentId },
        include: {
          CursosTurmas: { include: { Cursos: true } },
          Usuarios: { select: { id: true, nomeCompleto: true, email: true } },
        },
      });

      if (!inscricao) {
        return res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: 'Pagamento não encontrado',
        });
      }

      res.json({
        success: true,
        inscricao: {
          id: inscricao.id,
          codigo: inscricao.codigo,
          status: inscricao.status,
          statusPagamento: inscricao.statusPagamento,
          valorPago: inscricao.valorPago?.toString() || null,
          valorOriginal: inscricao.valorOriginal?.toString() || null,
          valorDesconto: inscricao.valorDesconto?.toString() || null,
          valorFinal: inscricao.valorFinal?.toString() || null,
          metodoPagamento: inscricao.metodoPagamento,
          tokenAcesso: inscricao.status === 'INSCRITO' ? inscricao.tokenAcesso : null,
          criadoEm: inscricao.criadoEm,
          curso: {
            id: inscricao.CursosTurmas.Cursos.id,
            nome: inscricao.CursosTurmas.Cursos.nome,
            codigo: inscricao.CursosTurmas.Cursos.codigo,
          },
          turma: {
            id: inscricao.CursosTurmas.id,
            nome: inscricao.CursosTurmas.nome,
          },
          aluno: inscricao.Usuarios,
        },
      });
    } catch (error: any) {
      logger.error('[CONSULTAR_PAGAMENTO_ERROR]', {
        message: error?.message,
        stack: error?.stack,
      });

      res.status(500).json({
        success: false,
        code: 'QUERY_ERROR',
        message: error?.message || 'Erro ao consultar pagamento',
      });
    }
  };

  /**
   * GET /api/cursos/:cursoId/turmas/:turmaId/vagas
   * Verificar vagas disponíveis na turma
   */
  static verificarVagas = async (req: Request, res: Response) => {
    try {
      const { cursoId, turmaId } = req.params;

      if (!cursoId || !turmaId) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_PARAMS',
          message: 'cursoId e turmaId são obrigatórios',
        });
      }

      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: turmaId },
        select: {
          id: true,
          nome: true,
          cursoId: true,
          vagasTotais: true,
          _count: {
            select: {
              CursosTurmasInscricoes: {
                where: { status: 'INSCRITO' },
              },
            },
          },
        },
      });

      if (!turma) {
        return res.status(404).json({
          success: false,
          code: 'TURMA_NOT_FOUND',
          message: 'Turma não encontrada',
        });
      }

      if (turma.cursoId !== cursoId) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_TURMA',
          message: 'Turma não pertence ao curso especificado',
        });
      }

      const inscritosAtual = turma._count.CursosTurmasInscricoes;
      const vagasTotais = turma.vagasTotais || null;
      const temVaga = vagasTotais === null || vagasTotais === 0 || inscritosAtual < vagasTotais;
      const vagasDisponiveis =
        vagasTotais === null || vagasTotais === 0 ? null : vagasTotais - inscritosAtual;

      res.json({
        success: true,
        turma: {
          id: turma.id,
          nome: turma.nome,
        },
        vagas: {
          temVaga,
          inscritosAtual,
          vagasTotais,
          vagasDisponiveis,
          ilimitado: vagasTotais === null || vagasTotais === 0,
        },
      });
    } catch (error: any) {
      logger.error('[VERIFICAR_VAGAS_ERROR]', {
        message: error?.message,
        stack: error?.stack,
      });

      res.status(500).json({
        success: false,
        code: 'QUERY_ERROR',
        message: error?.message || 'Erro ao verificar vagas',
      });
    }
  };
}
