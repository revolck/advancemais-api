import { assertMercadoPagoConfigured, mpClient } from '@/config/mercadopago';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import {
  CuponsAplicarEm,
  CuponsLimiteUso,
  CuponsPeriodo,
  Prisma,
  WebsiteStatus,
} from '@prisma/client';
import jwt from 'jsonwebtoken';
import { Payment } from 'mercadopago';
import type { StartCursoCheckoutInput } from '../validators/cursos-checkout.schema';

// ========================================
// TIPOS E INTERFACES
// ========================================

type CupomValidado = {
  valido: boolean;
  cupomId?: string;
  tipoDesconto?: 'PORCENTAGEM' | 'VALOR_FIXO';
  valorPercentual?: number;
  valorFixo?: number;
  erro?: string;
  mensagem?: string;
};

type MercadoPagoResponse<T = any> = {
  body?: T;
  [key: string]: any;
};

type StatusPagamento = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'PROCESSANDO' | 'CANCELADO';

const CHECKOUT_DOMAIN_STATUS: Record<string, number> = {
  PAYER_EMAIL_REQUIRED: 400,
  PAYER_IDENTIFICATION_REQUIRED: 400,
  INVALID_CPF: 400,
  INVALID_CNPJ: 400,
  INVALID_IDENTIFICATION: 400,
  BOLETO_ADDRESS_REQUIRED: 400,
  PIX_KEY_NOT_CONFIGURED: 503,
  FINANCIAL_IDENTITY_ERROR: 502,
  MERCADOPAGO_ERROR: 502,
  MERCADOPAGO_INVALID_TOKEN: 503,
  MERCADOPAGO_UNAUTHORIZED_POLICY: 503,
};

// ========================================
// FUNÇÕES AUXILIARES (Reutilizadas de assinaturas.service.ts)
// ========================================

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

/**
 * Mapear status do Mercado Pago para status interno
 */
function mapToStatusPagamento(status: string | null | undefined): StatusPagamento {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  if (PAYMENT_APPROVED_STATUSES.has(normalized)) return 'APROVADO';
  if (PAYMENT_PENDING_STATUSES.has(normalized)) return 'PROCESSANDO';
  if (PAYMENT_CANCELLED_STATUSES.has(normalized)) return 'CANCELADO';
  if (PAYMENT_REJECTED_STATUSES.has(normalized)) return 'RECUSADO';
  return 'PENDENTE';
}

/**
 * Remover caracteres não numéricos
 */
function sanitizeDigits(value?: string | null): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Dividir nome completo em primeiro e último nome
 */
function splitName(fullName?: string | null): { firstName?: string; lastName?: string } {
  if (!fullName) return { firstName: undefined, lastName: undefined };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: undefined, lastName: undefined };
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.length ? rest.join(' ') : undefined };
}

/**
 * Validar CPF
 */
function isValidCPF(cpf: string): boolean {
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
}

/**
 * Validar CNPJ
 */
function isValidCNPJ(cnpj: string): boolean {
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
}

/**
 * Normalizar erro do Mercado Pago
 */
function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[Truncated]';

  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
      .replace(/\b(APP_USR|TEST)-[A-Za-z0-9._-]+/g, '$1-[REDACTED]');
  }

  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }

  const record = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(record)) {
    if (/token|authorization|access[_-]?key|secret|password|credential/i.test(key)) {
      redacted[key] = '[REDACTED]';
      continue;
    }

    redacted[key] = redactSensitiveData(item, depth + 1);
  }

  return redacted;
}

