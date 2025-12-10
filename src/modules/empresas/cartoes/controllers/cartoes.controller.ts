import { Request, Response } from 'express';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { EmpresasPlanoStatus } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { cartoesService } from '../services/cartoes.service';
import { cobrancaAutomaticaService } from '../services/cobranca-automatica.service';
import { adicionarCartaoSchema } from '../validators/cartoes.schema';
import { ZodError } from 'zod';

/**
 * Controller para gerenciamento de cartões de empresas
 */
export class CartoesController {
  /**
   * GET /api/v1/empresas/cartoes
   * Lista todos os cartões cadastrados da empresa autenticada
   */
  static listar = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token de autorização necessário',
        });
      }

      const { role, id: usuarioId } = req.user;

      // Apenas empresas podem acessar
      if (role !== Roles.EMPRESA) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Este endpoint é exclusivo para empresas',
        });
      }

      const cartoes = await cartoesService.listar(usuarioId);

      res.json({
        success: true,
        data: cartoes,
      });
    } catch (error: any) {
      console.error('[CartoesController.listar] Erro:', error);
      res.status(500).json({
        success: false,
        code: 'CARTOES_LIST_ERROR',
        message: 'Erro ao listar cartões',
        error: error?.message,
      });
    }
  };

  /**
   * POST /api/v1/empresas/cartoes
   * Adiciona um novo cartão para a empresa autenticada
   */
  static adicionar = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token de autorização necessário',
        });
      }

      const { role, id: usuarioId } = req.user;

      // Apenas empresas podem acessar
      if (role !== Roles.EMPRESA) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Este endpoint é exclusivo para empresas',
        });
      }

      // Validar input
      const validacao = adicionarCartaoSchema.safeParse(req.body);

      if (!validacao.success) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          errors: validacao.error.errors,
        });
      }

      const { token, isPadrao, tipo } = validacao.data;

      const cartao = await cartoesService.adicionar(usuarioId, token, isPadrao, tipo);

      res.status(201).json({
        success: true,
        cartao,
      });
    } catch (error: any) {
      console.error('[CartoesController.adicionar] Erro:', error);

      // Erros específicos do Mercado Pago
      if (error.message?.includes('token')) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CARD_TOKEN',
          message: 'Token de cartão inválido ou expirado',
          error: error?.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'CARTAO_ADD_ERROR',
        message: 'Erro ao adicionar cartão',
        error: error?.message,
      });
    }
  };

  /**
   * PUT /api/v1/empresas/cartoes/:id/padrao
   * Define um cartão como padrão
   */
  static definirPadrao = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token de autorização necessário',
        });
      }

      const { role, id: usuarioId } = req.user;
      const { id: cartaoId } = req.params;

      // Apenas empresas podem acessar
      if (role !== Roles.EMPRESA) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Este endpoint é exclusivo para empresas',
        });
      }

      if (!cartaoId) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_CARD_ID',
          message: 'ID do cartão é obrigatório',
        });
      }

      await cartoesService.definirPadrao(usuarioId, cartaoId);

      res.json({
        success: true,
        message: 'Cartão definido como padrão',
      });
    } catch (error: any) {
      console.error('[CartoesController.definirPadrao] Erro:', error);

      if (error.message?.includes('não encontrado')) {
        return res.status(404).json({
          success: false,
          code: 'CARD_NOT_FOUND',
          message: 'Cartão não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'SET_DEFAULT_ERROR',
        message: 'Erro ao definir cartão como padrão',
        error: error?.message,
      });
    }
  };

  /**
   * DELETE /api/v1/empresas/cartoes/:id
   * Remove um cartão
   */
  static remover = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token de autorização necessário',
        });
      }

      const { role, id: usuarioId } = req.user;
      const { id: cartaoId } = req.params;

      // Apenas empresas podem acessar
      if (role !== Roles.EMPRESA) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Este endpoint é exclusivo para empresas',
        });
      }

      if (!cartaoId) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_CARD_ID',
          message: 'ID do cartão é obrigatório',
        });
      }

      await cartoesService.remover(usuarioId, cartaoId);

      res.json({
        success: true,
        message: 'Cartão removido com sucesso',
      });
    } catch (error: any) {
      console.error('[CartoesController.remover] Erro:', error);

      if (error.message?.includes('não encontrado')) {
        return res.status(404).json({
          success: false,
          code: 'CARD_NOT_FOUND',
          message: 'Cartão não encontrado',
        });
      }

      if (error.message?.includes('cartão padrão')) {
        return res.status(400).json({
          success: false,
          code: 'CANNOT_REMOVE_DEFAULT_CARD',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        code: 'REMOVE_CARD_ERROR',
        message: 'Erro ao remover cartão',
        error: error?.message,
      });
    }
  };

  /**
   * POST /api/v1/empresas/cartoes/:id/pagar-pendente
   * Paga fatura pendente usando um cartão específico
   */
  static pagarPendente = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token de autorização necessário',
        });
      }

      const { role, id: usuarioId } = req.user;
      const { id: cartaoId } = req.params;

      // Apenas empresas podem acessar
      if (role !== Roles.EMPRESA) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Este endpoint é exclusivo para empresas',
        });
      }

      if (!cartaoId) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_CARD_ID',
          message: 'ID do cartão é obrigatório',
        });
      }

      // 1. Verificar se há plano suspenso (pagamento pendente)
      const plano = await prisma.empresasPlano.findFirst({
        where: {
          usuarioId,
          status: EmpresasPlanoStatus.SUSPENSO,
        },
        include: {
          PlanosEmpresariais: {
            select: {
              nome: true,
              valor: true,
            },
          },
        },
      });

      if (!plano) {
        return res.status(400).json({
          success: false,
          code: 'NO_PENDING_PAYMENT',
          message: 'Nenhum pagamento pendente encontrado',
        });
      }

      // 2. Processar cobrança
      const valor = parseFloat(plano.PlanosEmpresariais.valor);
      const descricao = `Pagamento atrasado - ${plano.PlanosEmpresariais.nome}`;

      const result = await cobrancaAutomaticaService.cobrarCartaoSalvo({
        planoId: plano.id,
        cartaoId,
        valor,
        descricao,
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            pagamento: {
              id: result.paymentId,
              status: result.status,
              valor,
            },
            plano: {
              status: 'ATIVO',
              proximaCobranca: plano.proximaCobranca,
            },
          },
        });
      } else {
        res.status(400).json({
          success: false,
          code: 'PAYMENT_FAILED',
          message: result.error || 'Falha ao processar pagamento',
        });
      }
    } catch (error: any) {
      console.error('[CartoesController.pagarPendente] Erro:', error);

      if (error.message?.includes('não encontrado')) {
        return res.status(404).json({
          success: false,
          code: 'CARD_NOT_FOUND',
          message: 'Cartão não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PAY_PENDING_ERROR',
        message: 'Erro ao processar pagamento pendente',
        error: error?.message,
      });
    }
  };
}

