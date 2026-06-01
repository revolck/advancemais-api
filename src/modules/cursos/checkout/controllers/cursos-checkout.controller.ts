import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { cursosCheckoutService } from '../services/cursos-checkout.service';
import { pagamentosAlunoService } from '../../services/pagamentos-aluno.service';
import { startCursoCheckoutSchema } from '../validators/cursos-checkout.schema';

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
  private static getSanitizedCheckoutError(error: any): {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        statusCode: 409,
        code: 'INSCRICAO_DUPLICADA_TURMA',
        message: 'Você já possui inscrição ativa nesta turma.',
      };
    }

    const mappedByCode: Record<string, { statusCode: number; message: string }> = {
      VALIDATION_ERROR: {
        statusCode: 400,
        message: 'Erro de validação nos dados enviados.',
      },
      SEM_VAGAS: {
        statusCode: 409,
        message: 'Não há vagas disponíveis nesta turma.',
      },
      INSCRICOES_ENCERRADAS: {
        statusCode: 409,
        message: 'Período de inscrição encerrado para esta turma.',
      },
      INSCRICAO_DUPLICADA_TURMA: {
        statusCode: 409,
        message: 'Você já possui inscrição ativa nesta turma.',
      },
      PAYER_IDENTIFICATION_REQUIRED: {
        statusCode: 400,
        message: 'CPF ou CNPJ válido é obrigatório para este pagamento.',
      },
      PAYER_EMAIL_REQUIRED: {
        statusCode: 400,
        message: 'E-mail do pagador é obrigatório para este pagamento.',
      },
      INVALID_CPF: {
        statusCode: 400,
        message: 'CPF inválido. Verifique e tente novamente.',
      },
      INVALID_CNPJ: {
        statusCode: 400,
        message: 'CNPJ inválido. Verifique e tente novamente.',
      },
      BOLETO_ADDRESS_REQUIRED: {
        statusCode: 400,
        message: 'Endereço completo é obrigatório para pagamento via boleto.',
      },
      USER_NOT_FOUND: {
        statusCode: 404,
        message: 'Usuário não encontrado.',
      },
      TURMA_NOT_FOUND: {
        statusCode: 404,
        message: 'Turma não encontrada.',
      },
      MERCADOPAGO_NOT_CONFIGURED: {
        statusCode: 503,
        message: 'Pagamento indisponível no momento. Tente novamente mais tarde.',
      },
      MERCADOPAGO_INVALID_TOKEN: {
        statusCode: 503,
        message: 'Pagamento indisponível no momento. Tente novamente mais tarde.',
      },
      PIX_KEY_NOT_CONFIGURED: {
        statusCode: 503,
        message: 'Pagamento via PIX indisponível no momento. Tente outro método de pagamento.',
      },
      FINANCIAL_IDENTITY_ERROR: {
        statusCode: 502,
        message:
          'O Mercado Pago não autorizou a criação deste pagamento. Verifique os dados e tente novamente.',
      },
      INVALID_IDENTIFICATION: {
        statusCode: 400,
        message: 'CPF ou CNPJ inválido para este pagamento.',
      },
      MERCADOPAGO_ERROR: {
        statusCode: 502,
        message: 'Não foi possível processar o pagamento no momento. Tente novamente.',
      },
    };

    const errorCode = typeof error?.code === 'string' ? error.code : undefined;
    if (errorCode && mappedByCode[errorCode]) {
      return {
        statusCode: mappedByCode[errorCode].statusCode,
        code: errorCode,
        message: mappedByCode[errorCode].message,
      };
    }

    return {
      statusCode: 500,
      code: 'CHECKOUT_ERROR',
      message: 'Não foi possível iniciar o checkout no momento. Tente novamente.',
    };
  }

  /**
   * POST /api/cursos/checkout
   * Iniciar checkout de curso (pagamento único)
   */
  static checkout = async (req: Request, res: Response) => {
    try {
      const payload = startCursoCheckoutSchema.parse({
        ...req.body,
        usuarioId: req.user?.id,
      });
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

      const sanitized = CursosCheckoutController.getSanitizedCheckoutError(error);

      res.status(sanitized.statusCode).json({
        success: false,
        code: sanitized.code,
        message: sanitized.message,
        details: sanitized.details,
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

      const event = {
        type: req.body?.type,
        action: req.body?.action,
        data: req.body?.data || req.body,
      };
      const isRecuperacao = await pagamentosAlunoService.processarWebhook(event);
      if (!isRecuperacao) {
        await cursosCheckoutService.handleWebhookPagamento(event);
      }

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
        where: { mpPaymentId: paymentId, alunoId: req.user?.id },
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
          vagasIlimitadas: true,
          _count: {
            select: {
              CursosTurmasInscricoes: {
                // Vaga fica ocupada enquanto a inscrição não estiver CANCELADO/TRANCADO (inclui boleto pendente)
                where: { status: { notIn: ['CANCELADO', 'TRANCADO'] } },
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
      const ilimitado = turma.vagasIlimitadas || !turma.vagasTotais || turma.vagasTotais === 0;
      const vagasTotais = ilimitado ? null : turma.vagasTotais;
      const temVaga = ilimitado ? true : inscritosAtual < (vagasTotais as number);
      const vagasDisponiveis = ilimitado ? null : (vagasTotais as number) - inscritosAtual;

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
          ilimitado,
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
