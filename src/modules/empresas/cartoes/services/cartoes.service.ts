import { Customer, CustomerCard } from 'mercadopago';
import { mpClient, assertMercadoPagoConfigured } from '@/config/mercadopago';
import { prisma } from '@/config/prisma';

interface CartaoSalvo {
  id: string;
  ultimos4Digitos: string;
  bandeira: string;
  nomeNoCartao: string;
  mesExpiracao: string;
  anoExpiracao: string;
  isPadrao: boolean;
  criadoEm: Date;
  mpCardId: string;
}

/**
 * Service para gerenciar cartões de empresas
 */
export const cartoesService = {
  /**
   * Lista todos os cartões ativos da empresa
   */
  async listar(empresaId: string): Promise<CartaoSalvo[]> {
    const cartoes = await prisma.$queryRaw<CartaoSalvo[]>`
      SELECT 
        id,
        "ultimos4Digitos",
        bandeira,
        "nomeNoCartao",
        "mesExpiracao",
        "anoExpiracao",
        "isPadrao",
        "criadoEm",
        "mpCardId",
        tipo,
        "falhasConsecutivas"
      FROM "EmpresasCartoes"
      WHERE "usuarioId" = ${empresaId}
        AND ativo = TRUE
      ORDER BY "isPadrao" DESC, "criadoEm" DESC
    `;

    return cartoes;
  },

  /**
   * Adiciona um novo cartão para a empresa
   */
  async adicionar(
    empresaId: string,
    cardToken: string,
    isPadrao = false,
    tipo: 'credito' | 'debito' = 'credito',
  ): Promise<CartaoSalvo> {
    assertMercadoPagoConfigured();

    // 0. Verificar limite de 5 cartões
    const totalCartoes = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM "EmpresasCartoes"
      WHERE "usuarioId" = ${empresaId}
        AND ativo = TRUE
    `;

    const total = Number(totalCartoes[0].count);

    if (total >= 5) {
      throw new Error(
        'Limite de 5 cartões atingido. Remova um cartão antes de adicionar outro.',
      );
    }

    // 1. Buscar dados da empresa
    const empresaResult = await prisma.$queryRaw<any[]>`
      SELECT 
        id, 
        "nomeCompleto", 
        email, 
        cnpj,
        "mpCustomerId"
      FROM "Usuarios"
      WHERE id = ${empresaId}
      LIMIT 1
    `;

    if (!empresaResult || empresaResult.length === 0) {
      throw new Error('Empresa não encontrada');
    }

    const empresa = empresaResult[0];

    // 2. Criar ou obter customer no Mercado Pago
    let mpCustomerId = empresa.mpCustomerId;

    if (!mpCustomerId) {
      const customerApi = new Customer(mpClient!);
      const customerData = {
        email: empresa.email,
        first_name: empresa.nomeCompleto,
        identification: {
          type: 'CNPJ' as const,
          number: empresa.cnpj?.replace(/\D/g, '') || '',
        },
      };

      const customer = await customerApi.create({ body: customerData });
      mpCustomerId = customer.id!;

      // Salvar customer_id na empresa
      await prisma.$executeRaw`
        UPDATE "Usuarios"
        SET "mpCustomerId" = ${mpCustomerId}
        WHERE id = ${empresaId}
      `;
    }

    // 3. Adicionar cartão ao customer
    const customerCardApi = new CustomerCard(mpClient!);
    const card = await customerCardApi.create({
      customerId: mpCustomerId,
      body: { token: cardToken },
    });

    if (!card.id) {
      throw new Error('Falha ao criar cartão no Mercado Pago');
    }

    // 3.5. Validar cartão com transação de R$ 1,00 (e estornar)
    let cartaoValidado = false;
    try {
      const { Payment } = await import('mercadopago');
      const paymentApi = new Payment(mpClient!);

      // Fazer cobrança de R$ 1,00 para validar
      const validacao = await paymentApi.create({
        body: {
          transaction_amount: 1.0,
          description: 'Validação de cartão',
          payment_method_id: card.payment_method?.id || 'credit_card',
          payer: {
            id: mpCustomerId,
            type: 'customer' as const,
          },
          token: card.id,
        },
      });

      if (validacao.status === 'approved' && validacao.id) {
        cartaoValidado = true;

        // Estornar imediatamente
        try {
          const { PaymentRefund } = await import('mercadopago');
          const refundApi = new PaymentRefund(mpClient!);
          await refundApi.create({
            payment_id: validacao.id,
            body: {},
          });
        } catch (refundError) {
          console.warn('[validação] Falha ao estornar, mas cartão é válido:', refundError);
          // Continua mesmo se estorno falhar - cartão é válido
        }
      } else {
        // Cartão foi recusado na validação
        await customerCardApi.remove({
          customerId: mpCustomerId,
          cardId: card.id,
        });

        throw new Error(`Cartão recusado na validação: ${validacao.status_detail || 'motivo desconhecido'}`);
      }
    } catch (validacaoError: any) {
      // Se a validação falhar, remover o cartão
      try {
        await customerCardApi.remove({
          customerId: mpCustomerId,
          cardId: card.id,
        });
      } catch (removeError) {
        console.error('[validação] Falha ao remover cartão inválido:', removeError);
      }

      throw new Error(`Falha ao validar cartão: ${validacaoError.message}`);
    }

    // 4. Mapear dados do cartão
    const bandeira = this.mapearBandeira(card.payment_method?.id || 'unknown');
    const ultimos4Digitos = card.last_four_digits || '0000';
    const nomeNoCartao = card.cardholder?.name || 'Nome não disponível';
    const mesExpiracao = card.expiration_month?.toString().padStart(2, '0') || '00';
    const anoExpiracao = card.expiration_year?.toString() || '0000';

    // 5. Se for definir como padrão, remover padrão dos outros
    if (isPadrao) {
      await prisma.$executeRaw`
        UPDATE "EmpresasCartoes"
        SET "isPadrao" = FALSE
        WHERE "usuarioId" = ${empresaId}
          AND "isPadrao" = TRUE
          AND ativo = TRUE
      `;
    }

    // 6. Mapear dados do cartão
    const paymentMethodId = card.payment_method?.id || 'unknown';

    // 7. Salvar no banco
    const result = await prisma.$queryRaw<CartaoSalvo[]>`
      INSERT INTO "EmpresasCartoes" (
        "usuarioId",
        "mpCustomerId",
        "mpCardId",
        "ultimos4Digitos",
        bandeira,
        "nomeNoCartao",
        "mesExpiracao",
        "anoExpiracao",
        "isPadrao",
        ativo,
        tipo,
        "paymentMethodId",
        "validadoEm",
        "falhasConsecutivas"
      ) VALUES (
        ${empresaId},
        ${mpCustomerId},
        ${card.id},
        ${ultimos4Digitos},
        ${bandeira},
        ${nomeNoCartao},
        ${mesExpiracao},
        ${anoExpiracao},
        ${isPadrao},
        TRUE,
        ${tipo},
        ${paymentMethodId},
        ${cartaoValidado ? new Date() : null},
        0
      )
      RETURNING 
        id,
        "ultimos4Digitos",
        bandeira,
        "nomeNoCartao",
        "mesExpiracao",
        "anoExpiracao",
        "isPadrao",
        "criadoEm",
        "mpCardId",
        tipo,
        "falhasConsecutivas"
    `;

    return result[0];
  },

  /**
   * Define um cartão como padrão
   */
  async definirPadrao(empresaId: string, cartaoId: string): Promise<void> {
    // Verificar se o cartão existe e pertence à empresa
    const cartao = await prisma.$queryRaw<any[]>`
      SELECT id FROM "EmpresasCartoes"
      WHERE id = ${cartaoId}
        AND "usuarioId" = ${empresaId}
        AND ativo = TRUE
      LIMIT 1
    `;

    if (!cartao || cartao.length === 0) {
      throw new Error('Cartão não encontrado');
    }

    // Remover padrão de todos os outros
    await prisma.$executeRaw`
      UPDATE "EmpresasCartoes"
      SET "isPadrao" = FALSE
      WHERE "usuarioId" = ${empresaId}
        AND "isPadrao" = TRUE
        AND ativo = TRUE
    `;

    // Definir este como padrão
    await prisma.$executeRaw`
      UPDATE "EmpresasCartoes"
      SET "isPadrao" = TRUE, "atualizadoEm" = CURRENT_TIMESTAMP
      WHERE id = ${cartaoId}
    `;
  },

  /**
   * Remove um cartão (soft delete)
   */
  async remover(empresaId: string, cartaoId: string): Promise<void> {
    // Verificar se o cartão existe e pertence à empresa
    const cartao = await prisma.$queryRaw<any[]>`
      SELECT id, "isPadrao", "mpCustomerId", "mpCardId"
      FROM "EmpresasCartoes"
      WHERE id = ${cartaoId}
        AND "usuarioId" = ${empresaId}
        AND ativo = TRUE
      LIMIT 1
    `;

    if (!cartao || cartao.length === 0) {
      throw new Error('Cartão não encontrado');
    }

    const cartaoData = cartao[0];

    // Se for o padrão, verificar se existem outros cartões
    if (cartaoData.isPadrao) {
      const totalCartoes = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM "EmpresasCartoes"
        WHERE "usuarioId" = ${empresaId}
          AND ativo = TRUE
      `;

      const total = Number(totalCartoes[0].count);

      if (total > 1) {
        throw new Error(
          'Não é possível remover o cartão padrão. Defina outro cartão como padrão primeiro.',
        );
      }
    }

    // Tentar remover do Mercado Pago
    try {
      assertMercadoPagoConfigured();
      const customerCardApi = new CustomerCard(mpClient!);
      await customerCardApi.remove({
        customerId: cartaoData.mpCustomerId,
        cardId: cartaoData.mpCardId,
      });
    } catch (error) {
      console.error('[cartoesService.remover] Erro ao remover do Mercado Pago:', error);
      // Continua com soft delete mesmo se falhar no MP
    }

    // Soft delete no banco
    await prisma.$executeRaw`
      UPDATE "EmpresasCartoes"
      SET ativo = FALSE, "atualizadoEm" = CURRENT_TIMESTAMP
      WHERE id = ${cartaoId}
    `;
  },

  /**
   * Busca o cartão padrão da empresa
   */
  async buscarPadrao(empresaId: string): Promise<CartaoSalvo | null> {
    const result = await prisma.$queryRaw<CartaoSalvo[]>`
      SELECT 
        id,
        "ultimos4Digitos",
        bandeira,
        "nomeNoCartao",
        "mesExpiracao",
        "anoExpiracao",
        "isPadrao",
        "criadoEm",
        "mpCardId"
      FROM "EmpresasCartoes"
      WHERE "usuarioId" = ${empresaId}
        AND "isPadrao" = TRUE
        AND ativo = TRUE
      LIMIT 1
    `;

    return result[0] || null;
  },

  /**
   * Mapeia o payment_method_id do Mercado Pago para nome legível da bandeira
   */
  mapearBandeira(paymentMethodId: string): string {
    const mapping: Record<string, string> = {
      visa: 'Visa',
      master: 'Mastercard',
      mastercard: 'Mastercard',
      amex: 'American Express',
      elo: 'Elo',
      hipercard: 'Hipercard',
      diners: 'Diners Club',
      discover: 'Discover',
    };

    return mapping[paymentMethodId.toLowerCase()] || paymentMethodId;
  },
};

