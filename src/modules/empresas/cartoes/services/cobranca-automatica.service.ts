import { Payment, PaymentRefund } from 'mercadopago';
import { mpClient, assertMercadoPagoConfigured } from '@/config/mercadopago';
import { prisma } from '@/config/prisma';
import { EmpresasPlanoStatus, STATUS_PAGAMENTO } from '@prisma/client';
import { mercadopagoConfig } from '@/config/env';
import { assinaturasService } from '@/modules/mercadopago/assinaturas/services/assinaturas.service';

// Helper functions para manipulação de datas
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface CobrancaResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  error?: string;
}

interface CartaoParaCobranca {
  id: string;
  mpCustomerId: string;
  mpCardId: string;
  ultimos4Digitos: string;
  bandeira: string;
  isPadrao: boolean;
  falhasConsecutivas: number;
}

/**
 * Service para processar cobranças automáticas recorrentes
 */
export const cobrancaAutomaticaService = {
  /**
   * Cobra um plano usando um cartão específico
   */
  async cobrarCartaoSalvo(params: {
    planoId: string;
    cartaoId: string;
    valor: number;
    descricao: string;
  }): Promise<CobrancaResult> {
    assertMercadoPagoConfigured();

    const { planoId, cartaoId, valor, descricao } = params;

    // 1. Buscar cartão
    const cartoes = await prisma.$queryRaw<CartaoParaCobranca[]>`
      SELECT 
        id,
        "mpCustomerId",
        "mpCardId",
        "ultimos4Digitos",
        bandeira,
        "isPadrao",
        "falhasConsecutivas"
      FROM "EmpresasCartoes"
      WHERE id = ${cartaoId}
        AND ativo = TRUE
      LIMIT 1
    `;

    if (!cartoes || cartoes.length === 0) {
      throw new Error('Cartão não encontrado ou inativo');
    }

    const cartao = cartoes[0];

    // 2. Criar idempotency key (evita cobranças duplicadas)
    const idempotencyKey = `${planoId}-${new Date().toISOString().split('T')[0]}`;

    // 3. Processar pagamento
    try {
      const paymentApi = new Payment(mpClient!);
      const payment = await paymentApi.create({
        body: {
          transaction_amount: valor,
          description: descricao,
          payment_method_id: 'credit_card',
          payer: {
            id: cartao.mpCustomerId,
            type: 'customer' as const,
          },
          token: cartao.mpCardId,
        },
        requestOptions: {
          idempotencyKey,
        },
      });

      // 4. Processar resultado
      if (payment.status === 'approved') {
        // ✅ SUCESSO
        await this.processarPagamentoAprovado(planoId, cartaoId, String(payment.id!));

        await assinaturasService.logEvent({
          empresasPlanoId: planoId,
          tipo: 'COBRANCA_AUTOMATICA_SUCESSO',
          status: 'APROVADO',
          mpResourceId: payment.id!.toString(),
          payload: payment,
        });

        return {
          success: true,
          paymentId: payment.id!.toString(),
          status: payment.status,
        };
      } else {
        // ❌ FALHA
        await this.processarPagamentoFalhado(planoId, cartaoId, payment.status_detail || 'unknown');

        await assinaturasService.logEvent({
          empresasPlanoId: planoId,
          tipo: 'COBRANCA_AUTOMATICA_FALHA',
          status: 'RECUSADO',
          mpResourceId: payment.id?.toString() || null,
          payload: payment,
          mensagem: payment.status_detail || 'Pagamento recusado',
        });

        return {
          success: false,
          status: payment.status,
          error: payment.status_detail || 'Pagamento recusado',
        };
      }
    } catch (error: any) {
      // Erro na comunicação com MP
      await this.processarPagamentoFalhado(planoId, cartaoId, error.message);

      await assinaturasService.logEvent({
        empresasPlanoId: planoId,
        tipo: 'COBRANCA_AUTOMATICA_ERRO',
        status: 'ERRO',
        mensagem: error.message,
      });

      throw error;
    }
  },

  /**
   * Tenta cobrar usando múltiplos cartões (fallback)
   */
  async cobrarComFallback(planoId: string, valor: number, descricao: string): Promise<CobrancaResult> {
    // 1. Buscar plano
    const plano = await prisma.empresasPlano.findUnique({
      where: { id: planoId },
      select: { usuarioId: true, planosEmpresariaisId: true },
    });

    if (!plano) {
      throw new Error('Plano não encontrado');
    }

    // 2. Buscar cartões ordenados (padrão primeiro, depois por data)
    const cartoes = await prisma.$queryRaw<CartaoParaCobranca[]>`
      SELECT 
        id,
        "mpCustomerId",
        "mpCardId",
        "ultimos4Digitos",
        bandeira,
        "isPadrao",
        "falhasConsecutivas"
      FROM "EmpresasCartoes"
      WHERE "usuarioId" = ${plano.usuarioId}
        AND ativo = TRUE
      ORDER BY "isPadrao" DESC, "falhasConsecutivas" ASC, "criadoEm" ASC
      LIMIT 5
    `;

    if (cartoes.length === 0) {
      throw new Error('Nenhum cartão cadastrado para cobrança automática');
    }

    await assinaturasService.logEvent({
      usuarioId: plano.usuarioId,
      empresasPlanoId: planoId,
      tipo: 'COBRANCA_AUTOMATICA_TENTATIVA',
      status: 'INICIADO',
      mensagem: `Tentando cobrar ${cartoes.length} cartão(ões)`,
    });

    // 3. Tentar cada cartão até um funcionar
    const erros: string[] = [];

    for (let i = 0; i < cartoes.length; i++) {
      const cartao = cartoes[i];

      console.log(
        `[CobrançaAutomática] Tentando cartão ${i + 1}/${cartoes.length}: **** ${cartao.ultimos4Digitos} (${cartao.bandeira})`,
      );

      try {
        const result = await this.cobrarCartaoSalvo({
          planoId,
          cartaoId: cartao.id,
          valor,
          descricao,
        });

        if (result.success) {
          console.log(`[CobrançaAutomática] ✅ Sucesso com cartão **** ${cartao.ultimos4Digitos}`);
          return result;
        }

        erros.push(`Cartão **** ${cartao.ultimos4Digitos}: ${result.error}`);
      } catch (error: any) {
        console.error(
          `[CobrançaAutomática] ❌ Erro com cartão **** ${cartao.ultimos4Digitos}:`,
          error.message,
        );
        erros.push(`Cartão **** ${cartao.ultimos4Digitos}: ${error.message}`);
        continue;
      }
    }

    // 4. Todos os cartões falharam - suspender plano
    const graceDays = mercadopagoConfig.settings.graceDays || 5;
    const graceUntil = addDays(new Date(), graceDays);

    await prisma.empresasPlano.update({
      where: { id: planoId },
      data: {
        status: EmpresasPlanoStatus.SUSPENSO,
        statusPagamento: STATUS_PAGAMENTO.RECUSADO,
        graceUntil,
      },
    });

    await assinaturasService.logEvent({
      usuarioId: plano.usuarioId,
      empresasPlanoId: planoId,
      tipo: 'COBRANCA_AUTOMATICA_FALHA_TOTAL',
      status: 'SUSPENSO',
      mensagem: `Todos os ${cartoes.length} cartões falharam. Plano suspenso até ${graceUntil.toISOString()}`,
    });

    throw new Error(`Todos os cartões falharam: ${erros.join('; ')}`);
  },

  /**
   * Processa pagamento aprovado
   */
  async processarPagamentoAprovado(planoId: string, cartaoId: string, paymentId: string): Promise<void> {
    // Atualizar plano
    await prisma.empresasPlano.update({
      where: { id: planoId },
      data: {
        status: EmpresasPlanoStatus.ATIVO,
        statusPagamento: STATUS_PAGAMENTO.APROVADO,
        mpPaymentId: paymentId,
        proximaCobranca: addMonths(new Date(), 1),
        graceUntil: null,
      },
    });

    // Resetar falhas do cartão
    await prisma.$executeRaw`
      UPDATE "EmpresasCartoes"
      SET "falhasConsecutivas" = 0,
          "atualizadoEm" = CURRENT_TIMESTAMP
      WHERE id = ${cartaoId}
    `;
  },

  /**
   * Processa pagamento falhado
   */
  async processarPagamentoFalhado(planoId: string, cartaoId: string, motivo: string): Promise<void> {
    // Incrementar falhas do cartão
    await prisma.$executeRaw`
      UPDATE "EmpresasCartoes"
      SET "falhasConsecutivas" = "falhasConsecutivas" + 1,
          "ultimaFalhaEm" = CURRENT_TIMESTAMP,
          "atualizadoEm" = CURRENT_TIMESTAMP
      WHERE id = ${cartaoId}
    `;

    console.log(`[CobrançaAutomática] Cartão ${cartaoId} falhou: ${motivo}`);
  },

  /**
   * Busca planos que vencem hoje e precisam ser cobrados
   */
  async buscarPlanosParaCobrar(): Promise<any[]> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const planos = await prisma.empresasPlano.findMany({
      where: {
        status: EmpresasPlanoStatus.ATIVO,
        metodoPagamento: 'CARTAO_CREDITO',
        proximaCobranca: {
          gte: hoje,
          lt: amanha,
        },
      },
      include: {
        PlanosEmpresariais: {
          select: {
            id: true,
            nome: true,
            valor: true,
          },
        },
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    return planos;
  },
};

