import { prisma } from '@/config/prisma';
import { mpClient, assertMercadoPagoConfigured } from '@/config/mercadopago';
import { mercadopagoConfig, serverConfig } from '@/config/env';
import { PreApproval, PreApprovalPlan, Payment, Preference } from 'mercadopago';
import crypto from 'crypto';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import {
  METODO_PAGAMENTO,
  MODELO_PAGAMENTO,
  STATUS_PAGAMENTO,
  StatusDeVagas,
  EmpresasPlanoStatus,
  EmpresasPlanoModo,
  CuponsAplicarEm,
  CuponsLimiteUso,
  CuponsPeriodo,
  WebsiteStatus,
} from '@prisma/client';
import type { PlanosEmpresariais } from '@prisma/client';
import { EmailService } from '@/modules/brevo/services/email-service';
import { EmailTemplates } from '@/modules/brevo/templates/email-templates';
import { logger } from '@/utils/logger';
import type { StartCheckoutInput } from '@/modules/mercadopago/assinaturas/validators/assinaturas.schema';

// Tipo para resultado da validação de cupom
type CupomValidado = {
  valido: boolean;
  cupomId?: string;
  tipoDesconto?: 'PORCENTAGEM' | 'VALOR_FIXO';
  valorPercentual?: number;
  valorFixo?: number;
  erro?: string;
  mensagem?: string;
};

// Função para validar e calcular desconto do cupom
async function validarECalcularDesconto(
  cupomCodigo: string | undefined,
  planosEmpresariaisId: string,
  usuarioId: string,
  valorOriginal: number,
): Promise<{ valorFinal: number; desconto: number; cupomId: string | null; cupomInfo: CupomValidado | null }> {
  if (!cupomCodigo) {
    return { valorFinal: valorOriginal, desconto: 0, cupomId: null, cupomInfo: null };
  }

  const codigoNormalizado = cupomCodigo.trim().toUpperCase();

  const cupom = await prisma.cuponsDesconto.findUnique({
    where: { codigo: codigoNormalizado },
    include: {
      CuponsDescontoPlanos: true,
    },
  });

  if (!cupom) {
    return {
      valorFinal: valorOriginal,
      desconto: 0,
      cupomId: null,
      cupomInfo: { valido: false, erro: 'CUPOM_NAO_ENCONTRADO', mensagem: 'Cupom não encontrado' },
    };
  }

  // Verificar se o cupom está ativo
  if (cupom.status !== WebsiteStatus.PUBLICADO) {
    return {
      valorFinal: valorOriginal,
      desconto: 0,
      cupomId: null,
      cupomInfo: { valido: false, erro: 'CUPOM_INATIVO', mensagem: 'Este cupom não está mais ativo' },
    };
  }

  // Verificar período de validade
  const agora = new Date();
  if (cupom.periodoTipo === CuponsPeriodo.PERIODO) {
    if (cupom.periodoInicio && agora < cupom.periodoInicio) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: { valido: false, erro: 'CUPOM_AINDA_NAO_VALIDO', mensagem: 'Este cupom ainda não está válido' },
      };
    }
    if (cupom.periodoFim && agora > cupom.periodoFim) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: { valido: false, erro: 'CUPOM_EXPIRADO', mensagem: 'Este cupom já expirou' },
      };
    }
  }

  // Verificar limite de uso total
  if (cupom.limiteUsoTotalTipo === CuponsLimiteUso.LIMITADO) {
    if (cupom.limiteUsoTotalQuantidade && cupom.usosTotais >= cupom.limiteUsoTotalQuantidade) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: { valido: false, erro: 'CUPOM_ESGOTADO', mensagem: 'Este cupom já atingiu o limite de uso' },
      };
    }
  }

  // Verificar se o cupom se aplica a planos empresariais
  if (cupom.aplicarEm === CuponsAplicarEm.APENAS_CURSOS) {
    return {
      valorFinal: valorOriginal,
      desconto: 0,
      cupomId: null,
      cupomInfo: { valido: false, erro: 'CUPOM_NAO_APLICAVEL', mensagem: 'Este cupom é válido apenas para cursos' },
    };
  }

  // Verificar se o cupom se aplica ao plano específico
  if (cupom.aplicarEm === CuponsAplicarEm.APENAS_ASSINATURA && !cupom.aplicarEmTodosItens) {
    const planoVinculado = cupom.CuponsDescontoPlanos.find((p) => p.planoId === planosEmpresariaisId);
    if (!planoVinculado) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: {
          valido: false,
          erro: 'CUPOM_NAO_APLICAVEL_PLANO',
          mensagem: 'Este cupom não é válido para o plano selecionado',
        },
      };
    }
  }

  // Calcular desconto
  let desconto = 0;
  const tipoDesconto = cupom.tipoDesconto;

  if (tipoDesconto === 'PORCENTAGEM' && cupom.valorPorcentagem) {
    const percentual = Number(cupom.valorPorcentagem);
    desconto = valorOriginal * (percentual / 100);
  } else if (tipoDesconto === 'VALOR_FIXO' && cupom.valorFixo) {
    desconto = Number(cupom.valorFixo);
  }

  // Desconto não pode ser maior que o valor original
  desconto = Math.min(desconto, valorOriginal);
  // Arredondar para 2 casas decimais
  desconto = Math.round(desconto * 100) / 100;

  const valorFinal = Math.round((valorOriginal - desconto) * 100) / 100;

  return {
    valorFinal,
    desconto,
    cupomId: cupom.id,
    cupomInfo: {
      valido: true,
      cupomId: cupom.id,
      tipoDesconto: tipoDesconto as 'PORCENTAGEM' | 'VALOR_FIXO',
      valorPercentual: cupom.valorPorcentagem ? Number(cupom.valorPorcentagem) : undefined,
      valorFixo: cupom.valorFixo ? Number(cupom.valorFixo) : undefined,
    },
  };
}

type MercadoPagoResponse<T = any> = {
  body?: T;
  [key: string]: any;
};

type CheckoutPagamento = NonNullable<StartCheckoutInput['pagamento']>;

type PlanosEmpresariaisSnapshot = {
  id: string;
  usuarioId: string;
  planosEmpresariaisId: string;
  modo: null;
  status: EmpresasPlanoStatus;
  inicio: Date | null;
  fim: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  modeloPagamento: MODELO_PAGAMENTO;
  metodoPagamento: METODO_PAGAMENTO;
  statusPagamento: STATUS_PAGAMENTO;
  mpPreapprovalId: string | null;
  mpSubscriptionId: string | null;
  mpPayerId: string | null;
  mpPaymentId: string | null;
  proximaCobranca: Date | null;
  graceUntil: Date | null;
  plano: PlanosEmpresariais;
};

const pagamentoToMetodo: Record<CheckoutPagamento, METODO_PAGAMENTO> = {
  pix: METODO_PAGAMENTO.PIX,
  card: METODO_PAGAMENTO.CARTAO_CREDITO,
  boleto: METODO_PAGAMENTO.BOLETO,
};

const PAYMENT_APPROVED_STATUSES = new Set([
  'approved',
  'accredited',
  'authorized',
  'authorized_for_collect',
  'active',
]);
const PAYMENT_PENDING_STATUSES = new Set(['pending', 'in_process']);
const PAYMENT_REJECTED_STATUSES = new Set(['rejected', 'charged_back', 'chargeback']);
const PAYMENT_CANCELLED_STATUSES = new Set([
  'cancelled',
  'cancelled_by_collector',
  'cancelled_by_user',
  'expired',
]);

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function sanitizeDigits(value?: string | null) {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

function splitName(fullName?: string | null) {
  if (!fullName) return { firstName: undefined, lastName: undefined };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: undefined, lastName: undefined };
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.length ? rest.join(' ') : undefined };
}

