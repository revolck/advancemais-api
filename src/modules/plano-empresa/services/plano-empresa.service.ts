import { prisma } from "../../../config/prisma";
import { PlanCategory, VagaStatus } from "../enums";
import { PlanFrequencyType } from "../../empresa/enums";
import { MercadoPagoClient } from "../../mercadopago/client/mercadopago-client";
import { ClientType, CurrencyId } from "../../mercadopago/enums";
import { mercadoPagoConfig } from "../../../config/env";

interface CreatePlanoEmpresa {
  nome: string;
  icone?: string;
  categoria: PlanCategory;
  valor: number;
  desconto?: number;
  descricao: string;
  limiteVagasAtivas?: number | null;
  limiteVagasDestaque?: number | null;
  billingDay?: number;
}

interface UpdatePlanoEmpresa extends Partial<CreatePlanoEmpresa> {}

const DEFAULT_LIMITS: Record<PlanCategory, { vagas: number | null; destaque: number | null }> = {
  [PlanCategory.INICIAL]: { vagas: 3, destaque: 0 },
  [PlanCategory.INTERMEDIARIO]: { vagas: 10, destaque: 0 },
  [PlanCategory.AVANCADO]: { vagas: 20, destaque: 0 },
  [PlanCategory.DESTAQUE]: { vagas: null, destaque: 1 },
};

export const planoEmpresaService = {
  list: () => prisma.mercadoPagoPlan.findMany(),
  get: (id: string) => prisma.mercadoPagoPlan.findUnique({ where: { id } }),
  create: async (data: CreatePlanoEmpresa) => {
    const limits = DEFAULT_LIMITS[data.categoria];
    const mpClient = MercadoPagoClient.getInstance(ClientType.SUBSCRIPTIONS);
    const headers = {
      Authorization: `Bearer ${mpClient.getClient().accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": mpClient.generateNewIdempotencyKey(),
    };

    const billingDay =
      data.billingDay ?? mercadoPagoConfig.subscriptionConfig.defaultBillingDay;

    const mpPayload = {
      reason: data.nome,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: data.valor,
        currency_id: CurrencyId.BRL,
        billing_day: billingDay,
        billing_day_proportional: mercadoPagoConfig.subscriptionConfig.billingDayProportional,
      },
      back_url:
        process.env.FRONTEND_URL || mercadoPagoConfig.notificationUrl || "",
    };

    const response = await fetch(
      "https://api.mercadopago.com/preapproval_plan",
      {
        method: "POST",
        headers,
        body: JSON.stringify(mpPayload),
      }
    );

    const mpData = await response.json();

    if (!response.ok) {
      throw new Error(
        mpData?.message || "Erro ao criar plano no MercadoPago"
      );
    }

    const frequencyType =
      mpData.auto_recurring?.frequency_type === "days"
        ? PlanFrequencyType.DIAS
        : PlanFrequencyType.MESES;

    return prisma.mercadoPagoPlan.create({
      data: {
        nome: data.nome,
        icone: data.icone,
        categoria: data.categoria,
        valor: data.valor,
        desconto: data.desconto ?? 0,
        descricao: data.descricao,
        recursos: [],
        ativo: true,
        limiteVagasAtivas: data.limiteVagasAtivas ?? limits.vagas,
        limiteVagasDestaque: data.limiteVagasDestaque ?? limits.destaque,
        frequency: mpData.auto_recurring?.frequency ?? 1,
        frequencyType,
        repetitions: mpData.auto_recurring?.repetitions ?? null,
        billingDay: mpData.auto_recurring?.billing_day ?? billingDay,
        billingDayProportional:
          mpData.auto_recurring?.billing_day_proportional ??
          mercadoPagoConfig.subscriptionConfig.billingDayProportional,
        mercadoPagoPlanId: mpData.id,
      },
    });
  },
  update: (id: string, data: UpdatePlanoEmpresa) =>
    prisma.mercadoPagoPlan.update({
      where: { id },
      data,
    }),
  remove: (id: string) => prisma.mercadoPagoPlan.delete({ where: { id } }),

  /**
   * Verifica se a empresa ainda possui vagas disponíveis no limite do plano.
   * Somente vagas em análise, publicadas ou em revisão são contabilizadas.
   */
  canPublishVaga: async (empresaId: string, destaque = false) => {
    const empresaPlano = await prisma.empresaPlano.findUnique({
      where: { empresaId },
      include: { plano: true },
    });

    if (!empresaPlano) return false;

    const limite = destaque
      ? empresaPlano.plano.limiteVagasDestaque
      : empresaPlano.plano.limiteVagasAtivas;

    if (limite === null) return true;

    const count = await (prisma as any).vaga.count({
      where: {
        empresaId,
        status: {
          in: [
            VagaStatus.EM_ANALISE,
            VagaStatus.PUBLICADO,
            VagaStatus.REVISAO,
          ],
        },
        ...(destaque ? { destaque: true } : {}),
      },
    });

    return count < limite;
  },

  /**
   * Define todas as vagas da empresa como rascunho (utilizado em downgrades).
   */
  applyDowngrade: (empresaId: string) =>
    (prisma as any).vaga.updateMany({
      where: {
        empresaId,
        status: {
          in: [
            VagaStatus.EM_ANALISE,
            VagaStatus.PUBLICADO,
            VagaStatus.REVISAO,
          ],
        },
      },
      data: { status: VagaStatus.RASCUNHO },
    }),
};