function normalizeMercadoPagoError(error: unknown): { message: string; payload?: any } {
  if (error instanceof Error) {
    const errObj = error as any;
    return {
      message: error.message,
      payload: redactSensitiveData({
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: errObj?.code,
        cause: errObj?.cause,
        apiResponse: errObj?.apiResponse,
        payload: errObj?.payload,
        response: errObj?.response,
        status: errObj?.status,
        statusCode: errObj?.statusCode,
      }),
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

    return { message: String(message), payload: redactSensitiveData(payload) };
  }

  return { message: String(error ?? 'erro desconhecido'), payload: error };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function getGatewayErrorSearchText(error: unknown, normalized: { message: string; payload?: any }) {
  const errObj = error as any;
  const causes = [
    ...(Array.isArray(errObj?.cause) ? errObj.cause : []),
    ...(Array.isArray(errObj?.apiResponse?.cause) ? errObj.apiResponse.cause : []),
    ...(Array.isArray(errObj?.response?.data?.cause) ? errObj.response.data.cause : []),
  ];

  return [
    normalized.message,
    ...causes.flatMap((cause) => [cause?.code, cause?.description, cause?.message]),
    safeStringify(errObj?.apiResponse),
    safeStringify(errObj?.response?.data),
    safeStringify(normalized.payload),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getGatewayStatus(error: unknown, normalized: { payload?: any }): number | undefined {
  const errObj = error as any;
  const candidates = [
    errObj?.status,
    errObj?.statusCode,
    errObj?.apiResponse?.status,
    errObj?.apiResponse?.statusCode,
    errObj?.payload?.status,
    errObj?.payload?.statusCode,
    errObj?.response?.status,
    errObj?.response?.statusCode,
    normalized.payload?.status,
    normalized.payload?.statusCode,
    normalized.payload?.apiResponse?.status,
    normalized.payload?.apiResponse?.statusCode,
    normalized.payload?.response?.status,
    normalized.payload?.response?.statusCode,
  ];

  const status = candidates
    .map((candidate) => Number(candidate))
    .find((candidate) => Number.isInteger(candidate) && candidate >= 100);

  return status;
}

function toCheckoutPaymentError(
  error: unknown,
  normalized: { message: string; payload?: any },
): Error & { code?: string; statusCode?: number; details?: unknown } {
  const rawCode = typeof (error as any)?.code === 'string' ? (error as any).code : undefined;
  if (rawCode && CHECKOUT_DOMAIN_STATUS[rawCode]) {
    return Object.assign(new Error((error as Error).message || normalized.message), {
      code: rawCode,
      statusCode: (error as any)?.statusCode ?? CHECKOUT_DOMAIN_STATUS[rawCode],
      details: (error as any)?.details,
    });
  }

  const searchText = getGatewayErrorSearchText(error, normalized);
  const gatewayStatus = getGatewayStatus(error, normalized);

  if (
    gatewayStatus === 403 &&
    (searchText.includes('pa_unauthorized_result_from_policies') ||
      searchText.includes('policy returned unauthorized') ||
      searchText.includes('policyagent') ||
      searchText.includes('blocked_by'))
  ) {
    return Object.assign(
      new Error('O Mercado Pago bloqueou a criação do pagamento por política da conta.'),
      {
        code: 'MERCADOPAGO_UNAUTHORIZED_POLICY',
        statusCode: CHECKOUT_DOMAIN_STATUS.MERCADOPAGO_UNAUTHORIZED_POLICY,
        details: normalized.payload,
      },
    );
  }

  if (
    gatewayStatus === 401 ||
    searchText.includes('invalid access token') ||
    searchText.includes('invalid_token') ||
    searchText.includes('unauthorized') ||
    (searchText.includes('access token') && searchText.includes('invalid'))
  ) {
    return Object.assign(new Error('Token do Mercado Pago inválido ou não autorizado.'), {
      code: 'MERCADOPAGO_INVALID_TOKEN',
      statusCode: CHECKOUT_DOMAIN_STATUS.MERCADOPAGO_INVALID_TOKEN,
      details: normalized.payload,
    });
  }

  if (
    searchText.includes('without key enabled for qr') ||
    searchText.includes('collector user without key') ||
    searchText.includes('pix key')
  ) {
    return Object.assign(
      new Error('A conta do Mercado Pago não possui chave PIX habilitada para receber pagamentos.'),
      {
        code: 'PIX_KEY_NOT_CONFIGURED',
        statusCode: CHECKOUT_DOMAIN_STATUS.PIX_KEY_NOT_CONFIGURED,
        details: normalized.payload,
      },
    );
  }

  if (searchText.includes('financial identity')) {
    return Object.assign(
      new Error('O Mercado Pago recusou a criação do pagamento por validação financeira.'),
      {
        code: 'FINANCIAL_IDENTITY_ERROR',
        statusCode: CHECKOUT_DOMAIN_STATUS.FINANCIAL_IDENTITY_ERROR,
        details: normalized.payload,
      },
    );
  }

  if (
    searchText.includes('invalid user identification') ||
    searchText.includes('invalid identification') ||
    (searchText.includes('identification') && searchText.includes('invalid'))
  ) {
    return Object.assign(new Error('CPF/CNPJ inválido para o Mercado Pago.'), {
      code: 'INVALID_IDENTIFICATION',
      statusCode: CHECKOUT_DOMAIN_STATUS.INVALID_IDENTIFICATION,
      details: normalized.payload,
    });
  }

  return Object.assign(
    new Error('Não foi possível processar o pagamento no Mercado Pago. Tente novamente.'),
    {
      code: 'MERCADOPAGO_ERROR',
      statusCode: CHECKOUT_DOMAIN_STATUS.MERCADOPAGO_ERROR,
      details: normalized.payload,
    },
  );
}

// ========================================
// VALIDAÇÃO E CÁLCULO DE CUPOM
// ========================================

/**
 * Validar e calcular desconto do cupom para CURSOS
 * (Reutilizado de assinaturas.service.ts com adaptação para cursos)
 */
async function validarECalcularDescontoCurso(
  cupomCodigo: string | undefined,
  cursoId: string,
  usuarioId: string,
  valorOriginal: number,
): Promise<{
  valorFinal: number;
  desconto: number;
  cupomId: string | null;
  cupomInfo: CupomValidado | null;
}> {
  if (!cupomCodigo) {
    return { valorFinal: valorOriginal, desconto: 0, cupomId: null, cupomInfo: null };
  }

  const codigoNormalizado = cupomCodigo.trim().toUpperCase();

  const cupom = await prisma.cuponsDesconto.findUnique({
    where: { codigo: codigoNormalizado },
    include: {
      CuponsDescontoCursos: true,
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
      cupomInfo: {
        valido: false,
        erro: 'CUPOM_INATIVO',
        mensagem: 'Este cupom não está mais ativo',
      },
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
        cupomInfo: {
          valido: false,
          erro: 'CUPOM_AINDA_NAO_VALIDO',
          mensagem: 'Este cupom ainda não está válido',
        },
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
        cupomInfo: {
          valido: false,
          erro: 'CUPOM_ESGOTADO',
          mensagem: 'Este cupom já atingiu o limite de uso',
        },
      };
    }
  }

  // Verificar se o cupom se aplica a cursos (NÃO pode ser apenas para planos)
  if (cupom.aplicarEm === CuponsAplicarEm.APENAS_ASSINATURA) {
    return {
      valorFinal: valorOriginal,
      desconto: 0,
      cupomId: null,
      cupomInfo: {
        valido: false,
        erro: 'CUPOM_NAO_APLICAVEL',
        mensagem: 'Este cupom é válido apenas para planos empresariais',
      },
    };
  }

  // Verificar se o cupom se aplica ao curso específico
  if (cupom.aplicarEm === CuponsAplicarEm.APENAS_CURSOS && !cupom.aplicarEmTodosItens) {
    const cursoVinculado = cupom.CuponsDescontoCursos.find((c) => c.cursoId === cursoId);
    if (!cursoVinculado) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: {
          valido: false,
          erro: 'CUPOM_NAO_APLICAVEL_CURSO',
          mensagem: 'Este cupom não é válido para o curso selecionado',
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

// ========================================
// SERVIÇO PRINCIPAL
// ========================================

export const cursosCheckoutService = {
  async criarOuReativarInscricao(params: {
    turmaId: string;
    alunoId: string;
    codigo: string;
    status: 'AGUARDANDO_PAGAMENTO' | 'INSCRITO';
    statusPagamento: StatusPagamento;
    valorOriginal: number;
    valorDesconto: number;
    valorFinal: number;
    valorPago: number | null;
    cupomDescontoId: string | null;
    cupomDescontoCodigo: string | null;
    aceitouTermos: boolean;
    aceitouTermosIp?: string;
    aceitouTermosUserAgent?: string;
  }) {
    const existing = await prisma.cursosTurmasInscricoes.findUnique({
      where: {
        turmaId_alunoId: {
          turmaId: params.turmaId,
          alunoId: params.alunoId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    const payload = {
      codigo: params.codigo,
      status: params.status,
      statusPagamento: params.statusPagamento,
      valorOriginal: params.valorOriginal,
      valorDesconto: params.valorDesconto,
      valorFinal: params.valorFinal,
      valorPago: params.valorPago,
      cupomDescontoId: params.cupomDescontoId,
      cupomDescontoCodigo: params.cupomDescontoCodigo,
      aceitouTermos: params.aceitouTermos,
      aceitouTermosIp: params.aceitouTermosIp,
      aceitouTermosUserAgent: params.aceitouTermosUserAgent,
      aceitouTermosEm: new Date(),
      mpPaymentId: null,
      metodoPagamento: null,
      pixQrCode: null,
      pixQrCodeBase64: null,
      boletoCodigo: null,
      boletoUrl: null,
      pagamentoExpiraEm: null,
      tokenAcesso: null,
      tokenAcessoExpiraEm: null,
    };

    if (!existing) {
      try {
        return await prisma.cursosTurmasInscricoes.create({
          data: {
            turmaId: params.turmaId,
            alunoId: params.alunoId,
            ...payload,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw Object.assign(new Error('Você já possui inscrição ativa nesta turma'), {
            code: 'INSCRICAO_DUPLICADA_TURMA',
            statusCode: 409,
          });
        }

        throw error;
      }
    }

    if (existing.status === 'INSCRITO' || existing.status === 'AGUARDANDO_PAGAMENTO') {
      throw Object.assign(new Error('Você já possui inscrição ativa nesta turma'), {
        code: 'INSCRICAO_DUPLICADA_TURMA',
        statusCode: 409,
      });
    }

    return prisma.cursosTurmasInscricoes.update({
      where: { id: existing.id },
      data: payload,
    });
  },

  /**
   * Gerar código único de inscrição (ex: MAT2024001)
   */
  async gerarCodigoInscricao(): Promise<string> {
    const ano = new Date().getFullYear();
    const ultimaInscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: { codigo: { startsWith: `MAT${ano}` } },
      orderBy: { criadoEm: 'desc' },
      select: { codigo: true },
    });

    let numero = 1;
    if (ultimaInscricao?.codigo) {
      const match = ultimaInscricao.codigo.match(/MAT\d{4}(\d{3})/);
      if (match) numero = parseInt(match[1], 10) + 1;
    }

    return `MAT${ano}${numero.toString().padStart(3, '0')}`;
  },

  /**
   * Gerar token JWT único de acesso ao curso
   */
  gerarTokenAcesso(params: {
    inscricaoId: string;
    alunoId: string;
    cursoId: string;
    turmaId: string;
  }): { token: string; expiresAt: Date } {
    const secret = process.env.JWT_SECRET || 'secret-default';
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Token válido por 1 ano

    const token = jwt.sign(
      {
        inscricaoId: params.inscricaoId,
        alunoId: params.alunoId,
        cursoId: params.cursoId,
        turmaId: params.turmaId,
        tipo: 'ACESSO_CURSO',
      },
      secret,
      { expiresIn: '1y' },
    );

    return { token, expiresAt };
  },

  getPaymentIdempotencyKey(
    inscricaoId: string,
    pagamento: StartCursoCheckoutInput['pagamento'],
  ): string {
    return `curso-checkout:${inscricaoId}:${pagamento}`;
  },

  /**
   * Validar se aluno já possui inscrição na turma
   */
  async validarInscricaoDuplicada(alunoId: string, turmaId: string): Promise<boolean> {
    const existe = await prisma.cursosTurmasInscricoes.findFirst({
      where: {
        alunoId,
        turmaId,
        status: { in: ['INSCRITO', 'AGUARDANDO_PAGAMENTO'] },
      },
    });
    return !!existe;
  },

  /**
   * Validar vagas disponíveis na turma
   */
  async validarVagasDisponiveis(turmaId: string): Promise<boolean> {
    const turma = await prisma.cursosTurmas.findUnique({
      where: { id: turmaId },
      select: {
        vagasTotais: true,
        vagasIlimitadas: true,
        _count: {
          select: {
            CursosTurmasInscricoes: {
              where: { status: { notIn: ['CANCELADO', 'TRANCADO'] } },
            },
          },
        },
      },
    });

    if (!turma) throw new Error('Turma não encontrada');

    // Se não há limite, sempre tem vaga
    if (turma.vagasIlimitadas || !turma.vagasTotais || turma.vagasTotais === 0) return true;

    // Verificar se ainda há vagas
    return turma._count.CursosTurmasInscricoes < turma.vagasTotais;
  },

  /**
   * Criar inscrição gratuita (sem pagamento)
   */
  async criarInscricaoGratuita(params: {
    usuarioId: string;
    cursoId: string;
    turmaId: string;
    aceitouTermos: boolean;
    aceitouTermosIp?: string;
    aceitouTermosUserAgent?: string;
  }) {
    const codigo = await this.gerarCodigoInscricao();

    const inscricao = await this.criarOuReativarInscricao({
      codigo,
      turmaId: params.turmaId,
      alunoId: params.usuarioId,
      status: 'INSCRITO',
      statusPagamento: 'APROVADO',
      valorOriginal: 0,
      valorDesconto: 0,
      valorFinal: 0,
      valorPago: 0,
      cupomDescontoId: null,
      cupomDescontoCodigo: null,
      aceitouTermos: params.aceitouTermos,
      aceitouTermosIp: params.aceitouTermosIp,
      aceitouTermosUserAgent: params.aceitouTermosUserAgent,
    });

    // Gerar token de acesso
    const { token, expiresAt } = this.gerarTokenAcesso({
      inscricaoId: inscricao.id,
      alunoId: params.usuarioId,
      cursoId: params.cursoId,
      turmaId: params.turmaId,
    });

    // Atualizar com token
    const inscricaoAtualizada = await prisma.cursosTurmasInscricoes.update({
      where: { id: inscricao.id },
      data: {
        tokenAcesso: token,
        tokenAcessoExpiraEm: expiresAt,
      },
      include: {
        CursosTurmas: { include: { Cursos: true } },
        Usuarios: { select: { id: true, nomeCompleto: true, email: true } },
      },
    });

    logger.info('[CURSO_GRATUITO] Inscrição criada com sucesso', {
      inscricaoId: inscricao.id,
      codigo: inscricao.codigo,
      usuarioId: params.usuarioId,
      cursoId: params.cursoId,
    });

    return {
      success: true,
      inscricao: {
        id: inscricaoAtualizada.id,
        codigo: inscricaoAtualizada.codigo,
        alunoId: inscricaoAtualizada.alunoId,
        cursoId: params.cursoId,
        turmaId: inscricaoAtualizada.turmaId,
        status: inscricaoAtualizada.status,
        statusPagamento: inscricaoAtualizada.statusPagamento,
        tokenAcesso: inscricaoAtualizada.tokenAcesso,
        criadoEm: inscricaoAtualizada.criadoEm.toISOString(),
      },
      curso: inscricaoAtualizada.CursosTurmas.Cursos,
      termos: {
        aceitouTermos: params.aceitouTermos,
        aceitouTermosEm: new Date().toISOString(),
      },
    };
  },

  /**
   * Iniciar checkout de curso (PAGAMENTO ÚNICO)
   */
  async startCheckout(params: StartCursoCheckoutInput) {
    assertMercadoPagoConfigured();

    // 1. Validar curso existe e está disponível (PUBLICADO)
    const curso = await prisma.cursos.findUnique({
      where: { id: params.cursoId },
    });
    if (!curso) throw new Error('Curso não encontrado');
    if (curso.statusPadrao !== 'PUBLICADO') {
      throw new Error(
        'Curso não está disponível para compra. Apenas cursos publicados podem ser adquiridos.',
      );
    }

    // 2. Validar turma existe
    const turma = await prisma.cursosTurmas.findUnique({
      where: { id: params.turmaId },
      select: { id: true, cursoId: true, vagasTotais: true },
    });
    if (!turma) throw new Error('Turma não encontrada');
    if (turma.cursoId !== params.cursoId) {
      throw new Error('Turma não pertence ao curso selecionado');
    }

    // 3. Validar vagas disponíveis
    const temVaga = await this.validarVagasDisponiveis(params.turmaId);
    if (!temVaga) throw new Error('Não há vagas disponíveis nesta turma');

    // 4. Validar se aluno já está inscrito
    const jaInscrito = await this.validarInscricaoDuplicada(params.usuarioId, params.turmaId);
    if (jaInscrito) {
      throw new Error('Você já possui inscrição ativa nesta turma');
    }

    // 5. Buscar dados do usuário
    const usuario = await prisma.usuarios.findUnique({
      where: { id: params.usuarioId },
      include: {
        UsuariosEnderecos: { take: 1, orderBy: { criadoEm: 'asc' } },
        UsuariosInformation: { select: { telefone: true } },
      },
    });
    if (!usuario) throw new Error('Usuário não encontrado');

    // 6. Calcular valor com desconto
    const valorOriginal = curso.gratuito ? 0 : Number(curso.valor);
    const { valorFinal, desconto, cupomId, cupomInfo } = await validarECalcularDescontoCurso(
      params.cupomCodigo,
      params.cursoId,
      params.usuarioId,
      valorOriginal,
    );

    // Se cupom foi informado mas é inválido, retornar erro
    if (params.cupomCodigo && cupomInfo && !cupomInfo.valido) {
      throw new Error(cupomInfo.mensagem || 'Cupom inválido');
    }

    // 7. Se curso é gratuito, criar inscrição diretamente
    if (curso.gratuito || valorFinal === 0) {
      return await this.criarInscricaoGratuita({
        usuarioId: params.usuarioId,
        cursoId: params.cursoId,
        turmaId: params.turmaId,
        aceitouTermos: params.aceitouTermos,
        aceitouTermosIp: params.aceitouTermosIp,
        aceitouTermosUserAgent: params.aceitouTermosUserAgent,
      });
    }

    // 8. Criar ou reativar inscrição pendente
    const codigo = await this.gerarCodigoInscricao();
    const inscricao = await this.criarOuReativarInscricao({
      codigo,
      turmaId: params.turmaId,
      alunoId: params.usuarioId,
      status: 'AGUARDANDO_PAGAMENTO',
      statusPagamento: 'PENDENTE',
      valorOriginal,
      valorDesconto: desconto,
      valorFinal,
      valorPago: null,
      cupomDescontoId: cupomId ?? null,
      cupomDescontoCodigo: params.cupomCodigo || null,
      aceitouTermos: params.aceitouTermos,
      aceitouTermosIp: params.aceitouTermosIp,
      aceitouTermosUserAgent: params.aceitouTermosUserAgent,
    });

    logger.info('[CURSO_CHECKOUT] Inscrição pendente criada', {
      inscricaoId: inscricao.id,
      codigo: inscricao.codigo,
      valorFinal,
      metodoPagamento: params.pagamento,
    });

    // 9. Criar pagamento no Mercado Pago
    const mp = mpClient!;
    const paymentApi = new Payment(mp);
    const paymentIdempotencyKey = this.getPaymentIdempotencyKey(inscricao.id, params.pagamento);
    const titulo =
      desconto > 0 ? `${curso.nome} (com desconto de R$ ${desconto.toFixed(2)})` : curso.nome;

    // Preparar dados do pagador (reutilizando lógica de assinaturas)
    const { firstName, lastName } = splitName(usuario.nomeCompleto);

    // Validar e obter documento (CPF ou CNPJ)
    const documento = (() => {
      // Priorizar dados enviados pelo frontend
      if (params.payer?.identification?.number) {
        const docNumber = sanitizeDigits(params.payer.identification.number);
        const docType = params.payer.identification.type;

        if (docType === 'CPF') {
          if (!isValidCPF(docNumber)) {
            throw Object.assign(
              new Error(
                `CPF inválido: ${params.payer.identification.number}. Verifique se o CPF está correto (11 dígitos).`,
              ),
              { code: 'INVALID_CPF' },
            );
          }
          return { type: 'CPF' as const, number: docNumber };
        }
        if (docType === 'CNPJ') {
          if (!isValidCNPJ(docNumber)) {
            throw Object.assign(
              new Error(
                `CNPJ inválido: ${params.payer.identification.number}. Verifique se o CNPJ está correto (14 dígitos).`,
              ),
              { code: 'INVALID_CNPJ' },
            );
          }
          return { type: 'CNPJ' as const, number: docNumber };
        }
      }

      // Fallback: tentar usar dados do banco
      const cnpj = sanitizeDigits(usuario.cnpj);
      if (cnpj && isValidCNPJ(cnpj)) {
        return { type: 'CNPJ' as const, number: cnpj };
      }
      const cpf = sanitizeDigits(usuario.cpf);
      if (cpf && isValidCPF(cpf)) {
        return { type: 'CPF' as const, number: cpf };
      }

      return undefined;
    })();

    // Preparar endereço
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

    // Preparar telefone
    const phoneDigits = sanitizeDigits((usuario as any).UsuariosInformation?.telefone ?? '');
    const payerPhone =
      phoneDigits.length >= 10
        ? {
            area_code: phoneDigits.slice(0, 2),
            number: phoneDigits.slice(2),
          }
        : undefined;

    const payerBase = {
      email: params.payer?.email || usuario.email,
      first_name: params.payer?.first_name || firstName,
      last_name: params.payer?.last_name || lastName,
      identification: documento && documento.number ? documento : undefined,
      address: payerAddress && payerAddress.zip_code ? payerAddress : undefined,
      phone: params.payer?.phone || payerPhone,
    };

    try {
      // ========================================
      // PAGAMENTO VIA PIX
      // ========================================
      if (params.pagamento === 'pix') {
        if (!payerBase.email) {
          throw Object.assign(new Error('Email do pagador é obrigatório para PIX'), {
            code: 'PAYER_EMAIL_REQUIRED',
          });
        }

        if (!payerBase.identification?.number) {
          throw Object.assign(
            new Error('CPF ou CNPJ válido é obrigatório para pagamento via PIX'),
            { code: 'PAYER_IDENTIFICATION_REQUIRED' },
          );
        }

        logger.info('[PIX_CHECKOUT_CURSO] Criando pagamento PIX', {
          inscricaoId: inscricao.id,
          codigo: inscricao.codigo,
          valorFinal,
          requestId: paymentIdempotencyKey,
        });

        const pixPayment = (await paymentApi.create({
          body: {
            transaction_amount: valorFinal,
            description: titulo,
            payment_method_id: 'pix',
            external_reference: inscricao.id,
            payer: {
              email: payerBase.email,
              first_name: payerBase.first_name || undefined,
              last_name: payerBase.last_name || undefined,
              identification: payerBase.identification,
            },
          },
          requestOptions: { idempotencyKey: paymentIdempotencyKey },
        })) as MercadoPagoResponse;

        const pixBody = pixPayment.body ?? pixPayment;
        const mpPaymentId = pixBody?.id ? String(pixBody.id) : undefined;
        const statusPagamento = mapToStatusPagamento(pixBody?.status);
        const transactionData = pixBody?.point_of_interaction?.transaction_data || {};

        // Atualizar inscrição com dados do pagamento
        await prisma.cursosTurmasInscricoes.update({
          where: { id: inscricao.id },
          data: {
            mpPaymentId: mpPaymentId ?? null,
            statusPagamento,
            metodoPagamento: 'PIX',
            valorPago: statusPagamento === 'APROVADO' ? valorFinal : null,
            pixQrCode: transactionData.qr_code || null,
            pixQrCodeBase64: transactionData.qr_code_base64 || null,
            pagamentoExpiraEm: pixBody?.date_of_expiration
              ? new Date(pixBody.date_of_expiration)
              : null,
          },
        });

        // Incrementar uso do cupom
        if (cupomId) {
          await prisma.cuponsDesconto.update({
            where: { id: cupomId },
            data: { usosTotais: { increment: 1 } },
          });
        }

        logger.info('[PIX_CHECKOUT_CURSO] Pagamento PIX criado com sucesso', {
          inscricaoId: inscricao.id,
          mpPaymentId,
        });

        return {
          success: true,
          inscricao: {
            id: inscricao.id,
            codigo: inscricao.codigo,
            status: inscricao.status,
            statusPagamento,
          },
          pagamento: {
            tipo: 'pix',
            status: pixBody?.status ?? null,
            paymentId: mpPaymentId ?? null,
            qrCode: transactionData.qr_code || null,
            qrCodeBase64: transactionData.qr_code_base64 || null,
            expiresAt: pixBody?.date_of_expiration || null,
          },
          desconto:
            desconto > 0
              ? {
                  cupomCodigo: params.cupomCodigo,
                  cupomId,
                  valorOriginal,
                  valorDesconto: desconto,
                  valorFinal,
                }
              : null,
          termos: {
            aceitouTermos: params.aceitouTermos,
            aceitouTermosEm: new Date().toISOString(),
          },
        };
      }

      // ========================================
      // PAGAMENTO VIA CARTÃO
      // ========================================
      if (params.pagamento === 'card') {
        const cardData = params.card;
        if (!cardData?.token) {
          throw new Error('Token do cartão é obrigatório para pagamentos com cartão');
        }

        logger.info('[CARD_CHECKOUT_CURSO] Criando pagamento com cartão', {
          inscricaoId: inscricao.id,
          codigo: inscricao.codigo,
          valorFinal,
          installments: cardData.installments || 1,
          requestId: paymentIdempotencyKey,
        });

        const installments = cardData.installments ?? 1;
        const cardPayment = (await paymentApi.create({
          body: {
            transaction_amount: valorFinal,
            description: titulo,
            token: cardData.token,
            installments,
            external_reference: inscricao.id,
            payer: payerBase,
          },
          requestOptions: { idempotencyKey: paymentIdempotencyKey },
        })) as MercadoPagoResponse;

        const cardBody = cardPayment.body ?? cardPayment;
        const mpPaymentId = cardBody?.id ? String(cardBody.id) : undefined;
        const statusPagamento = mapToStatusPagamento(cardBody?.status);
        const ativo = statusPagamento === 'APROVADO';

        // Atualizar inscrição com dados do pagamento
        await prisma.cursosTurmasInscricoes.update({
          where: { id: inscricao.id },
          data: {
            mpPaymentId: mpPaymentId ?? null,
            statusPagamento,
            metodoPagamento:
              installments > 1 ? `CARTAO_CREDITO_${installments}X` : 'CARTAO_CREDITO',
            valorPago: ativo ? valorFinal : null,
            status: ativo ? 'INSCRITO' : 'AGUARDANDO_PAGAMENTO',
            pixQrCode: null,
            pixQrCodeBase64: null,
            boletoCodigo: null,
            boletoUrl: null,
            pagamentoExpiraEm: null,
          },
        });

        // Se aprovado, gerar token de acesso
        if (ativo) {
          const { token: accessToken, expiresAt } = this.gerarTokenAcesso({
            inscricaoId: inscricao.id,
            alunoId: params.usuarioId,
            cursoId: params.cursoId,
            turmaId: params.turmaId,
          });

          await prisma.cursosTurmasInscricoes.update({
            where: { id: inscricao.id },
            data: {
              tokenAcesso: accessToken,
              tokenAcessoExpiraEm: expiresAt,
            },
          });

          // Incrementar uso do cupom
          if (cupomId) {
            await prisma.cuponsDesconto.update({
              where: { id: cupomId },
              data: { usosTotais: { increment: 1 } },
            });
          }

          logger.info('[CARD_CHECKOUT_CURSO] Pagamento aprovado, token gerado', {
            inscricaoId: inscricao.id,
            mpPaymentId,
          });
        }

        return {
          success: true,
          inscricao: {
            id: inscricao.id,
            codigo: inscricao.codigo,
            status: ativo ? 'INSCRITO' : inscricao.status,
            statusPagamento,
            tokenAcesso: ativo
              ? await prisma.cursosTurmasInscricoes
                  .findUnique({
                    where: { id: inscricao.id },
                    select: { tokenAcesso: true },
                  })
                  .then((i) => i?.tokenAcesso)
              : undefined,
          },
          pagamento: {
            tipo: 'card',
            status: cardBody?.status ?? null,
            paymentId: mpPaymentId ?? null,
            installments,
          },
          desconto:
            desconto > 0
              ? {
                  cupomCodigo: params.cupomCodigo,
                  cupomId,
                  valorOriginal,
                  valorDesconto: desconto,
                  valorFinal,
                }
              : null,
          termos: {
            aceitouTermos: params.aceitouTermos,
            aceitouTermosEm: new Date().toISOString(),
          },
        };
      }

      // ========================================
      // PAGAMENTO VIA BOLETO
      // ========================================
      if (params.pagamento === 'boleto') {
        // Validar endereço completo (obrigatório para boleto)
        if (
          !payerBase.address?.zip_code ||
          !payerBase.address?.street_name ||
          !payerBase.address?.street_number ||
          !payerBase.address?.neighborhood ||
          !payerBase.address?.city ||
          !payerBase.address?.federal_unit
        ) {
          throw Object.assign(
            new Error(
              'Endereço completo é obrigatório para pagamento via Boleto. ' +
                'Por favor, informe: CEP, logradouro, número, bairro, cidade e estado.',
            ),
            { code: 'BOLETO_ADDRESS_REQUIRED' },
          );
        }

        logger.info('[BOLETO_CHECKOUT_CURSO] Criando pagamento Boleto', {
          inscricaoId: inscricao.id,
          codigo: inscricao.codigo,
          valorFinal,
          requestId: paymentIdempotencyKey,
        });

        const boletoPayment = (await paymentApi.create({
          body: {
            transaction_amount: valorFinal,
            description: titulo,
            payment_method_id: 'bolbradesco',
            external_reference: inscricao.id,
            payer: {
              ...payerBase,
              identification: documento && documento.number ? documento : undefined,
            },
          },
          requestOptions: { idempotencyKey: paymentIdempotencyKey },
        })) as MercadoPagoResponse;

        const boletoBody = boletoPayment.body ?? boletoPayment;
        const mpPaymentId = boletoBody?.id ? String(boletoBody.id) : undefined;
        const statusPagamento = mapToStatusPagamento(boletoBody?.status);
        const barcode =
          boletoBody?.barcode?.content ||
          boletoBody?.barcode ||
          boletoBody?.transaction_details?.external_resource_url ||
          null;
        const boletoUrl =
          boletoBody?.transaction_details?.external_resource_url ||
          boletoBody?.point_of_interaction?.transaction_data?.ticket_url ||
          null;

        // Atualizar inscrição com dados do pagamento
        await prisma.cursosTurmasInscricoes.update({
          where: { id: inscricao.id },
          data: {
            mpPaymentId: mpPaymentId ?? null,
            statusPagamento,
            metodoPagamento: 'BOLETO',
            valorPago: statusPagamento === 'APROVADO' ? valorFinal : null,
            boletoCodigo: barcode,
            boletoUrl,
            pagamentoExpiraEm: boletoBody?.date_of_expiration
              ? new Date(boletoBody.date_of_expiration)
              : null,
          },
        });

        // Incrementar uso do cupom
        if (cupomId) {
          await prisma.cuponsDesconto.update({
            where: { id: cupomId },
            data: { usosTotais: { increment: 1 } },
          });
        }

        logger.info('[BOLETO_CHECKOUT_CURSO] Pagamento Boleto criado com sucesso', {
          inscricaoId: inscricao.id,
          mpPaymentId,
        });

        return {
          success: true,
          inscricao: {
            id: inscricao.id,
            codigo: inscricao.codigo,
            status: inscricao.status,
            statusPagamento,
          },
          pagamento: {
            tipo: 'boleto',
            status: boletoBody?.status ?? null,
            paymentId: mpPaymentId ?? null,
            barcode,
            boletoUrl,
            expiresAt: boletoBody?.date_of_expiration || null,
          },
          desconto:
            desconto > 0
              ? {
                  cupomCodigo: params.cupomCodigo,
                  cupomId,
                  valorOriginal,
                  valorDesconto: desconto,
                  valorFinal,
                }
              : null,
          termos: {
            aceitouTermos: params.aceitouTermos,
            aceitouTermosEm: new Date().toISOString(),
          },
        };
      }

      // Método de pagamento não suportado
      throw new Error(`Método de pagamento não suportado: ${params.pagamento}`);
    } catch (error) {
      const normalized = normalizeMercadoPagoError(error);
      const checkoutError = toCheckoutPaymentError(error, normalized);
      logger.error('[CHECKOUT_CURSO_ERROR] Erro ao criar pagamento', {
        inscricaoId: inscricao.id,
        metodoPagamento: params.pagamento,
        requestId: paymentIdempotencyKey,
        code: checkoutError.code,
        message: checkoutError.message,
        error: normalized,
      });

      // Evita travar vagas quando a criação do pagamento falha antes de gerar cobrança válida.
      await prisma.cursosTurmasInscricoes
        .update({
          where: { id: inscricao.id },
          data: {
            status: 'CANCELADO',
            statusPagamento: 'CANCELADO',
            pagamentoExpiraEm: null,
          },
        })
        .catch((cleanupError) => {
          logger.error('[CHECKOUT_CURSO_ERROR] Falha ao limpar inscrição após erro de checkout', {
            inscricaoId: inscricao.id,
            error: normalizeMercadoPagoError(cleanupError),
          });
        });

      throw checkoutError;
    }
  },

  /**
   * Validar token de acesso ao curso
   */
  async validarTokenAcesso(token: string): Promise<{
    valido: boolean;
    inscricao?: any;
    erro?: string;
  }> {
    try {
      const secret = process.env.JWT_SECRET || 'secret-default';
      const decoded = jwt.verify(token, secret) as any;

      const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
        where: {
          id: decoded.inscricaoId,
          tokenAcesso: token,
        },
        include: {
          CursosTurmas: { include: { Cursos: true } },
          Usuarios: { select: { id: true, nomeCompleto: true, email: true } },
        },
      });

      if (!inscricao) {
        return { valido: false, erro: 'Inscrição não encontrada' };
      }

      if (inscricao.status !== 'INSCRITO') {
        return { valido: false, erro: 'Inscrição não está ativa' };
      }

      if (inscricao.tokenAcessoExpiraEm && new Date() > inscricao.tokenAcessoExpiraEm) {
        return { valido: false, erro: 'Token expirado' };
      }

      return { valido: true, inscricao };
    } catch (error) {
      logger.error('[VALIDAR_TOKEN] Erro ao validar token', { error });
      return { valido: false, erro: 'Token inválido ou expirado' };
    }
  },

  /**
   * Processar webhook de pagamento de curso
   */
  async handleWebhookPagamento(event: { type?: string; action?: string; data?: any }) {
    const { type, action, data } = event;

    if (type === 'payment' && (action === 'payment.created' || action === 'payment.updated')) {
      const mpPaymentId = String(data?.id ?? '');
      if (!mpPaymentId) return;

      // Buscar inscrição pelo mpPaymentId
      const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
        where: { mpPaymentId },
        include: { CursosTurmas: { include: { Cursos: true } } },
      });

      if (!inscricao) {
        logger.warn('[WEBHOOK] Inscrição não encontrada para mpPaymentId', { mpPaymentId });
        return;
      }

      let gatewayData = data;
      if (mpClient) {
        try {
          const fetched = (await new Payment(mpClient).get({ id: mpPaymentId })) as any;
          gatewayData = fetched?.body ?? fetched;
        } catch (error) {
          logger.warn('[WEBHOOK] Falha ao consultar pagamento no gateway', {
            mpPaymentId,
            error,
          });
        }
      }

      const status = String(gatewayData?.status || data?.status || '').toLowerCase();
      const statusPagamento = mapToStatusPagamento(status);

      logger.info('[WEBHOOK] Processando pagamento de curso', {
        mpPaymentId,
        inscricaoId: inscricao.id,
        status,
        statusPagamento,
      });

      // Se pagamento aprovado, ativar inscrição e gerar token
      if (PAYMENT_APPROVED_STATUSES.has(status)) {
        const { token, expiresAt } = this.gerarTokenAcesso({
          inscricaoId: inscricao.id,
          alunoId: inscricao.alunoId,
          cursoId: inscricao.CursosTurmas.cursoId,
          turmaId: inscricao.turmaId,
        });

        await prisma.cursosTurmasInscricoes.update({
          where: { id: inscricao.id },
          data: {
            status: 'INSCRITO',
            statusPagamento: 'APROVADO',
            tokenAcesso: token,
            tokenAcessoExpiraEm: expiresAt,
            valorPago: inscricao.valorFinal,
          },
        });

        // Incrementar uso do cupom (se foi usado)
        if (inscricao.cupomDescontoId) {
          await prisma.cuponsDesconto.update({
            where: { id: inscricao.cupomDescontoId },
            data: { usosTotais: { increment: 1 } },
          });
        }

        logger.info('[WEBHOOK] Inscrição ativada com sucesso', {
          inscricaoId: inscricao.id,
          codigo: inscricao.codigo,
        });

        // TODO: Enviar email de confirmação
      }

      // Se pagamento recusado
      if (PAYMENT_REJECTED_STATUSES.has(status) || PAYMENT_CANCELLED_STATUSES.has(status)) {
        await prisma.cursosTurmasInscricoes.update({
          where: { id: inscricao.id },
          data: {
            status: 'CANCELADO',
            statusPagamento: 'RECUSADO',
          },
        });

        logger.warn('[WEBHOOK] Pagamento recusado/cancelado', {
          inscricaoId: inscricao.id,
          status,
        });

        // TODO: Enviar email de falha
      }
    }
  },
};