function mapToStatusPagamento(status: string | null | undefined): STATUS_PAGAMENTO {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  if (PAYMENT_APPROVED_STATUSES.has(normalized)) return STATUS_PAGAMENTO.APROVADO;
  if (PAYMENT_PENDING_STATUSES.has(normalized)) return STATUS_PAGAMENTO.EM_PROCESSAMENTO;
  if (PAYMENT_CANCELLED_STATUSES.has(normalized)) return STATUS_PAGAMENTO.CANCELADO;
  if (PAYMENT_REJECTED_STATUSES.has(normalized)) return STATUS_PAGAMENTO.RECUSADO;
  return STATUS_PAGAMENTO.PENDENTE;
}

async function createOrUpdateCheckoutEmpresasPlano(params: {
  checkoutId: string;
  usuarioId: string;
  planosEmpresariaisId: string;
  metodoPagamento: METODO_PAGAMENTO;
  modeloPagamento: MODELO_PAGAMENTO;
  statusPagamento: STATUS_PAGAMENTO;
  observacao?: string;
  status?: EmpresasPlanoStatus;
  inicio?: Date | null;
  fim?: Date | null;
  proximaCobranca?: Date | null;
  graceUntil?: Date | null;
  mpPreapprovalId?: string | null;
  mpSubscriptionId?: string | null;
  mpPayerId?: string | null;
  mpPaymentId?: string | null;
  // Aceite de termos
  aceitouTermos?: boolean;
  aceitouTermosIp?: string | null;
  aceitouTermosUserAgent?: string | null;
  // Cupom de desconto
  cupomDescontoId?: string | null;
  cupomDescontoCodigo?: string | null;
  valorOriginal?: number | null;
  valorDesconto?: number | null;
  valorFinal?: number | null;
}) {
  const data = {
    usuarioId: params.usuarioId,
    planosEmpresariaisId: params.planosEmpresariaisId,
    status: params.status ?? EmpresasPlanoStatus.SUSPENSO,
    origin: 'CHECKOUT' as any,
    modeloPagamento: params.modeloPagamento,
    metodoPagamento: params.metodoPagamento,
    statusPagamento: params.statusPagamento,
    inicio: params.inicio ?? null,
    fim: params.fim ?? null,
    proximaCobranca: params.proximaCobranca ?? null,
    graceUntil: params.graceUntil ?? null,
    mpPreapprovalId: params.mpPreapprovalId ?? null,
    mpSubscriptionId: params.mpSubscriptionId ?? null,
    mpPayerId: params.mpPayerId ?? null,
    mpPaymentId: params.mpPaymentId ?? null,
    // Aceite de termos
    aceitouTermos: params.aceitouTermos ?? false,
    aceitouTermosEm: params.aceitouTermos ? new Date() : null,
    aceitouTermosIp: params.aceitouTermosIp ?? null,
    aceitouTermosUserAgent: params.aceitouTermosUserAgent ?? null,
    // Cupom de desconto
    cupomDescontoId: params.cupomDescontoId ?? null,
    cupomDescontoCodigo: params.cupomDescontoCodigo ?? null,
    valorOriginal: params.valorOriginal ?? null,
    valorDesconto: params.valorDesconto ?? null,
    valorFinal: params.valorFinal ?? null,
  };

  return prisma.empresasPlano.upsert({
    where: { id: params.checkoutId },
    create: {
      id: params.checkoutId,
      ...data,
    },
    update: {
      ...data,
      atualizadoEm: new Date(),
    },
  });
}

export function extractInitPoint(result: MercadoPagoResponse): string | null {
  if (!result) return null;
  const body = result.body ?? result;
  return (
    body?.init_point ||
    body?.initPoint ||
    result?.init_point ||
    result?.initPoint ||
    body?.sandbox_init_point ||
    body?.sandboxInitPoint ||
    result?.sandbox_init_point ||
    result?.sandboxInitPoint ||
    null
  );
}

function extractResourceId(result: MercadoPagoResponse): string | null {
  if (!result) return null;
  const body = result.body ?? result;
  return body?.id || body?.preapproval_id || body?.preference_id || result?.id || null;
}

