/**
 * Serviço para auditoria de transações
 * @module auditoria/services/transacoes
 */

import { Prisma, TransacaoStatus, TransacaoTipo } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type {
  AuditoriaTransacaoDashboardContexto,
  AuditoriaTransacaoDashboardEmpresa,
  AuditoriaTransacaoDashboardItem,
  AuditoriaTransacaoDashboardUsuario,
  AuditoriaTransacaoInput,
  AuditoriaTransacaoResponse,
  AuditoriaTransacoesDashboardFilters,
  AuditoriaTransacoesDashboardListResponse,
  PaginatedResponse,
} from '../types';

const transacoesLogger = logger.child({ module: 'TransacoesService' });

const dashboardTransacaoInclude = {
  Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      role: true,
      codUsuario: true,
    },
  },
  Usuarios_AuditoriaTransacoes_empresaIdToUsuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      role: true,
      codUsuario: true,
    },
  },
} satisfies Prisma.AuditoriaTransacoesInclude;

type DashboardTransacaoRow = Prisma.AuditoriaTransacoesGetPayload<{
  include: typeof dashboardTransacaoInclude;
}>;

type DashboardMeta = Record<string, unknown>;

const tipoLabels: Record<TransacaoTipo, string> = {
  PAGAMENTO: 'Pagamento',
  REEMBOLSO: 'Reembolso',
  ESTORNO: 'Estorno',
  ASSINATURA: 'Assinatura',
  CUPOM: 'Cupom',
  TAXA: 'Taxa',
};

const statusLabels: Record<TransacaoStatus, string> = {
  PENDENTE: 'Pendente',
  PROCESSANDO: 'Processando',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CANCELADA: 'Cancelada',
  ESTORNADA: 'Estornada',
};

const gatewayLabels: Record<string, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  MERCADOPAGO: 'Mercado Pago',
  STRIPE: 'Stripe',
  PAGARME: 'Pagar.me',
  MANUAL: 'Manual',
};

const codigoPrefixos: Record<TransacaoTipo, string> = {
  PAGAMENTO: 'PGTO',
  REEMBOLSO: 'REEMB',
  ESTORNO: 'EST',
  ASSINATURA: 'ASS',
  CUPOM: 'CUP',
  TAXA: 'TAX',
};

const asJsonObject = (value: Prisma.JsonValue | null): DashboardMeta | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as DashboardMeta;
};

