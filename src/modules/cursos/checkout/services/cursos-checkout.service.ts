import { prisma } from '@/config/prisma';
import { mpClient, assertMercadoPagoConfigured } from '@/config/mercadopago';
import { mercadopagoConfig, serverConfig } from '@/config/env';
import { Payment } from 'mercadopago';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';
import type { StartCursoCheckoutInput } from '../validators/cursos-checkout.schema';
import {
  CuponsAplicarEm,
  CuponsLimiteUso,
  CuponsPeriodo,
  WebsiteStatus,
  type StatusInscricao,
} from '@prisma/client';

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
        _count: {
          select: {
            CursosTurmasInscricoes: {
              where: { status: 'INSCRITO' },
            },
          },
        },
      },
    });

    if (!turma) throw new Error('Turma não encontrada');

    // Se não há limite, sempre tem vaga
    if (!turma.vagasTotais || turma.vagasTotais === 0) return true;

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

    const inscricao = await prisma.cursosTurmasInscricoes.create({
      data: {
        codigo,
        turmaId: params.turmaId,
        alunoId: params.usuarioId,
        status: 'INSCRITO',
        statusPagamento: 'APROVADO', // Curso gratuito = aprovado automaticamente
        valorOriginal: 0,
        valorDesconto: 0,
        valorFinal: 0,
        valorPago: 0,
        aceitouTermos: params.aceitouTermos,
        aceitouTermosIp: params.aceitouTermosIp,
        aceitouTermosUserAgent: params.aceitouTermosUserAgent,
        aceitouTermosEm: new Date(),
      },
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

    // 8. Criar inscrição pendente
    const codigo = await this.gerarCodigoInscricao();
    const inscricao = await prisma.cursosTurmasInscricoes.create({
      data: {
        codigo,
        turmaId: params.turmaId,
        alunoId: params.usuarioId,
        status: 'AGUARDANDO_PAGAMENTO',
        statusPagamento: 'PENDENTE',
        valorOriginal,
        valorDesconto: desconto,
        valorFinal,
        cupomDescontoId: cupomId,
        cupomDescontoCodigo: params.cupomCodigo || null,
        aceitouTermos: params.aceitouTermos,
        aceitouTermosIp: params.aceitouTermosIp,
        aceitouTermosUserAgent: params.aceitouTermosUserAgent,
        aceitouTermosEm: new Date(),
      },
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
        })) as MercadoPagoResponse;

        const pixBody = pixPayment.body ?? pixPayment;
        const mpPaymentId = pixBody?.id ? String(pixBody.id) : undefined;
        const statusPagamento = mapToStatusPagamento(pixBody?.status);
        const expiration = pixBody?.date_of_expiration
          ? new Date(pixBody.date_of_expiration)
          : null;

        // Atualizar inscrição com dados do pagamento
        await prisma.cursosTurmasInscricoes.update({
          where: { id: inscricao.id },
          data: {
            mpPaymentId: mpPaymentId ?? null,
            statusPagamento,
            metodoPagamento: 'PIX',
            valorPago: statusPagamento === 'APROVADO' ? valorFinal : null,
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

        const transactionData = pixBody?.point_of_interaction?.transaction_data || {};

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
        })) as MercadoPagoResponse;

        const boletoBody = boletoPayment.body ?? boletoPayment;
        const mpPaymentId = boletoBody?.id ? String(boletoBody.id) : undefined;
        const statusPagamento = mapToStatusPagamento(boletoBody?.status);
        const expiration = boletoBody?.date_of_expiration
          ? new Date(boletoBody.date_of_expiration)
          : null;

        // Atualizar inscrição com dados do pagamento
        await prisma.cursosTurmasInscricoes.update({
          where: { id: inscricao.id },
          data: {
            mpPaymentId: mpPaymentId ?? null,
            statusPagamento,
            metodoPagamento: 'BOLETO',
            valorPago: statusPagamento === 'APROVADO' ? valorFinal : null,
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

        const barcode =
          boletoBody?.barcode?.content ||
          boletoBody?.barcode ||
          boletoBody?.transaction_details?.external_resource_url ||
          null;
        const boletoUrl =
          boletoBody?.transaction_details?.external_resource_url ||
          boletoBody?.point_of_interaction?.transaction_data?.ticket_url ||
          null;

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
      logger.error('[CHECKOUT_CURSO_ERROR] Erro ao criar pagamento', {
        inscricaoId: inscricao.id,
        error: normalized,
      });
      throw new Error(`Erro ao processar pagamento: ${normalized.message}`);
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

      const status = String(data?.status || '').toLowerCase();
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