function firstNonEmptyUrl(...urls: (string | null | undefined)[]): string | null {
  for (const url of urls) {
    if (typeof url === 'string') {
      const trimmed = url.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

export function resolveCheckoutReturnUrls(params?: {
  successUrl?: string;
  failureUrl?: string;
  pendingUrl?: string;
}) {
  const overrides = params ?? {};
  const fallbackBase =
    firstNonEmptyUrl(
      mercadopagoConfig.returnUrls.success,
      mercadopagoConfig.returnUrls.pending,
      mercadopagoConfig.returnUrls.failure,
      serverConfig.frontendUrl,
    ) || serverConfig.frontendUrl;

  const success =
    firstNonEmptyUrl(overrides.successUrl, mercadopagoConfig.returnUrls.success, fallbackBase) ||
    fallbackBase;
  const failure =
    firstNonEmptyUrl(
      overrides.failureUrl,
      mercadopagoConfig.returnUrls.failure,
      success,
      fallbackBase,
    ) || success;
  const pending =
    firstNonEmptyUrl(
      overrides.pendingUrl,
      mercadopagoConfig.returnUrls.pending,
      success,
      failure,
      fallbackBase,
    ) || success;

  return { success, failure, pending };
}

function normalizeMercadoPagoError(error: unknown): { message: string; payload?: any } {
  if (error instanceof Error) {
    return {
      message: error.message,
      payload: { name: error.name, message: error.message, stack: error.stack },
    };
  }

  if (error && typeof error === 'object') {
    const errObj = error as any;
    const message =
      errObj?.message ||
      errObj?.description ||
      errObj?.error ||
      errObj?.status_detail ||
      errObj?.response?.data?.message ||
      errObj?.response?.data?.error ||
      errObj?.response?.message ||
      'erro desconhecido';

    const payload = errObj?.response?.data ?? errObj;

    return { message: String(message), payload };
  }

  return { message: String(error ?? 'erro desconhecido'), payload: error };
}

async function setVagasToDraft(usuarioId: string) {
  await prisma.empresasVagas.updateMany({
    where: {
      usuarioId,
      status: { in: [StatusDeVagas.PUBLICADO, StatusDeVagas.EM_ANALISE, StatusDeVagas.PAUSADA] },
    },
    data: { status: StatusDeVagas.RASCUNHO },
  });
}

export const assinaturasService = {
  async logEvent(data: {
    usuarioId?: string | null;
    empresasPlanoId?: string | null;
    tipo: string;
    status?: string | null;
    externalRef?: string | null;
    mpResourceId?: string | null;
    payload?: any;
    mensagem?: string | null;
  }) {
    try {
      await prisma.logsPagamentosDeAssinaturas.create({
        data: {
          usuarioId: data.usuarioId ?? null,
          empresasPlanoId: data.empresasPlanoId ?? null,
          tipo: data.tipo,
          status: data.status ?? null,
          externalRef: data.externalRef ?? null,
          mpResourceId: data.mpResourceId ?? null,
          payload: data.payload ?? undefined,
          mensagem: data.mensagem ?? null,
        },
      });
    } catch (error) {
      // Ignoramos falhas de logging para não interromper o fluxo principal
      void error;
    }
  },
  async ensurePlanPreapproval(planId: string) {
    assertMercadoPagoConfigured();
    const plan = await prisma.planosEmpresariais.findUnique({
      where: { id: planId },
      select: { id: true, nome: true, valor: true, mpPreapprovalPlanId: true },
    });
    if (!plan) throw new Error('PlanosEmpresariais não encontrado');
    if (plan.mpPreapprovalPlanId) return plan.mpPreapprovalPlanId;

    const mp = mpClient!;
    const valor = parseFloat(plan.valor);
    const prePlan = new PreApprovalPlan(mp);
    const created = await prePlan.create({
      body: {
        reason: plan.nome,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: valor,
          currency_id: mercadopagoConfig.settings.defaultCurrency,
        },
      },
    });
    const id = (created as any)?.id as string | undefined;
    if (id) {
      await prisma.planosEmpresariais.update({
        where: { id: plan.id },
        data: { mpPreapprovalPlanId: id },
      });
      return id;
    }
    throw new Error('Falha ao criar PreApprovalPlan no Mercado Pago');
  },
  async ensureEmpresasPlanoFromCheckout(externalRef: string) {
    const existing = await prisma.empresasPlano.findUnique({ where: { id: externalRef } });
    if (existing) return existing;

    const checkoutLog = await prisma.logsPagamentosDeAssinaturas.findFirst({
      where: { externalRef, tipo: 'CHECKOUT_START' },
      orderBy: { criadoEm: 'desc' },
    });

    if (!checkoutLog?.usuarioId) return null;
    const payload = (checkoutLog.payload as any) || {};
    const planosEmpresariaisId = payload.planosEmpresariaisId as string | undefined;
    if (!planosEmpresariaisId) return null;

    const modeloPagamento =
      (payload.modeloPagamento as MODELO_PAGAMENTO | undefined) ?? MODELO_PAGAMENTO.ASSINATURA;
    const metodoPagamento = payload.metodoPagamento as METODO_PAGAMENTO | undefined;
    const created = await prisma.empresasPlano.create({
      data: {
        id: externalRef,
        usuarioId: checkoutLog.usuarioId,
        planosEmpresariaisId,
        modeloPagamento,
        metodoPagamento: metodoPagamento ?? null,
        statusPagamento: STATUS_PAGAMENTO.PENDENTE,
        inicio: null,
        proximaCobranca: null,
        graceUntil: null,
        status: EmpresasPlanoStatus.SUSPENSO,
        origin: 'CHECKOUT' as any,
      },
    });

    const subscriptionLog = await prisma.logsPagamentosDeAssinaturas.findFirst({
      where: { externalRef, tipo: 'PREAPPROVAL_CREATED' },
      orderBy: { criadoEm: 'desc' },
    });

    let updated = created;
    if (subscriptionLog?.mpResourceId) {
      updated = await prisma.empresasPlano.update({
        where: { id: created.id },
        data: { mpSubscriptionId: subscriptionLog.mpResourceId },
      });
    }

    await prisma.logsPagamentosDeAssinaturas.updateMany({
      where: { externalRef },
      data: { empresasPlanoId: created.id },
    });

    return updated;
  },
  async startCheckout(params: StartCheckoutInput) {
    assertMercadoPagoConfigured();

    const planoBase = await prisma.planosEmpresariais.findUnique({
      where: { id: params.planosEmpresariaisId },
    });
    if (!planoBase) {
      throw new Error('PlanosEmpresariais não encontrado');
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: params.usuarioId },
      include: {
        UsuariosEnderecos: { take: 1, orderBy: { criadoEm: 'asc' } },
        UsuariosInformation: { select: { telefone: true } },
      },
    });
    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }

    // Validar e calcular desconto do cupom
    const valorOriginal = parseFloat(planoBase.valor);
    const { valorFinal, desconto, cupomId, cupomInfo } = await validarECalcularDesconto(
      params.cupomCodigo,
      params.planosEmpresariaisId,
      params.usuarioId,
      valorOriginal,
    );

    // Se cupom foi informado mas é inválido, retornar erro
    if (params.cupomCodigo && cupomInfo && !cupomInfo.valido) {
      throw new Error(cupomInfo.mensagem || 'Cupom inválido');
    }

    const checkoutId =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString('hex');
    const isAssinatura = params.metodo === 'assinatura';
    const pagamentoSelecionado: CheckoutPagamento = isAssinatura
      ? (params.pagamento ?? 'card')
      : (params.pagamento as CheckoutPagamento);
    const metodoPagamento = isAssinatura
      ? METODO_PAGAMENTO.CARTAO_CREDITO
      : pagamentoToMetodo[pagamentoSelecionado];
    const modeloPagamento = isAssinatura
      ? MODELO_PAGAMENTO.ASSINATURA
      : pagamentoSelecionado === 'card' && params.card?.installments && params.card.installments > 1
        ? MODELO_PAGAMENTO.PAGAMENTO_PARCELADO
        : MODELO_PAGAMENTO.PAGAMENTO_UNICO;
    const paymentMode = isAssinatura ? (params.card?.token ? 'DIRECT' : 'CHECKOUT_PRO') : 'DIRECT';

    await this.logEvent({
      usuarioId: params.usuarioId,
      tipo: 'CHECKOUT_START',
      status: 'PENDENTE',
      externalRef: checkoutId,
      payload: {
        planosEmpresariaisId: params.planosEmpresariaisId,
        metodo: params.metodo,
        pagamento: pagamentoSelecionado,
        modeloPagamento,
        paymentMode,
        cupomCodigo: params.cupomCodigo || null,
        cupomId: cupomId || null,
        valorOriginal,
        desconto,
        valorFinal,
        observacao: 'Aguardando confirmação de pagamento (Mercado Pago)',
      },
    });

    const mp = mpClient!;
    // Usar valor com desconto aplicado (se cupom válido)
    const valor = valorFinal;
    const titulo = desconto > 0 
      ? `${planoBase.nome} (com desconto de R$ ${desconto.toFixed(2)})`
      : planoBase.nome;
    const { success } = resolveCheckoutReturnUrls({
      successUrl: params.successUrl,
      failureUrl: params.failureUrl,
      pendingUrl: params.pendingUrl,
    });

    const { firstName, lastName } = splitName(usuario.nomeCompleto);
    
    // Função para validar CPF
    const isValidCPF = (cpf: string): boolean => {
      if (cpf.length !== 11) return false;
      if (/^(\d)\1+$/.test(cpf)) return false; // Todos dígitos iguais
      
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
      let rest = (sum * 10) % 11;
      if (rest === 10 || rest === 11) rest = 0;
      if (rest !== parseInt(cpf[9])) return false;
      
      sum = 0;
      for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
      rest = (sum * 10) % 11;
      if (rest === 10 || rest === 11) rest = 0;
      return rest === parseInt(cpf[10]);
    };
    
    // Função para validar CNPJ
    const isValidCNPJ = (cnpj: string): boolean => {
      if (cnpj.length !== 14) return false;
      if (/^(\d)\1+$/.test(cnpj)) return false; // Todos dígitos iguais
      
      const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * weights1[i];
      let rest = sum % 11;
      const digit1 = rest < 2 ? 0 : 11 - rest;
      if (digit1 !== parseInt(cnpj[12])) return false;
      
      sum = 0;
      for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * weights2[i];
      rest = sum % 11;
      const digit2 = rest < 2 ? 0 : 11 - rest;
      return digit2 === parseInt(cnpj[13]);
    };
    
    // Prioridade: 1) Dados do payer enviados pelo frontend, 2) Dados do usuário no banco
    const documento = (() => {
      // Se o frontend enviou dados de identificação, usar eles
      if (params.payer?.identification?.number) {
        const docNumber = sanitizeDigits(params.payer.identification.number);
        const docType = params.payer.identification.type;
        
        // Validar o documento enviado pelo frontend
        if (docType === 'CPF') {
          if (isValidCPF(docNumber)) {
            return { type: 'CPF' as const, number: docNumber };
          }
          // CPF inválido - lançar erro claro para o frontend
          throw Object.assign(
            new Error(`CPF inválido: ${params.payer.identification.number}. Verifique se o CPF está correto (11 dígitos).`),
            { code: 'INVALID_CPF' }
          );
        }
        if (docType === 'CNPJ') {
          if (isValidCNPJ(docNumber)) {
            return { type: 'CNPJ' as const, number: docNumber };
          }
          // CNPJ inválido - lançar erro claro para o frontend
          throw Object.assign(
            new Error(`CNPJ inválido: ${params.payer.identification.number}. Verifique se o CNPJ está correto (14 dígitos).`),
            { code: 'INVALID_CNPJ' }
          );
        }
      }
      
      // Fallback: tentar usar dados do usuário no banco (apenas se frontend não enviou)
      // Tentar CNPJ primeiro (empresas)
      const cnpj = sanitizeDigits(usuario.cnpj);
      if (cnpj && isValidCNPJ(cnpj)) {
        return { type: 'CNPJ' as const, number: cnpj };
      }
      // Se CNPJ inválido ou não existe, tentar CPF
      const cpf = sanitizeDigits(usuario.cpf);
      if (cpf && isValidCPF(cpf)) {
        return { type: 'CPF' as const, number: cpf };
      }
      
      // Se nenhum documento válido disponível
      logger.warn('[CHECKOUT] Nenhum documento válido encontrado no perfil do usuário', {
        usuarioId: usuario.id,
        cnpjLength: cnpj?.length,
        cpfLength: cpf?.length,
      });
      return undefined;
    })();
    // Prioridade: 1) Endereço do frontend (params.payer.address), 2) Endereço do banco
    const enderecoFrontend = params.payer?.address;
    const enderecoBanco = usuario.UsuariosEnderecos?.[0];
    const payerAddress = enderecoFrontend
      ? {
          zip_code: sanitizeDigits(enderecoFrontend.zip_code ?? ''),
          street_name: enderecoFrontend.street_name ?? undefined,
          street_number: enderecoFrontend.street_number ?? undefined,
          neighborhood: enderecoFrontend.neighborhood ?? undefined,
          city: enderecoFrontend.city ?? undefined,
          federal_unit: enderecoFrontend.federal_unit ?? undefined,
        }
      : enderecoBanco
        ? {
            zip_code: sanitizeDigits(enderecoBanco.cep ?? ''),
            street_name: enderecoBanco.logradouro ?? undefined,
            street_number: enderecoBanco.numero ?? undefined,
            neighborhood: enderecoBanco.bairro ?? undefined,
            city: enderecoBanco.cidade ?? undefined,
            federal_unit: enderecoBanco.estado ?? undefined,
          }
        : undefined;
    const phoneDigits = sanitizeDigits((usuario as any).UsuariosInformation?.telefone ?? '');
    const payerPhone =
      phoneDigits.length >= 10
        ? {
            area_code: phoneDigits.slice(0, 2),
            number: phoneDigits.slice(2),
          }
        : undefined;

    // Priorizar dados do frontend (params.payer) sobre dados do banco
    const payerBase = {
      email: params.payer?.email || usuario.email,
      first_name: params.payer?.first_name || firstName,
      last_name: params.payer?.last_name || lastName,
      identification: documento && documento.number ? documento : undefined,
      address: payerAddress && payerAddress.zip_code ? payerAddress : undefined,
      phone: params.payer?.phone || payerPhone,
    };

    const planoSnapshot: PlanosEmpresariaisSnapshot = {
      id: checkoutId,
      usuarioId: params.usuarioId,
      planosEmpresariaisId: params.planosEmpresariaisId,
      modo: null,
      status: EmpresasPlanoStatus.SUSPENSO,
      inicio: null,
      fim: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      modeloPagamento,
      metodoPagamento,
      statusPagamento: STATUS_PAGAMENTO.PENDENTE,
      mpPreapprovalId: null,
      mpSubscriptionId: null,
      mpPayerId: null,
      mpPaymentId: null,
      proximaCobranca: null,
      graceUntil: null,
      plano: planoBase,
    };

    try {
      if (isAssinatura) {
        const preapproval = new PreApproval(mp);
        const preapprovalPlanId = await this.ensurePlanPreapproval(params.planosEmpresariaisId);
        const requestBody: Record<string, any> = {
          reason: titulo,
          external_reference: checkoutId,
          back_url: success,
          payer_email: usuario.email,
          preapproval_plan_id: preapprovalPlanId,
        };
        if (params.card?.token) {
          requestBody.status = 'authorized';
          requestBody.card_token_id = params.card.token;
          if (documento?.number) {
            requestBody.payer_identification = documento;
          }
        }

        const result = (await preapproval.create({ body: requestBody })) as MercadoPagoResponse;
        const body = result.body ?? result;
        const subscriptionId = extractResourceId(result);
        const mpPayerId = body?.payer_id
          ? String(body.payer_id)
          : body?.payer?.id
            ? String(body.payer.id)
            : null;
        const statusPagamento = mapToStatusPagamento(body?.status);
        const ativo = statusPagamento === STATUS_PAGAMENTO.APROVADO;
        const inicio = ativo ? new Date() : null;
        const proximaCobranca = ativo ? addMonths(new Date(), 1) : null;

        await createOrUpdateCheckoutEmpresasPlano({
          checkoutId,
          usuarioId: params.usuarioId,
          planosEmpresariaisId: params.planosEmpresariaisId,
          metodoPagamento,
          modeloPagamento,
          statusPagamento,
          status: ativo ? EmpresasPlanoStatus.ATIVO : EmpresasPlanoStatus.SUSPENSO,
          inicio,
          proximaCobranca,
          mpPreapprovalId: subscriptionId,
          mpSubscriptionId: subscriptionId,
          mpPayerId,
          // Aceite de termos
          aceitouTermos: params.aceitouTermos,
          aceitouTermosIp: params.aceitouTermosIp,
          aceitouTermosUserAgent: params.aceitouTermosUserAgent,
          // Cupom de desconto
          cupomDescontoId: cupomId,
          cupomDescontoCodigo: params.cupomCodigo,
          valorOriginal,
          valorDesconto: desconto,
          valorFinal,
        });

        if (ativo) {
          await prisma.empresasPlano.updateMany({
            where: {
              usuarioId: params.usuarioId,
              status: EmpresasPlanoStatus.ATIVO,
              NOT: { id: checkoutId },
            },
            data: { status: EmpresasPlanoStatus.CANCELADO, fim: new Date() },
          });
        }

        planoSnapshot.statusPagamento = statusPagamento;
        planoSnapshot.status = ativo ? EmpresasPlanoStatus.ATIVO : EmpresasPlanoStatus.SUSPENSO;
        planoSnapshot.inicio = inicio;
        planoSnapshot.proximaCobranca = proximaCobranca;
        planoSnapshot.mpPreapprovalId = subscriptionId;
        planoSnapshot.mpSubscriptionId = subscriptionId;
        planoSnapshot.mpPayerId = mpPayerId;

        await this.logEvent({
          usuarioId: params.usuarioId,
          empresasPlanoId: checkoutId,
          tipo: 'PREAPPROVAL_CREATED',
          status: statusPagamento,
          externalRef: checkoutId,
          mpResourceId: subscriptionId,
          payload: body,
        });

        // Incrementar uso do cupom se foi aplicado com sucesso
        if (cupomId && ativo) {
          await prisma.cuponsDesconto.update({
            where: { id: cupomId },
            data: { usosTotais: { increment: 1 } },
          });
        }

        return {
          checkoutId,
          plano: planoSnapshot,
          assinatura: {
            preapprovalId: subscriptionId,
            status: body?.status ?? null,
            initPoint: extractInitPoint(result),
            requiresRedirect: !params.card?.token,
          },
          // Informações do desconto aplicado
          desconto: desconto > 0 ? {
            cupomCodigo: params.cupomCodigo,
            cupomId,
            valorOriginal,
            valorDesconto: desconto,
            valorFinal,
          } : null,
          // Aceite de termos registrado
          termos: {
            aceitouTermos: params.aceitouTermos,
            aceitouTermosEm: new Date().toISOString(),
          },
        };
      }

      const paymentApi = new Payment(mp);
      if (pagamentoSelecionado === 'pix') {
        // Validar dados mínimos para PIX
        if (!payerBase.email) {
          throw Object.assign(new Error('Email do pagador é obrigatório para PIX'), { code: 'PAYER_EMAIL_REQUIRED' });
        }
        
        // PIX no Brasil EXIGE documento de identificação válido
        if (!payerBase.identification?.number) {
          throw Object.assign(
            new Error('CPF ou CNPJ válido é obrigatório para pagamento via PIX. Por favor, informe o documento do pagador no campo payer.identification.'), 
            { code: 'PAYER_IDENTIFICATION_REQUIRED' }
          );
        }
        
        logger.info('[PIX_CHECKOUT] Documento validado com sucesso', {
          checkoutId,
          docType: payerBase.identification.type,
          docLength: payerBase.identification.number.length,
        });
        
        // Log dos dados que serão enviados ao Mercado Pago
        logger.info('[PIX_CHECKOUT] Criando pagamento PIX', {
          checkoutId,
          transaction_amount: valor,
          payer_email: payerBase.email,
          payer_identification: payerBase.identification,
        });

        const pixPaymentBody = {
          transaction_amount: valor,
          description: titulo,
          payment_method_id: 'pix',
          external_reference: checkoutId,
          payer: {
            email: payerBase.email,
            first_name: payerBase.first_name || undefined,
            last_name: payerBase.last_name || undefined,
            identification: payerBase.identification,
          },
        };

        let payment: MercadoPagoResponse;
        try {
          // Log do token sendo usado (últimos 8 caracteres apenas para debug)
          const tokenUsado = mercadopagoConfig.getAccessToken();
          const tokenTipo = mercadopagoConfig.prod.accessToken ? 'PRODUCAO' : 'TESTE';
          logger.info('[PIX_CHECKOUT] Usando token MP', {
            tipo: tokenTipo,
            tokenFinal: tokenUsado ? `...${tokenUsado.slice(-8)}` : 'NAO_CONFIGURADO',
          });
          
          payment = (await paymentApi.create({ body: pixPaymentBody })) as MercadoPagoResponse;
        } catch (mpError: any) {
          const errorMessage = mpError?.message || '';
          const causeDescription = mpError?.cause?.[0]?.description || '';
          
          // Log COMPLETO do erro para debug
          logger.error('[PIX_CHECKOUT] Erro Mercado Pago - DETALHES COMPLETOS', {
            checkoutId,
            errorMessage,
            causeDescription,
            cause: mpError?.cause,
            apiResponse: mpError?.apiResponse,
            response: mpError?.response,
            responseData: mpError?.response?.data,
            status: mpError?.status,
            statusCode: mpError?.statusCode,
            errorName: mpError?.name,
            errorCode: mpError?.code,
            // Tentar extrair todos os campos possíveis
            allKeys: mpError ? Object.keys(mpError) : [],
            stringified: JSON.stringify(mpError, Object.getOwnPropertyNames(mpError), 2),
          });
          
          // Tratar erros específicos do Mercado Pago
          
          // ERRO: Conta sem chave PIX habilitada
          if (errorMessage.includes('without key enabled for QR') || errorMessage.includes('Collector user without key')) {
            throw Object.assign(
              new Error(
                'A conta do Mercado Pago não possui chave PIX cadastrada. ' +
                'Para receber pagamentos via PIX, é necessário cadastrar uma chave PIX no painel do Mercado Pago. ' +
                'Acesse: https://www.mercadopago.com.br/settings/account/security/pix'
              ),
              { 
                code: 'PIX_KEY_NOT_CONFIGURED',
                cause: mpError?.cause,
                details: {
                  message: 'Chave PIX não configurada na conta do Mercado Pago',
                  hint: 'Cadastre uma chave PIX (CPF, CNPJ, email ou aleatória) no painel do Mercado Pago',
                  url: 'https://www.mercadopago.com.br/settings/account/security/pix',
                }
              }
            );
          }
          
          // ERRO: Problema com identidade financeira (pode ser secundário ao erro de chave PIX)
          if (errorMessage.includes('Financial Identity') || causeDescription.includes('Financial Identity')) {
            throw Object.assign(
              new Error(
                'Erro na identidade financeira do Mercado Pago. ' +
                'Verifique: 1) Se a conta possui chave PIX cadastrada; ' +
                '2) Se os dados do pagador (CPF/CNPJ) são válidos; ' +
                '3) Se a conta está habilitada para receber pagamentos.'
              ),
              { 
                code: 'FINANCIAL_IDENTITY_ERROR',
                cause: mpError?.cause,
                details: {
                  message: 'Erro de identidade financeira no Mercado Pago',
                  hint: 'Verifique se a conta possui chave PIX e está habilitada para receber pagamentos',
                }
              }
            );
          }
          
          if (errorMessage.includes('Invalid user identification') || causeDescription.includes('identification')) {
            throw Object.assign(
              new Error(
                'CPF/CNPJ inválido. Verifique se o documento está correto e tente novamente.'
              ),
              { 
                code: 'INVALID_IDENTIFICATION',
                cause: mpError?.cause,
              }
            );
          }
          
          throw Object.assign(
            new Error(causeDescription || errorMessage || 'Erro ao criar pagamento PIX'),
            { 
              code: 'MERCADOPAGO_ERROR',
              cause: mpError?.cause,
              details: mpError?.response?.data,
            }
          );
        }
        const body = payment.body ?? payment;
        const mpPaymentId = body?.id ? String(body.id) : undefined;
        const statusPagamento = mapToStatusPagamento(body?.status);
        const ativo = statusPagamento === STATUS_PAGAMENTO.APROVADO;
        const expiration = body?.date_of_expiration ? new Date(body.date_of_expiration) : null;

        await createOrUpdateCheckoutEmpresasPlano({
          checkoutId,
          usuarioId: params.usuarioId,
          planosEmpresariaisId: params.planosEmpresariaisId,
          metodoPagamento,
          modeloPagamento,
          statusPagamento,
          status: ativo ? EmpresasPlanoStatus.ATIVO : EmpresasPlanoStatus.SUSPENSO,
          mpPaymentId: mpPaymentId ?? null,
          proximaCobranca: expiration,
          graceUntil: expiration,
          // Aceite de termos
          aceitouTermos: params.aceitouTermos,
          aceitouTermosIp: params.aceitouTermosIp,
          aceitouTermosUserAgent: params.aceitouTermosUserAgent,
          // Cupom de desconto
          cupomDescontoId: cupomId,
          cupomDescontoCodigo: params.cupomCodigo,
          valorOriginal,
          valorDesconto: desconto,
          valorFinal,
        });

        planoSnapshot.statusPagamento = statusPagamento;
        planoSnapshot.status = ativo ? EmpresasPlanoStatus.ATIVO : EmpresasPlanoStatus.SUSPENSO;
        planoSnapshot.mpPaymentId = mpPaymentId ?? null;
        planoSnapshot.proximaCobranca = expiration;
        planoSnapshot.graceUntil = expiration;

        await this.logEvent({
          usuarioId: params.usuarioId,
          empresasPlanoId: checkoutId,
          tipo: 'PAYMENT_CREATED',
          status: statusPagamento,
          externalRef: checkoutId,
          mpResourceId: mpPaymentId ?? null,
          payload: body,
        });

        const transactionData = body?.point_of_interaction?.transaction_data || {};
        
        // Incrementar uso do cupom se foi aplicado com sucesso
        if (cupomId) {
          await prisma.cuponsDesconto.update({
            where: { id: cupomId },
            data: { usosTotais: { increment: 1 } },
          });
        }

        return {
          checkoutId,
          plano: planoSnapshot,
          pagamento: {
            tipo: 'pix',
            status: body?.status ?? null,
            paymentId: mpPaymentId ?? null,
            qrCode: transactionData.qr_code || null,
            qrCodeBase64: transactionData.qr_code_base64 || null,
            expiresAt: body?.date_of_expiration || null,
          },
          // Informações do desconto aplicado
          desconto: desconto > 0 ? {
            cupomCodigo: params.cupomCodigo,
            cupomId,
            valorOriginal,
            valorDesconto: desconto,
            valorFinal,
          } : null,
          // Aceite de termos registrado
          termos: {
            aceitouTermos: params.aceitouTermos,
            aceitouTermosEm: new Date().toISOString(),
          },
        };
      }

      if (pagamentoSelecionado === 'card') {
        const cardData = params.card;
        if (!cardData?.token) {
          throw new Error('Token do cartão é obrigatório para pagamentos com cartão');
        }
        const installments = cardData.installments ?? 1;
        const payment = (await paymentApi.create({
          body: {
            transaction_amount: valor,
            description: titulo,
            token: cardData.token,
            installments,
            external_reference: checkoutId,
            payer: payerBase,
          },
        })) as MercadoPagoResponse;
        const body = payment.body ?? payment;
        const mpPaymentId = body?.id ? String(body.id) : undefined;
        const statusPagamento = mapToStatusPagamento(body?.status);
        const ativo = statusPagamento === STATUS_PAGAMENTO.APROVADO;

        await createOrUpdateCheckoutEmpresasPlano({
          checkoutId,
          usuarioId: params.usuarioId,
          planosEmpresariaisId: params.planosEmpresariaisId,
          metodoPagamento,
          modeloPagamento,
          statusPagamento,
          status: ativo ? EmpresasPlanoStatus.ATIVO : EmpresasPlanoStatus.SUSPENSO,
          inicio: ativo ? new Date() : null,
          mpPaymentId: mpPaymentId ?? null,
          // Aceite de termos
          aceitouTermos: params.aceitouTermos,
          aceitouTermosIp: params.aceitouTermosIp,
          aceitouTermosUserAgent: params.aceitouTermosUserAgent,
          // Cupom de desconto
          cupomDescontoId: cupomId,
          cupomDescontoCodigo: params.cupomCodigo,
          valorOriginal,
          valorDesconto: desconto,
          valorFinal,
        });

        if (ativo) {
          await prisma.empresasPlano.updateMany({
            where: {
              usuarioId: params.usuarioId,
              status: EmpresasPlanoStatus.ATIVO,
              NOT: { id: checkoutId },
            },
            data: { status: EmpresasPlanoStatus.CANCELADO, fim: new Date() },
          });
        }

        planoSnapshot.statusPagamento = statusPagamento;
        planoSnapshot.status = ativo ? EmpresasPlanoStatus.ATIVO : EmpresasPlanoStatus.SUSPENSO;
        planoSnapshot.inicio = ativo ? new Date() : null;
        planoSnapshot.mpPaymentId = mpPaymentId ?? null;

        await this.logEvent({
          usuarioId: params.usuarioId,
          empresasPlanoId: checkoutId,
          tipo: 'PAYMENT_CREATED',
          status: statusPagamento,
          externalRef: checkoutId,
          mpResourceId: mpPaymentId ?? null,
          payload: body,
        });

        // Incrementar uso do cupom se foi aplicado com sucesso
        if (cupomId && ativo) {
          await prisma.cuponsDesconto.update({
            where: { id: cupomId },
            data: { usosTotais: { increment: 1 } },
          });
        }

        return {
          checkoutId,
          plano: planoSnapshot,
          pagamento: {
            tipo: 'card',
            status: body?.status ?? null,
            paymentId: mpPaymentId ?? null,
            installments,
          },
          // Informações do desconto aplicado
          desconto: desconto > 0 ? {
            cupomCodigo: params.cupomCodigo,
            cupomId,
            valorOriginal,
            valorDesconto: desconto,
            valorFinal,
          } : null,
          // Aceite de termos registrado
          termos: {
            aceitouTermos: params.aceitouTermos,
            aceitouTermosEm: new Date().toISOString(),
          },
        };
      }

      // Validar endereço completo para boleto (obrigatório pelo Mercado Pago)
      if (!payerBase.address?.zip_code || !payerBase.address?.street_name || 
          !payerBase.address?.street_number || !payerBase.address?.neighborhood || 
          !payerBase.address?.city || !payerBase.address?.federal_unit) {
        throw Object.assign(
          new Error(
            'Endereço completo é obrigatório para pagamento via Boleto. ' +
            'Por favor, informe: CEP, logradouro, número, bairro, cidade e estado no campo payer.address.'
          ),
          { 
            code: 'BOLETO_ADDRESS_REQUIRED',
            details: {
              required: ['zip_code', 'street_name', 'street_number', 'neighborhood', 'city', 'federal_unit'],
              hint: 'Envie o endereço completo no campo payer.address do request',
            }
          }
        );
      }

      logger.info('[BOLETO_CHECKOUT] Criando pagamento Boleto', {
        checkoutId,
        transaction_amount: valor,
        payer_email: payerBase.email,
        payer_address: payerBase.address,
      });

      const payment = (await paymentApi.create({
        body: {
          transaction_amount: valor,
          description: titulo,
          payment_method_id: 'bolbradesco',
          external_reference: checkoutId,
          payer: {
            ...payerBase,
            identification: documento && documento.number ? documento : undefined,
          },
        },
      })) as MercadoPagoResponse;
      const body = payment.body ?? payment;
      const mpPaymentId = body?.id ? String(body.id) : undefined;
      const statusPagamento = mapToStatusPagamento(body?.status);
      const ativo = statusPagamento === STATUS_PAGAMENTO.APROVADO;
      const expiration = body?.date_of_expiration ? new Date(body.date_of_expiration) : null;
      const graceUntil = (() => {
        const grace = new Date();
        grace.setDate(grace.getDate() + (mercadopagoConfig.settings.boletoGraceDays || 5));
        return grace;
      })();

      await createOrUpdateCheckoutEmpresasPlano({
        checkoutId,
        usuarioId: params.usuarioId,
        planosEmpresariaisId: params.planosEmpresariaisId,
        metodoPagamento,
        modeloPagamento,
        statusPagamento,
        status: ativo ? EmpresasPlanoStatus.ATIVO : EmpresasPlanoStatus.SUSPENSO,
        mpPaymentId: mpPaymentId ?? null,
        proximaCobranca: expiration,
        graceUntil,
        // Aceite de termos
        aceitouTermos: params.aceitouTermos,
        aceitouTermosIp: params.aceitouTermosIp,
        aceitouTermosUserAgent: params.aceitouTermosUserAgent,
        // Cupom de desconto
        cupomDescontoId: cupomId,
        cupomDescontoCodigo: params.cupomCodigo,
        valorOriginal,
        valorDesconto: desconto,
        valorFinal,
      });

      planoSnapshot.statusPagamento = statusPagamento;
      planoSnapshot.status = ativo ? EmpresasPlanoStatus.ATIVO : EmpresasPlanoStatus.SUSPENSO;
      planoSnapshot.mpPaymentId = mpPaymentId ?? null;
      planoSnapshot.proximaCobranca = expiration;
      planoSnapshot.graceUntil = graceUntil;

      await this.logEvent({
        usuarioId: params.usuarioId,
        empresasPlanoId: checkoutId,
        tipo: 'PAYMENT_CREATED',
        status: statusPagamento,
        externalRef: checkoutId,
        mpResourceId: mpPaymentId ?? null,
        payload: body,
      });

      const barcode =
        body?.barcode?.content ||
        body?.barcode ||
        body?.transaction_details?.external_resource_url ||
        null;
      const boletoUrl =
        body?.transaction_details?.external_resource_url ||
        body?.point_of_interaction?.transaction_data?.ticket_url ||
        null;

      // Incrementar uso do cupom se foi aplicado com sucesso
      if (cupomId) {
        await prisma.cuponsDesconto.update({
          where: { id: cupomId },
          data: { usosTotais: { increment: 1 } },
        });
      }

      return {
        checkoutId,
        plano: planoSnapshot,
        pagamento: {
          tipo: 'boleto',
          status: body?.status ?? null,
          paymentId: mpPaymentId ?? null,
          barcode,
          boletoUrl,
          expiresAt: body?.date_of_expiration || null,
        },
        // Informações do desconto aplicado
        desconto: desconto > 0 ? {
          cupomCodigo: params.cupomCodigo,
          cupomId,
          valorOriginal,
          valorDesconto: desconto,
          valorFinal,
        } : null,
        // Aceite de termos registrado
        termos: {
          aceitouTermos: params.aceitouTermos,
          aceitouTermosEm: new Date().toISOString(),
        },
      };
    } catch (e) {
      const normalized = normalizeMercadoPagoError(e);
      await this.logEvent({
        usuarioId: params.usuarioId,
        tipo: 'CHECKOUT_ERROR',
        status: 'ERRO',
        externalRef: checkoutId,
        mensagem: normalized.message,
        payload: normalized.payload,
      });
      throw new Error(`Erro ao iniciar checkout no Mercado Pago: ${normalized.message}`);
    }
  },

  async updatePaymentStatusFromNotification(params: {
    externalRef: string;
    status?: string | null;
    mpPaymentId?: string | null;
    data?: any;
  }) {
    const { externalRef, status, mpPaymentId, data } = params;
    if (!externalRef) return;

    let plano = await prisma.empresasPlano.findUnique({ where: { id: externalRef } });
    if (!plano) {
      plano = await this.ensureEmpresasPlanoFromCheckout(externalRef);
    }
    if (!plano) return;

    const normalized = typeof status === 'string' ? status.toLowerCase() : '';
    const statusPagamento = mapToStatusPagamento(normalized);
    const mpPaymentIdResolved = mpPaymentId ?? plano.mpPaymentId ?? null;

    const updateData: any = {
      statusPagamento,
      mpPaymentId: mpPaymentIdResolved,
    };

    if (data?.preapproval_id || data?.id) {
      const subscriptionId = String(data?.preapproval_id ?? data?.id ?? '');
      if (subscriptionId) {
        updateData.mpPreapprovalId = subscriptionId;
        updateData.mpSubscriptionId = subscriptionId;
      }
    }

    if (PAYMENT_APPROVED_STATUSES.has(normalized)) {
      updateData.status = EmpresasPlanoStatus.ATIVO;
      updateData.inicio = plano.inicio ?? new Date();
      updateData.proximaCobranca = addMonths(new Date(), 1);
      updateData.graceUntil = null;
      await prisma.empresasPlano.updateMany({
        where: {
          usuarioId: plano.usuarioId,
          status: EmpresasPlanoStatus.ATIVO,
          NOT: { id: plano.id },
        },
        data: { status: EmpresasPlanoStatus.CANCELADO, fim: new Date() },
      });
    } else if (PAYMENT_PENDING_STATUSES.has(normalized)) {
      updateData.statusPagamento = STATUS_PAGAMENTO.EM_PROCESSAMENTO;
    } else if (PAYMENT_REJECTED_STATUSES.has(normalized)) {
      const grace = new Date();
      grace.setDate(grace.getDate() + (mercadopagoConfig.settings.graceDays || 5));
      updateData.graceUntil = grace;
      updateData.status = EmpresasPlanoStatus.SUSPENSO;
    } else if (PAYMENT_CANCELLED_STATUSES.has(normalized)) {
      updateData.statusPagamento = STATUS_PAGAMENTO.CANCELADO;
      updateData.status = EmpresasPlanoStatus.CANCELADO;
      updateData.fim = new Date();
      updateData.graceUntil = null;
    }

    await prisma.empresasPlano.update({ where: { id: plano.id }, data: updateData });

    const finalStatus: STATUS_PAGAMENTO = updateData.statusPagamento ?? statusPagamento;
    const statusChanged = plano.statusPagamento !== finalStatus;

    await this.logEvent({
      usuarioId: plano.usuarioId,
      empresasPlanoId: plano.id,
      tipo: 'PAYMENT_STATUS_UPDATE',
      status: statusPagamento,
      externalRef,
      mpResourceId: mpPaymentIdResolved,
      payload: data,
    });

    if (!mercadopagoConfig.settings.emailsEnabled || !statusChanged) {
      return;
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: plano.usuarioId },
      select: { id: true, email: true, nomeCompleto: true, tipoUsuario: true },
    });
    if (!usuario?.email) {
      return;
    }

    const emailService = new EmailService();

    if (PAYMENT_APPROVED_STATUSES.has(normalized)) {
      const planoInfo = await prisma.planosEmpresariais.findUnique({
        where: { id: plano.planosEmpresariaisId },
        select: { nome: true, quantidadeVagas: true },
      });
      const planName = planoInfo?.nome ?? 'seu plano';
      const vagas = planoInfo?.quantidadeVagas ?? null;
      const template = EmailTemplates.generatePlanActivatedEmail({
        nomeCompleto: usuario.nomeCompleto,
        planName,
        vagas,
      });
      await emailService.sendAssinaturaNotificacao(
        { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
        template,
      );
      return;
    }

    if (PAYMENT_PENDING_STATUSES.has(normalized)) {
      await emailService.sendAssinaturaNotificacao(
        { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
        {
          subject: '🕒 Pagamento em processamento',
          html: `<p>Olá, ${usuario.nomeCompleto}!</p><p>Recebemos sua solicitação de pagamento. Assim que houver confirmação, avisaremos por aqui.</p>`,
          text: `Olá, ${usuario.nomeCompleto}! Recebemos sua solicitação de pagamento. Avisaremos assim que for confirmado.`,
        },
      );
      return;
    }

    if (PAYMENT_REJECTED_STATUSES.has(normalized)) {
      const planoInfo = await prisma.planosEmpresariais.findUnique({
        where: { id: plano.planosEmpresariaisId },
        select: { nome: true },
      });
      const planName = planoInfo?.nome ?? 'seu plano';
      const url =
        mercadopagoConfig.settings.billingPortalUrl || mercadopagoConfig.returnUrls.failure;
      const template = EmailTemplates.generatePlanPaymentRejectedEmail({
        nomeCompleto: usuario.nomeCompleto,
        planName,
        supportUrl: url,
      });
      await emailService.sendAssinaturaNotificacao(
        { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
        template,
      );
      return;
    }

    if (PAYMENT_CANCELLED_STATUSES.has(normalized)) {
      await emailService.sendAssinaturaNotificacao(
        { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
        {
          subject: '❌ Assinatura cancelada',
          html: `<p>Olá, ${usuario.nomeCompleto}!</p><p>Seu pagamento não foi confirmado no prazo e a assinatura foi cancelada. Caso deseje reativar, realize uma nova contratação.</p>`,
          text: `Olá, ${usuario.nomeCompleto}! Seu pagamento não foi confirmado no prazo e a assinatura foi cancelada. Para reativar, contrate novamente.`,
        },
      );
    }
  },

  async handleWebhook(event: { type?: string; action?: string; data?: any }) {
    // Estrutura genérica; ajuste para payload real do MP
    const { type, action, data } = event;

    // Exemplos: pagamentos aprovados
    if (type === 'payment' && (action === 'payment.created' || action === 'payment.updated')) {
      const mpPaymentId = String(data?.id ?? data?.payment?.id ?? '');
      if (!mpPaymentId) return;

      // Buscamos plano por payment ID ou via referência (custom data)
      // Supondo que enviamos "external_reference" como id do EmpresasPlano
      const externalRef = String(data?.external_reference ?? '');
      if (!externalRef) return;
      await this.updatePaymentStatusFromNotification({
        externalRef,
        status: data?.status,
        mpPaymentId,
        data,
      });
    }

    if (type === 'subscription' || type === 'preapproval') {
      const body = (data as any) || {};
      const externalRef = String(body?.external_reference ?? body?.externalReference ?? '');
      if (!externalRef) return;

      await this.updatePaymentStatusFromNotification({
        externalRef,
        status: body?.status,
        data: body,
      });
    }
  },

  async cancel(usuarioId: string, motivo?: string) {
    // Desativa plano atual e aplica regra de RASCUNHO nas vagas
    const planoAtivo = await prisma.empresasPlano.findFirst({
      where: { usuarioId, status: EmpresasPlanoStatus.ATIVO },
    });
    if (!planoAtivo) return { cancelled: false };

    await prisma.empresasPlano.update({
      where: { id: planoAtivo.id },
      data: {
        status: EmpresasPlanoStatus.CANCELADO,
        fim: new Date(),
        statusPagamento: STATUS_PAGAMENTO.CANCELADO,
      },
    });
    await this.logEvent({
      usuarioId,
      empresasPlanoId: planoAtivo.id,
      tipo: 'CANCEL',
      status: 'CANCELADO',
      mensagem: motivo || null,
    });

    await setVagasToDraft(usuarioId);
    return { cancelled: true };
  },

  async downgrade(usuarioId: string, novoplanosEmpresariaisId: string) {
    // Cria nova vinculação com downgrade e coloca vagas em rascunho
    const result = await clientesService.assign({
      usuarioId,
      planosEmpresariaisId: novoplanosEmpresariaisId,
      modo: 'parceiro',
    } as any);

    await setVagasToDraft(usuarioId);
    try {
      const usuario = await prisma.usuarios.findUnique({
        where: { id: usuarioId },
        select: { id: true, email: true, nomeCompleto: true },
      });
      const plano = await prisma.planosEmpresariais.findUnique({
        where: { id: novoplanosEmpresariaisId },
        select: { nome: true, quantidadeVagas: true },
      });
      if (usuario?.email) {
        const emailService = new EmailService();
        const name = plano?.nome ?? 'plano';
        const vagas = plano?.quantidadeVagas ?? null;
        const template = EmailTemplates.generatePlanDowngradedEmail({
          nomeCompleto: usuario.nomeCompleto,
          planName: name,
          vagas,
        });
        await emailService.sendAssinaturaNotificacao(
          { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
          template,
        );
      }
    } catch (err) {
      logger.warn(
        { err, usuarioId, novoplanosEmpresariaisId },
        'Falha ao enviar email de downgrade',
      );
    }
    return result;
  },

  async upgrade(usuarioId: string, novoplanosEmpresariaisId: string) {
    // Cria nova vinculação sem alterar status das vagas
    const result = await clientesService.assign({
      usuarioId,
      planosEmpresariaisId: novoplanosEmpresariaisId,
      modo: 'parceiro',
    } as any);
    try {
      const usuario = await prisma.usuarios.findUnique({
        where: { id: usuarioId },
        select: { id: true, email: true, nomeCompleto: true },
      });
      const plano = await prisma.planosEmpresariais.findUnique({
        where: { id: novoplanosEmpresariaisId },
        select: { nome: true, quantidadeVagas: true },
      });
      if (usuario?.email) {
        const emailService = new EmailService();
        const name = plano?.nome ?? 'plano';
        const vagas = plano?.quantidadeVagas ?? null;
        const template = EmailTemplates.generatePlanUpgradedEmail({
          nomeCompleto: usuario.nomeCompleto,
          planName: name,
          vagas,
        });
        await emailService.sendAssinaturaNotificacao(
          { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
          template,
        );
      }
    } catch (err) {
      logger.warn({ err, usuarioId, novoplanosEmpresariaisId }, 'Falha ao enviar email de upgrade');
    }
    return result;
  },

  async remindPayment(usuarioId: string) {
    assertMercadoPagoConfigured();
    const plano = await prisma.empresasPlano.findFirst({
      where: { usuarioId, status: EmpresasPlanoStatus.ATIVO },
      include: { PlanosEmpresariais: true },
      orderBy: { criadoEm: 'desc' },
    });
    if (!plano) throw new Error('Plano ativo não encontrado para o usuário');

    // Gera nova cobrança (Preference) e envia email com link
    const mp = mpClient!;
    const preference = new Preference(mp);
    const valor = parseFloat(plano.PlanosEmpresariais.valor);
    const titulo = plano.PlanosEmpresariais.nome + ' - Renovação';
    const { success, failure, pending } = resolveCheckoutReturnUrls();

    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
      select: { email: true, nomeCompleto: true },
    });
    const payerEmail = usuario?.email || undefined;

    const pref = await preference.create({
      body: {
        external_reference: plano.id,
        auto_return: 'approved',
        back_urls: { success, failure, pending },
        items: [
          {
            id: plano.PlanosEmpresariais.id,
            title: titulo,
            quantity: 1,
            unit_price: valor,
            currency_id: mercadopagoConfig.settings.defaultCurrency,
          },
        ],
        payer: payerEmail ? { email: payerEmail } : undefined,
      },
    });

    const link =
      (pref as any)?.init_point ||
      (pref as any)?.initPoint ||
      (pref as any)?.sandbox_init_point ||
      (pref as any)?.sandboxInitPoint ||
      '';

    if (usuario?.email && mercadopagoConfig.settings.emailsEnabled) {
      const emailService = new EmailService();
      await emailService.sendGeneric(
        usuario.email,
        usuario.nomeCompleto || 'Cliente',
        '🔔 Lembrete de pagamento da sua assinatura',
        `<p>Olá, ${usuario.nomeCompleto}!</p><p>Segue o link para pagamento da sua assinatura: <a href="${link}">${link}</a>.</p>`,
        `Olá, ${usuario.nomeCompleto}! Link para pagamento: ${link}`,
      );
    }

    await this.logEvent({
      usuarioId,
      empresasPlanoId: plano.id,
      tipo: 'REMINDER_SENT',
      status: 'ENVIADO',
      externalRef: plano.id,
      mpResourceId: (pref as any)?.id || null,
    });

    return { initPoint: link };
  },

  async adminRemindPaymentForPlan(params: {
    usuarioId: string;
    planosEmpresariaisId: string;
    metodoPagamento?: METODO_PAGAMENTO;
    successUrl?: string;
    failureUrl?: string;
    pendingUrl?: string;
  }) {
    // Reutiliza fluxo do checkout para criar um vínculo pendente e preference
    const metodoPagamento = params.metodoPagamento || METODO_PAGAMENTO.PIX;
    let pagamento: CheckoutPagamento = 'pix';
    if (metodoPagamento === METODO_PAGAMENTO.BOLETO) {
      pagamento = 'boleto';
    } else if (metodoPagamento !== METODO_PAGAMENTO.PIX) {
      throw new Error('Remissão administrativa suporta apenas PIX ou Boleto');
    }

    return this.startCheckout({
      usuarioId: params.usuarioId,
      planosEmpresariaisId: params.planosEmpresariaisId,
      metodo: 'pagamento',
      pagamento,
      aceitouTermos: true, // Remissão administrativa assume aceite automático
      successUrl: params.successUrl,
      failureUrl: params.failureUrl,
      pendingUrl: params.pendingUrl,
    });
  },

  async reconcile() {
    // Expira trials vencidos e encerra assinaturas vencidas além da tolerância
    const now = new Date();

    // 1) Trials vencidos
    const trialsToExpire = await prisma.empresasPlano.findMany({
      where: { modo: EmpresasPlanoModo.TESTE, status: EmpresasPlanoStatus.ATIVO, fim: { lt: now } },
      select: { id: true, usuarioId: true },
    });
    for (const trial of trialsToExpire) {
      await prisma.empresasPlano.update({
        where: { id: trial.id },
        data: { status: EmpresasPlanoStatus.EXPIRADO },
      });
      await this.logEvent({
        usuarioId: trial.usuarioId,
        empresasPlanoId: trial.id,
        tipo: 'TRIAL_EXPIRED',
        status: 'EXPIRADO',
      });
    }
    const overdue = await prisma.empresasPlano.findMany({
      where: {
        status: EmpresasPlanoStatus.ATIVO,
        OR: [
          { graceUntil: { lt: now } },
          { proximaCobranca: { lt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    for (const plano of overdue) {
      await prisma.empresasPlano.update({
        where: { id: plano.id },
        data: {
          status: EmpresasPlanoStatus.CANCELADO,
          fim: now,
          statusPagamento: STATUS_PAGAMENTO.CANCELADO,
        },
      });
      await setVagasToDraft(plano.usuarioId);
      await this.logEvent({
        usuarioId: plano.usuarioId,
        empresasPlanoId: plano.id,
        tipo: 'RECONCILE_CANCEL',
        status: 'CANCELADO',
      });
      if (mercadopagoConfig.settings.emailsEnabled) {
        const usuario = await prisma.usuarios.findUnique({
          where: { id: plano.usuarioId },
          select: { email: true, nomeCompleto: true },
        });
        if (usuario?.email) {
          const emailService = new EmailService();
          await emailService.sendGeneric(
            usuario.email,
            usuario.nomeCompleto,
            '❌ Assinatura cancelada por falta de pagamento',
            `<p>Olá, ${usuario.nomeCompleto}!</p><p>Sua assinatura foi cancelada após ${mercadopagoConfig.settings.graceDays} dias sem pagamento. Caso queira reativar, contrate um plano novamente.</p>`,
            `Olá, ${usuario.nomeCompleto}! Sua assinatura foi cancelada após ${mercadopagoConfig.settings.graceDays} dias sem pagamento.`,
          );
        }
      }
    }

    return { processed: overdue.length };
  },
};