const getString = (object: DashboardMeta | null, ...keys: string[]): string | null => {
  if (!object) {
    return null;
  }

  for (const key of keys) {
    const value = object[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const getNestedObject = (object: DashboardMeta | null, key: string): DashboardMeta | null => {
  if (!object) {
    return null;
  }

  const value = object[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as DashboardMeta;
};

const normalizeGateway = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return value
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[.]+/g, '')
    .toUpperCase();
};

const getGatewayLabel = (gateway: string | null): string | null => {
  if (!gateway) {
    return null;
  }

  return (
    gatewayLabels[gateway] ??
    gateway
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ')
  );
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(value);

const compareStrings = (left: string | null | undefined, right: string | null | undefined) =>
  (left ?? '').localeCompare(right ?? '', 'pt-BR', { sensitivity: 'base' });

export class TransacoesService {
  /**
   * Registra uma nova transação
   */
  async registrarTransacao(input: AuditoriaTransacaoInput): Promise<AuditoriaTransacaoResponse> {
    try {
      const transacao = await prisma.auditoriaTransacoes.create({
        data: {
          tipo: input.tipo,
          status: 'PENDENTE' as any,
          valor: input.valor,
          moeda: input.moeda || 'BRL',
          referencia: input.referencia,
          gateway: input.gateway,
          gatewayId: input.gatewayId,
          usuarioId: input.usuarioId,
          empresaId: input.empresaId,
          metadata: input.metadata,
        },
        include: {
          Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
          Usuarios_AuditoriaTransacoes_empresaIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
      });

      transacoesLogger.info(
        { transacaoId: transacao.id, tipo: transacao.tipo, valor: transacao.valor },
        'Transação registrada',
      );

      return this.formatTransacaoResponse(transacao);
    } catch (error) {
      transacoesLogger.error({ err: error, input }, 'Erro ao registrar transação');
      throw error;
    }
  }

  /**
   * Atualiza status de uma transação
   */
  async atualizarStatusTransacao(
    id: string,
    status: string,
    metadata?: Record<string, any>,
  ): Promise<AuditoriaTransacaoResponse> {
    try {
      const transacao = await prisma.auditoriaTransacoes.update({
        where: { id },
        data: {
          status: status as any,
          processadoEm: new Date(),
          metadata: metadata ? { ...metadata } : undefined,
        },
        include: {
          Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
          Usuarios_AuditoriaTransacoes_empresaIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
      });

      transacoesLogger.info({ transacaoId: id, status }, 'Status da transação atualizado');

      return this.formatTransacaoResponse(transacao);
    } catch (error) {
      transacoesLogger.error({ err: error, id, status }, 'Erro ao atualizar status da transação');
      throw error;
    }
  }

  async listarTransacoesDashboard(
    filters: AuditoriaTransacoesDashboardFilters,
  ): Promise<AuditoriaTransacoesDashboardListResponse> {
    try {
      const baseWhere: Prisma.AuditoriaTransacoesWhereInput = {
        ...(filters.usuarioId ? { usuarioId: filters.usuarioId } : {}),
        ...(filters.empresaId ? { empresaId: filters.empresaId } : {}),
        ...(filters.dataInicio || filters.dataFim
          ? {
              criadoEm: {
                ...(filters.dataInicio ? { gte: new Date(filters.dataInicio) } : {}),
                ...(filters.dataFim ? { lte: new Date(filters.dataFim) } : {}),
              },
            }
          : {}),
      };

      const baseRows = await prisma.auditoriaTransacoes.findMany({
        where: baseWhere,
        include: dashboardTransacaoInclude,
      });

      const enrichment = await this.buildEnrichmentMaps(baseRows);
      const searchedRows = filters.search
        ? baseRows.filter((row) => this.matchesSearch(row, enrichment, filters.search!))
        : baseRows;

      const filtrosDisponiveis = this.buildFacetOptions(searchedRows);

      const filteredRows = searchedRows.filter((row) => this.matchesDashboardFilters(row, filters));
      const sortedRows = [...filteredRows].sort((left, right) =>
        this.compareDashboardRows(left, right, filters.sortBy, filters.sortDir),
      );

      const total = sortedRows.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / filters.pageSize);
      const skip = (filters.page - 1) * filters.pageSize;
      const pageRows = sortedRows.slice(skip, skip + filters.pageSize);

      const items = pageRows.map((row) => this.mapDashboardItem(row, enrichment));
      const valorTotal =
        filteredRows.reduce((sum, row) => sum + Math.round(Number(row.valor) * 100), 0) / 100;
      const ultimoEventoEm =
        filteredRows.length > 0
          ? filteredRows.reduce(
              (latest, row) => (row.criadoEm.getTime() > latest.getTime() ? row.criadoEm : latest),
              filteredRows[0].criadoEm,
            )
          : null;

      return {
        items,
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages,
        },
        resumo: {
          total,
          valorTotal,
          ultimoEventoEm: ultimoEventoEm?.toISOString() ?? null,
        },
        filtrosDisponiveis,
      };
    } catch (error) {
      transacoesLogger.error({ err: error, filters }, 'Erro ao listar transações para o dashboard');
      throw Object.assign(new Error('Não foi possível carregar as transações de auditoria.'), {
        code: 'AUDITORIA_TRANSACOES_ERROR',
        statusCode: 500,
      });
    }
  }

  /**
   * Lista transações com filtros
   */
  async listarTransacoes(
    filters: {
      tipo?: string;
      status?: string;
      usuarioId?: string;
      empresaId?: string;
      gateway?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PaginatedResponse<AuditoriaTransacaoResponse>> {
    try {
      const where: any = {};

      if (filters.tipo) {
        where.tipo = filters.tipo;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.usuarioId) {
        where.usuarioId = filters.usuarioId;
      }

      if (filters.empresaId) {
        where.empresaId = filters.empresaId;
      }

      if (filters.gateway) {
        where.gateway = filters.gateway;
      }

      if (filters.startDate || filters.endDate) {
        where.criadoEm = {};
        if (filters.startDate) {
          where.criadoEm.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.criadoEm.lte = new Date(filters.endDate);
        }
      }

      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const skip = (page - 1) * pageSize;

      // Queries sequenciais para evitar saturar pool no Supabase Free
      const transacoes = await prisma.auditoriaTransacoes.findMany({
        where,
        include: {
          Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
          Usuarios_AuditoriaTransacoes_empresaIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      });
      const total = await prisma.auditoriaTransacoes.count({ where });

      const totalPages = Math.ceil(total / pageSize);

      return {
        items: transacoes.map((transacao) => this.formatTransacaoResponse(transacao)),
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      transacoesLogger.error({ err: error, filters }, 'Erro ao listar transações');
      throw error;
    }
  }

  /**
   * Obtém uma transação específica
   */
  async obterTransacaoPorId(id: string): Promise<AuditoriaTransacaoResponse | null> {
    try {
      const transacao = await prisma.auditoriaTransacoes.findUnique({
        where: { id },
        include: {
          Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
          Usuarios_AuditoriaTransacoes_empresaIdToUsuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!transacao) {
        return null;
      }

      return this.formatTransacaoResponse(transacao);
    } catch (error) {
      transacoesLogger.error({ err: error, id }, 'Erro ao obter transação por ID');
      throw error;
    }
  }

  /**
   * Obtém transações por usuário
   */
  async obterTransacoesPorUsuario(
    usuarioId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaTransacaoResponse>> {
    return this.listarTransacoes({
      usuarioId,
      page,
      pageSize,
    });
  }

  /**
   * Obtém transações por empresa
   */
  async obterTransacoesPorEmpresa(
    empresaId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaTransacaoResponse>> {
    return this.listarTransacoes({
      empresaId,
      page,
      pageSize,
    });
  }

  /**
   * Obtém estatísticas de transações
   */
  async obterEstatisticasTransacoes() {
    try {
      // Queries sequenciais para evitar saturar pool no Supabase Free
      const totalTransacoes = await this.contarTransacoes();
      const transacoesPorTipo = await this.obterTransacoesPorTipo();
      const transacoesPorStatus = await this.obterTransacoesPorStatus();
      const transacoesPorGateway = await this.obterTransacoesPorGateway();
      const transacoesPorPeriodo = await this.obterTransacoesPorPeriodo();
      const valorTotal = await this.calcularValorTotal();
      const valorPorPeriodo = await this.calcularValorPorPeriodo();

      return {
        totalTransacoes,
        transacoesPorTipo,
        transacoesPorStatus,
        transacoesPorGateway,
        transacoesPorPeriodo,
        valorTotal,
        valorPorPeriodo,
      };
    } catch (error) {
      transacoesLogger.error({ err: error }, 'Erro ao obter estatísticas de transações');
      throw error;
    }
  }

  /**
   * Obtém resumo financeiro
   */
  async obterResumoFinanceiro() {
    try {
      const hoje = new Date();
      const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
      const semanaPassada = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
      const mesPassado = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Queries sequenciais para evitar saturar pool no Supabase Free
      const receitaHoje = await this.calcularReceitaPeriodo(hoje);
      const receitaOntem = await this.calcularReceitaPeriodo(ontem, hoje);
      const receitaSemana = await this.calcularReceitaPeriodo(semanaPassada);
      const receitaMes = await this.calcularReceitaPeriodo(mesPassado);
      const transacoesHoje = await this.contarTransacoesPeriodo(hoje);
      const transacoesOntem = await this.contarTransacoesPeriodo(ontem, hoje);
      const transacoesSemana = await this.contarTransacoesPeriodo(semanaPassada);
      const transacoesMes = await this.contarTransacoesPeriodo(mesPassado);

      return {
        receitaHoje,
        receitaOntem,
        receitaSemana,
        receitaMes,
        transacoesHoje,
        transacoesOntem,
        transacoesSemana,
        transacoesMes,
        tendenciaReceita: this.calcularTendencia(receitaHoje, receitaOntem),
        tendenciaTransacoes: this.calcularTendencia(transacoesHoje, transacoesOntem),
      };
    } catch (error) {
      transacoesLogger.error({ err: error }, 'Erro ao obter resumo financeiro');
      throw error;
    }
  }

  private async buildEnrichmentMaps(rows: DashboardTransacaoRow[]) {
    const cursoIds = new Set<string>();
    const planoIds = new Set<string>();

    for (const row of rows) {
      const meta = asJsonObject(row.metadata);
      const curso = getNestedObject(meta, 'curso');
      const plano = getNestedObject(meta, 'plano');

      const cursoId = getString(meta, 'cursoId') ?? getString(curso, 'id');
      const planoId =
        getString(meta, 'planoId', 'planosEmpresariaisId', 'empresasPlanoId') ??
        getString(plano, 'id');

      if (cursoId) {
        cursoIds.add(cursoId);
      }

      if (planoId) {
        planoIds.add(planoId);
      }
    }

    const [cursos, planos] = await Promise.all([
      cursoIds.size > 0
        ? prisma.cursos.findMany({
            where: { id: { in: [...cursoIds] } },
            select: { id: true, codigo: true, nome: true },
          })
        : Promise.resolve([]),
      planoIds.size > 0
        ? prisma.planosEmpresariais.findMany({
            where: { id: { in: [...planoIds] } },
            select: { id: true, nome: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      cursos: new Map(cursos.map((curso) => [curso.id, curso])),
      planos: new Map(planos.map((plano) => [plano.id, plano])),
    };
  }

  private buildDashboardContext(
    row: DashboardTransacaoRow,
    enrichment: Awaited<ReturnType<TransacoesService['buildEnrichmentMaps']>>,
  ): AuditoriaTransacaoDashboardContexto {
    const meta = asJsonObject(row.metadata);
    const cursoMeta = getNestedObject(meta, 'curso');
    const planoMeta = getNestedObject(meta, 'plano');

    const cursoId = getString(meta, 'cursoId') ?? getString(cursoMeta, 'id');
    const planoId =
      getString(meta, 'planoId', 'planosEmpresariaisId', 'empresasPlanoId') ??
      getString(planoMeta, 'id');

    const curso = cursoId ? enrichment.cursos.get(cursoId) : null;
    const plano = planoId ? enrichment.planos.get(planoId) : null;

    return {
      cursoNome:
        getString(meta, 'cursoNome') ?? getString(cursoMeta, 'nome') ?? curso?.nome ?? null,
      cursoId: cursoId ?? null,
      planoNome:
        getString(meta, 'planoNome') ?? getString(planoMeta, 'nome') ?? plano?.nome ?? null,
      planoId: planoId ?? null,
      origem: getString(meta, 'origem', 'origin'),
      metodoPagamento: getString(
        meta,
        'metodoPagamento',
        'paymentMethod',
        'payment_method_id',
        'metodo',
      ),
    };
  }

  private buildDashboardUser(
    row: DashboardTransacaoRow,
  ): AuditoriaTransacaoDashboardUsuario | null {
    const usuario = row.Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios;

    if (!usuario) {
      return null;
    }

    return {
      id: usuario.id,
      nome: usuario.nomeCompleto,
      email: usuario.email ?? null,
      codigo: usuario.codUsuario ?? null,
    };
  }

  private buildDashboardCompany(
    row: DashboardTransacaoRow,
  ): AuditoriaTransacaoDashboardEmpresa | null {
    const empresa = row.Usuarios_AuditoriaTransacoes_empresaIdToUsuarios;

    if (!empresa) {
      return null;
    }

    return {
      id: empresa.id,
      nomeExibicao: empresa.nomeCompleto,
      codigo: empresa.codUsuario ?? null,
    };
  }

  private buildGatewayValue(row: DashboardTransacaoRow): string | null {
    const meta = asJsonObject(row.metadata);
    return normalizeGateway(row.gateway ?? getString(meta, 'gateway', 'gatewayName'));
  }

  private buildGatewayReference(row: DashboardTransacaoRow): string | null {
    const meta = asJsonObject(row.metadata);

    return (
      getString(
        meta,
        'referenciaExterna',
        'externalRef',
        'externalReference',
        'providerReference',
      ) ??
      row.gatewayId ??
      row.referencia ??
      null
    );
  }

  private buildDisplayCode(row: DashboardTransacaoRow): string {
    const meta = asJsonObject(row.metadata);
    const explicitCode = getString(meta, 'codigoExibicao', 'displayCode');

    if (explicitCode) {
      return explicitCode;
    }

    const base =
      getString(meta, 'referenciaExterna', 'externalRef', 'externalReference') ??
      row.gatewayId ??
      row.referencia ??
      row.id;

    const normalized = base.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const suffix = normalized.slice(-6).padStart(6, '0');

    return `${codigoPrefixos[row.tipo]}-${suffix}`;
  }

  private buildDashboardDescription(
    row: DashboardTransacaoRow,
    enrichment: Awaited<ReturnType<TransacoesService['buildEnrichmentMaps']>>,
  ): string {
    const meta = asJsonObject(row.metadata);
    const context = this.buildDashboardContext(row, enrichment);
    const empresa = this.buildDashboardCompany(row);
    const tipoLabel = tipoLabels[row.tipo];
    const statusLabel = statusLabels[row.status];
    const explicitDescription =
      getString(meta, 'descricao', 'descricaoCompleta', 'description') ?? row.referencia ?? null;

    if (getString(meta, 'descricao', 'descricaoCompleta', 'description')) {
      return explicitDescription!;
    }

    switch (row.tipo) {
      case TransacaoTipo.PAGAMENTO:
        if (context.cursoNome) return `Compra do curso ${context.cursoNome}.`;
        if (context.planoNome) return `Pagamento do plano ${context.planoNome}.`;
        if (empresa?.nomeExibicao) return `Pagamento registrado para ${empresa.nomeExibicao}.`;
        break;
      case TransacaoTipo.ASSINATURA:
        if (context.planoNome) return `Assinatura do plano ${context.planoNome}.`;
        if (empresa?.nomeExibicao) return `Assinatura registrada para ${empresa.nomeExibicao}.`;
        break;
      case TransacaoTipo.REEMBOLSO:
        if (context.cursoNome) return `Reembolso do curso ${context.cursoNome}.`;
        if (context.planoNome) return `Reembolso do plano ${context.planoNome}.`;
        break;
      case TransacaoTipo.ESTORNO:
        return `Estorno da transação ${this.buildDisplayCode(row)}.`;
      case TransacaoTipo.CUPOM:
        return explicitDescription
          ? `Aplicação de cupom: ${explicitDescription}.`
          : 'Aplicação de cupom.';
      case TransacaoTipo.TAXA:
        return explicitDescription
          ? `Lançamento de taxa: ${explicitDescription}.`
          : 'Lançamento de taxa.';
    }

    if (explicitDescription) {
      return `${tipoLabel}: ${explicitDescription}.`;
    }

    return `${tipoLabel} ${statusLabel.toLowerCase()}.`;
  }

  private buildDashboardMeta(row: DashboardTransacaoRow): Record<string, unknown> | null {
    const meta = asJsonObject(row.metadata);
    const gatewayStatus = getString(meta, 'gatewayStatus', 'gateway_status', 'providerStatus');
    const referenciaExterna = this.buildGatewayReference(row);

    const payload: Record<string, unknown> = meta ? { ...meta } : {};

    if (gatewayStatus) {
      payload.gatewayStatus = gatewayStatus;
    }

    if (referenciaExterna) {
      payload.referenciaExterna = referenciaExterna;
    }

    return Object.keys(payload).length > 0 ? payload : null;
  }

  private mapDashboardItem(
    row: DashboardTransacaoRow,
    enrichment: Awaited<ReturnType<TransacoesService['buildEnrichmentMaps']>>,
  ): AuditoriaTransacaoDashboardItem {
    const valor = Number(row.valor);
    const gateway = this.buildGatewayValue(row);

    return {
      id: row.id,
      codigoExibicao: this.buildDisplayCode(row),
      tipo: row.tipo,
      tipoLabel: tipoLabels[row.tipo],
      status: row.status,
      statusLabel: statusLabels[row.status],
      valor,
      moeda: row.moeda,
      valorFormatado: formatCurrency(valor, row.moeda),
      gateway,
      gatewayLabel: getGatewayLabel(gateway),
      gatewayReferencia: this.buildGatewayReference(row),
      descricao: this.buildDashboardDescription(row, enrichment),
      usuario: this.buildDashboardUser(row),
      empresa: this.buildDashboardCompany(row),
      contexto: this.buildDashboardContext(row, enrichment),
      meta: this.buildDashboardMeta(row),
      criadoEm: row.criadoEm.toISOString(),
      atualizadoEm: (row.processadoEm ?? row.criadoEm).toISOString(),
    };
  }

  private buildSearchIndex(
    row: DashboardTransacaoRow,
    enrichment: Awaited<ReturnType<TransacoesService['buildEnrichmentMaps']>>,
  ): string {
    const context = this.buildDashboardContext(row, enrichment);
    const usuario = this.buildDashboardUser(row);
    const empresa = this.buildDashboardCompany(row);
    const gateway = this.buildGatewayValue(row);
    const gatewayLabel = getGatewayLabel(gateway);
    const meta = asJsonObject(row.metadata);

    return [
      this.buildDisplayCode(row),
      this.buildDashboardDescription(row, enrichment),
      row.referencia,
      row.tipo,
      tipoLabels[row.tipo],
      row.status,
      statusLabels[row.status],
      gateway,
      gatewayLabel,
      this.buildGatewayReference(row),
      usuario?.nome,
      usuario?.email,
      usuario?.codigo,
      empresa?.nomeExibicao,
      empresa?.codigo,
      context.cursoNome,
      context.planoNome,
      context.origem,
      context.metodoPagamento,
      getString(meta, 'gatewayStatus', 'gateway_status', 'providerStatus'),
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .toLowerCase();
  }

  private matchesSearch(
    row: DashboardTransacaoRow,
    enrichment: Awaited<ReturnType<TransacoesService['buildEnrichmentMaps']>>,
    search: string,
  ) {
    const normalizedSearch = search.trim().toLowerCase();
    return this.buildSearchIndex(row, enrichment).includes(normalizedSearch);
  }

  private matchesDashboardFilters(
    row: DashboardTransacaoRow,
    filters: AuditoriaTransacoesDashboardFilters,
  ) {
    if (filters.tipos.length > 0 && !filters.tipos.includes(row.tipo)) {
      return false;
    }

    if (filters.status.length > 0 && !filters.status.includes(row.status)) {
      return false;
    }

    if (filters.gateway) {
      const gateway = this.buildGatewayValue(row);
      if (gateway !== normalizeGateway(filters.gateway)) {
        return false;
      }
    }

    return true;
  }

  private compareDashboardRows(
    left: DashboardTransacaoRow,
    right: DashboardTransacaoRow,
    sortBy: AuditoriaTransacoesDashboardFilters['sortBy'],
    sortDir: AuditoriaTransacoesDashboardFilters['sortDir'],
  ) {
    const direction = sortDir === 'asc' ? 1 : -1;

    let comparison = 0;
    switch (sortBy) {
      case 'tipo':
        comparison = compareStrings(tipoLabels[left.tipo], tipoLabels[right.tipo]);
        break;
      case 'status':
        comparison = compareStrings(statusLabels[left.status], statusLabels[right.status]);
        break;
      case 'valor':
        comparison = Number(left.valor) - Number(right.valor);
        break;
      case 'gateway':
        comparison = compareStrings(this.buildGatewayValue(left), this.buildGatewayValue(right));
        break;
      case 'criadoEm':
      default:
        comparison = left.criadoEm.getTime() - right.criadoEm.getTime();
        break;
    }

    if (comparison === 0) {
      comparison = left.criadoEm.getTime() - right.criadoEm.getTime();
    }

    return comparison * direction;
  }

  private buildFacetOptions(rows: DashboardTransacaoRow[]) {
    const tipos = new Map<TransacaoTipo, number>();
    const status = new Map<TransacaoStatus, number>();
    const gateways = new Map<string, number>();

    for (const row of rows) {
      tipos.set(row.tipo, (tipos.get(row.tipo) ?? 0) + 1);
      status.set(row.status, (status.get(row.status) ?? 0) + 1);

      const gateway = this.buildGatewayValue(row);
      if (gateway) {
        gateways.set(gateway, (gateways.get(gateway) ?? 0) + 1);
      }
    }

    return {
      tipos: [...tipos.entries()]
        .map(([value, count]) => ({
          value,
          label: tipoLabels[value],
          count,
        }))
        .sort((left, right) => right.count - left.count || compareStrings(left.label, right.label)),
      status: [...status.entries()]
        .map(([value, count]) => ({
          value,
          label: statusLabels[value],
          count,
        }))
        .sort((left, right) => right.count - left.count || compareStrings(left.label, right.label)),
      gateways: [...gateways.entries()]
        .map(([value, count]) => ({
          value,
          label: getGatewayLabel(value) ?? value,
          count,
        }))
        .sort((left, right) => right.count - left.count || compareStrings(left.label, right.label)),
    };
  }

  /**
   * Conta total de transações
   */
  private async contarTransacoes(): Promise<number> {
    return prisma.auditoriaTransacoes.count();
  }

  /**
   * Conta transações em um período
   */
  private async contarTransacoesPeriodo(startDate: Date, endDate?: Date): Promise<number> {
    const where: any = {
      criadoEm: { gte: startDate },
    };

    if (endDate) {
      where.criadoEm.lte = endDate;
    }

    return prisma.auditoriaTransacoes.count({ where });
  }

  /**
   * Obtém transações agrupadas por tipo
   */
  private async obterTransacoesPorTipo() {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['tipo'],
      _count: { tipo: true },
    });

    return result.reduce(
      (acc, item) => {
        acc[item.tipo] = item._count.tipo;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Obtém transações agrupadas por status
   */
  private async obterTransacoesPorStatus() {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    return result.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Obtém transações agrupadas por gateway
   */
  private async obterTransacoesPorGateway() {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['gateway'],
      where: { gateway: { not: null } },
      _count: { gateway: true },
    });

    return result.reduce(
      (acc, item) => {
        acc[item.gateway || 'N/A'] = item._count.gateway;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Obtém transações agrupadas por período
   */
  private async obterTransacoesPorPeriodo() {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['criadoEm'],
      where: {
        criadoEm: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias
        },
      },
      _count: { criadoEm: true },
    });

    return result.map((item) => ({
      data: item.criadoEm.toISOString().split('T')[0],
      total: item._count.criadoEm,
    }));
  }

  /**
   * Calcula valor total das transações
   */
  private async calcularValorTotal(): Promise<number> {
    const result = await prisma.auditoriaTransacoes.aggregate({
      _sum: { valor: true },
    });

    return Number(result._sum.valor) || 0;
  }

  /**
   * Calcula valor por período
   */
  private async calcularValorPorPeriodo(): Promise<{ data: string; valor: number }[]> {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['criadoEm'],
      where: {
        criadoEm: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias
        },
      },
      _sum: { valor: true },
    });

    return result.map((item) => ({
      data: item.criadoEm.toISOString().split('T')[0],
      valor: Number(item._sum.valor) || 0,
    }));
  }

  /**
   * Calcula receita em um período
   */
  private async calcularReceitaPeriodo(startDate: Date, endDate?: Date): Promise<number> {
    const where: any = {
      criadoEm: { gte: startDate },
      status: 'APROVADA',
    };

    if (endDate) {
      where.criadoEm.lte = endDate;
    }

    const result = await prisma.auditoriaTransacoes.aggregate({
      where,
      _sum: { valor: true },
    });

    return Number(result._sum.valor) || 0;
  }

  /**
   * Calcula tendência
   */
  private calcularTendencia(hoje: number, ontem: number): 'crescendo' | 'diminuindo' | 'estavel' {
    if (hoje > ontem) return 'crescendo';
    if (hoje < ontem) return 'diminuindo';
    return 'estavel';
  }

  /**
   * Formata resposta da transação
   */
  private formatTransacaoResponse(transacao: any): AuditoriaTransacaoResponse {
    return {
      id: transacao.id,
      tipo: transacao.tipo,
      status: transacao.status,
      valor: transacao.valor,
      moeda: transacao.moeda,
      referencia: transacao.referencia,
      gateway: transacao.gateway,
      gatewayId: transacao.gatewayId,
      usuarioId: transacao.usuarioId,
      empresaId: transacao.empresaId,
      metadata: transacao.metadata,
      criadoEm: transacao.criadoEm,
      processadoEm: transacao.processadoEm,
      usuario: transacao.Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios,
      empresa: transacao.Usuarios_AuditoriaTransacoes_empresaIdToUsuarios,
    };
  }
}

export const transacoesService = new TransacoesService();
