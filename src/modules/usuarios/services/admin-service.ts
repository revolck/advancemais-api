/**
 * Service administrativo - Lógica de negócio
 * Responsabilidade única: operações administrativas no banco
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import {
  AuditoriaCategoria,
  Prisma,
  Roles,
  Status,
  TiposDeUsuarios,
  CandidatoLogTipo,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { prisma, retryOperation } from '@/config/prisma';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { logger } from '@/utils/logger';
import { invalidateCacheByPrefix, getCachedOrFetch, generateCacheKey } from '@/utils/cache';
import { attachEnderecoResumo } from '../utils/address';
import { mergeUsuarioInformacoes, usuarioInformacoesSelect } from '../utils/information';
import {
  getOptimizedUserSelect,
  optimizeSearchFilter,
  optimizeAddressFilter,
  QueryProfiler,
} from '../utils/query-optimizer';
import {
  mapSocialLinks,
  usuarioRedesSociaisSelect,
  sanitizeSocialLinks,
  buildSocialLinksUpdateData,
} from '../utils/social-links';
import { candidaturasService } from '@/modules/candidatos/candidaturas/services';
import { candidatoLogsService } from '@/modules/candidatos/logs/service';
import {
  buildUserDataForDatabase,
  checkForDuplicates,
  createUserWithTransaction,
  extractAdminSocialLinks,
  processUserTypeSpecificData,
} from '../register/user-creation-helpers';
import type { AdminCreateUserInput } from '../validators/auth.schema';
import {
  buildEmailVerificationSummary,
  normalizeEmailVerification,
  UsuariosVerificacaoEmailSelect,
} from '../utils/email-verification';
import {
  buildUserProfileSnapshot,
  diffSnapshot,
  getUserHistoryConfig,
  getUserRoleLabel,
  recordUserAuditEvent,
  type UserHistoryCategoria,
  type UserHistoryTipo,
} from '../utils/user-history';

type AdminEnderecoInput = {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
};

type AdminEnderecoData = Partial<AdminEnderecoInput> & { atualizadoEm: Date };

const sanitizeAdminEnderecoInput = (
  endereco?: AdminEnderecoInput | null,
): AdminEnderecoData | null => {
  if (!endereco || typeof endereco !== 'object') {
    return null;
  }

  const sanitized: Partial<AdminEnderecoInput> = {};

  const assign = (key: keyof AdminEnderecoInput, value?: string | null) => {
    if (value === undefined) return;
    if (value === null) {
      sanitized[key] = null;
      return;
    }

    const trimmed = value.trim();
    sanitized[key] = trimmed.length > 0 ? trimmed : null;
  };

  assign('logradouro', endereco.logradouro ?? undefined);
  assign('numero', endereco.numero ?? undefined);
  assign('bairro', endereco.bairro ?? undefined);
  assign('cidade', endereco.cidade ?? undefined);

  if (endereco.estado !== undefined) {
    const estadoTrimmed = (endereco.estado ?? '').trim();
    sanitized.estado = estadoTrimmed.length > 0 ? estadoTrimmed.toUpperCase() : null;
  }

  if (endereco.cep !== undefined) {
    const digitsOnly = (endereco.cep ?? '').replace(/\D/g, '');
    sanitized.cep = digitsOnly.length > 0 ? digitsOnly : null;
  }

  if (Object.keys(sanitized).length === 0) {
    return null;
  }

  return {
    ...sanitized,
    atualizadoEm: new Date(),
  };
};

const serializeEmailVerificationAudit = (
  verification: ReturnType<typeof normalizeEmailVerification>,
): Prisma.JsonObject => ({
  emailVerificado: verification.emailVerificado,
  emailVerificadoEm: verification.emailVerificadoEm?.toISOString() ?? null,
  emailVerificationToken: verification.emailVerificationToken,
  emailVerificationTokenExp: verification.emailVerificationTokenExp?.toISOString() ?? null,
  emailVerificationAttempts: verification.emailVerificationAttempts,
  ultimaTentativaVerificacao: verification.ultimaTentativaVerificacao?.toISOString() ?? null,
});

const userHistoryActorSelect = {
  id: true,
  nomeCompleto: true,
  role: true,
  UsuariosInformation: {
    select: {
      avatarUrl: true,
    },
  },
} satisfies Prisma.UsuariosSelect;

const userHistoryTargetSelect = {
  id: true,
  nomeCompleto: true,
  email: true,
  role: true,
  status: true,
  criadoEm: true,
  tipoUsuario: true,
  cpf: true,
  cnpj: true,
  UsuariosInformation: {
    select: {
      telefone: true,
      genero: true,
      dataNasc: true,
      descricao: true,
      avatarUrl: true,
      inscricao: true,
    },
  },
  UsuariosRedesSociais: {
    select: {
      linkedin: true,
      instagram: true,
      facebook: true,
      youtube: true,
      twitter: true,
      tiktok: true,
    },
  },
  UsuariosEnderecos: {
    orderBy: { criadoEm: 'asc' },
    select: {
      logradouro: true,
      numero: true,
      bairro: true,
      cidade: true,
      estado: true,
      cep: true,
    },
  },
  UsuariosVerificacaoEmail: {
    select: UsuariosVerificacaoEmailSelect,
  },
} satisfies Prisma.UsuariosSelect;

type UserHistoryTarget = Prisma.UsuariosGetPayload<{ select: typeof userHistoryTargetSelect }>;

type UserHistoryAuditRow = Prisma.AuditoriaLogsGetPayload<{
  include: {
    Usuarios: {
      select: typeof userHistoryActorSelect;
    };
  };
}>;

export class AdminService {
  private readonly log = logger.child({ module: 'AdminService' });

  constructor() {}

  /**
   * Calcula o progresso do curso baseado em aulas concluídas, provas realizadas e tempo decorrido
   */
  private async calcularProgressoInscricao(
    inscricaoId: string,
    turmaId: string,
    dataInicio: Date | null,
    dataFim: Date | null,
  ): Promise<number> {
    try {
      // Buscar contagem de aulas e provas da turma (sequencial para evitar saturar pool)
      const totalAulas = await prisma.cursosTurmasAulas.count({
        where: { turmaId },
      });
      const totalProvas = await prisma.cursosTurmasProvas.count({
        where: { turmaId },
      });
      const aulasComFrequencia = await prisma.cursosFrequenciaAlunos.count({
        where: { inscricaoId, status: 'PRESENTE' },
      });
      const provasComEnvio = await prisma.cursosTurmasProvasEnvios.count({
        where: { inscricaoId },
      });

      // Se não há aulas nem provas, calcular por tempo decorrido
      if (totalAulas === 0 && totalProvas === 0) {
        if (dataInicio && dataFim) {
          const agora = new Date();
          const inicio = new Date(dataInicio).getTime();
          const fim = new Date(dataFim).getTime();
          const atual = agora.getTime();

          if (fim > inicio) {
            const progressoPorTempo = Math.min(
              100,
              Math.max(0, ((atual - inicio) / (fim - inicio)) * 100),
            );
            return Math.round(progressoPorTempo);
          }
        }
        return 0;
      }

      // Calcular progresso baseado em aulas e provas
      let progressoAulas = 0;
      let progressoProvas = 0;
      let pesoAulas = 0.6; // Peso padrão para aulas
      let pesoProvas = 0.4; // Peso padrão para provas

      if (totalAulas > 0) {
        progressoAulas = (aulasComFrequencia / totalAulas) * 100;
      }

      if (totalProvas > 0) {
        progressoProvas = (provasComEnvio / totalProvas) * 100;
      }

      // Ajustar pesos se um dos componentes não existe
      if (totalAulas === 0 && totalProvas > 0) {
        pesoAulas = 0;
        pesoProvas = 1;
      } else if (totalAulas > 0 && totalProvas === 0) {
        pesoAulas = 1;
        pesoProvas = 0;
      }

      const progressoFinal = progressoAulas * pesoAulas + progressoProvas * pesoProvas;
      return Math.round(Math.min(100, Math.max(0, progressoFinal)));
    } catch (error) {
      this.log.warn({ err: error, inscricaoId, turmaId }, '❌ Erro ao calcular progresso do curso');
      return 0;
    }
  }

  private createServiceError(
    message: string,
    statusCode: number,
    code?: string,
    details?: unknown,
  ) {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    if (code) {
      (error as any).code = code;
    }
    if (details) {
      (error as any).details = details;
    }
    return error;
  }

  private getStatusFilter(status?: string) {
    if (!status) return undefined;

    const normalized = status.trim().toUpperCase();
    if (normalized in Status) {
      return Status[normalized as keyof typeof Status];
    }

    return undefined;
  }

  private getRoleFilter(role?: string) {
    if (!role) return undefined;

    const normalized = role.trim().toUpperCase();
    if (normalized in Roles) {
      return Roles[normalized as keyof typeof Roles];
    }

    return undefined;
  }

  private getTipoUsuarioFilter(tipoUsuario?: string) {
    if (!tipoUsuario) return undefined;

    const normalized = tipoUsuario.trim().toUpperCase();
    if (normalized in TiposDeUsuarios) {
      return TiposDeUsuarios[normalized as keyof typeof TiposDeUsuarios];
    }

    return undefined;
  }

  /**
   * Lista usuários com filtros e paginação
   * @param query - Parâmetros de consulta
   * @param options - Opções adicionais (incluindo role do usuário logado)
   */
  async listarUsuarios(query: unknown, options?: { userRole?: string }) {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).default(50),
      status: z.string().optional(),
      role: z.string().optional(),
      tipoUsuario: z.string().optional(),
      cidade: z.string().optional(),
      estado: z.string().optional(),
    });

    const { page, limit, status, role, tipoUsuario, cidade, estado } = querySchema.parse(query);
    const pageSize = Math.min(Number(limit) || 50, 100);
    const skip = (page - 1) * pageSize;

    // Construir filtros dinamicamente
    const where: Prisma.UsuariosWhereInput = {};
    const statusFilter = this.getStatusFilter(status);
    const tipoUsuarioFilter = this.getTipoUsuarioFilter(tipoUsuario);

    // Se o usuário for PEDAGOGICO, filtrar apenas ALUNO_CANDIDATO e INSTRUTOR
    if (options?.userRole === Roles.PEDAGOGICO) {
      // PEDAGOGICO só pode ver ALUNO_CANDIDATO e INSTRUTOR
      // Se tentar filtrar por outra role, não retornar nada
      if (role && role !== Roles.ALUNO_CANDIDATO && role !== Roles.INSTRUTOR) {
        return {
          message: 'Lista de usuários',
          usuarios: [],
          pagination: {
            page,
            limit: pageSize,
            total: 0,
            pages: 0,
          },
        };
      }
      // Forçar filtro para apenas ALUNO_CANDIDATO e INSTRUTOR
      where.role = {
        in: [Roles.ALUNO_CANDIDATO, Roles.INSTRUTOR],
      };
    } else if (options?.userRole === Roles.SETOR_DE_VAGAS) {
      // SETOR_DE_VAGAS só pode ver EMPRESA e ALUNO_CANDIDATO (com currículos)
      // Se tentar filtrar por outra role, não retornar nada
      if (role && role !== Roles.EMPRESA && role !== Roles.ALUNO_CANDIDATO) {
        return {
          message: 'Lista de usuários',
          usuarios: [],
          pagination: {
            page,
            limit: pageSize,
            total: 0,
            pages: 0,
          },
        };
      }
      // Se filtrar apenas por EMPRESA, retornar apenas empresas
      if (role === Roles.EMPRESA) {
        where.role = Roles.EMPRESA;
      } else if (role === Roles.ALUNO_CANDIDATO) {
        // Se filtrar apenas por ALUNO_CANDIDATO, retornar apenas alunos com currículos
        where.role = Roles.ALUNO_CANDIDATO;
        where.UsuariosCurriculos = {
          some: {}, // Pelo menos um currículo
        };
      } else {
        // Se não houver filtro de role, retornar EMPRESA OU ALUNO_CANDIDATO com currículos
        where.OR = [
          { role: Roles.EMPRESA },
          {
            role: Roles.ALUNO_CANDIDATO,
            UsuariosCurriculos: {
              some: {}, // Pelo menos um currículo
            },
          },
        ];
      }
    } else {
      // Para outros roles, usar filtro normal
      const roleFilter = this.getRoleFilter(role);
      if (roleFilter) where.role = roleFilter;
    }

    if (statusFilter) where.status = statusFilter;
    if (tipoUsuarioFilter) where.tipoUsuario = tipoUsuarioFilter;

    // ✅ OTIMIZAÇÃO: Usar filtros otimizados com índices
    const addressFilter = optimizeAddressFilter(cidade, estado);
    if (addressFilter) {
      where.UsuariosEnderecos = addressFilter.UsuariosEnderecos;
    }

    // ✅ OTIMIZAÇÃO: Seleção otimizada de campos (sem redes sociais para listagem geral)
    const select = getOptimizedUserSelect({
      includeRedesSociais: false, // Não incluir redes sociais em listagem geral
      includeEnderecoCompleto: true, // Incluir endereço completo
      includeInformacoesCompletas: true,
    });

    // ✅ OTIMIZAÇÃO: Cache para queries de listagem (TTL: 30s)
    const cacheKey = generateCacheKey('users:list', {
      page,
      limit: pageSize,
      status,
      role,
      tipoUsuario,
      cidade,
      estado,
      userRole: options?.userRole,
    });

    const startTime = Date.now();
    const [usuarios, total] = await getCachedOrFetch(
      cacheKey,
      async () => {
        return await retryOperation(
          async () => {
            // Queries sequenciais para evitar saturar pool no Supabase Free
            const usuariosResult = await prisma.usuarios.findMany({
              where,
              select,
              // ✅ Usar índice composto para melhor performance
              orderBy: { criadoEm: 'desc' },
              skip,
              take: pageSize,
            });
            const totalResult = await prisma.usuarios.count({ where });
            return [usuariosResult, totalResult] as const;
          },
          2, // Reduzir tentativas para fail-fast
          1000, // Delay menor
          20000, // Timeout maior (20s) para queries complexas
        );
      },
      30, // Cache de 30 segundos para listagens
    );

    // ✅ Profiler: Registrar query
    const duration = Date.now() - startTime;
    QueryProfiler.record('listarUsuarios', duration);

    const usuariosComEndereco = usuarios.map(
      (usuario) => attachEnderecoResumo(mergeUsuarioInformacoes(usuario))!,
    );

    // ✅ OTIMIZAÇÃO: Buscar currículos e inscrições apenas para ALUNO_CANDIDATO
    const alunosIds = usuariosComEndereco
      .filter((u) => u.role === Roles.ALUNO_CANDIDATO)
      .map((u) => u.id);

    const vinculosMap: Record<
      string,
      { curriculos: { id: string }[]; cursosInscricoes: { id: string }[] }
    > = {};

    if (alunosIds.length > 0) {
      // Buscar currículos e inscrições sequencialmente para evitar saturar pool
      const curriculos = await prisma.usuariosCurriculos.findMany({
        where: { usuarioId: { in: alunosIds } },
        select: { id: true, usuarioId: true },
      });
      const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
        where: { alunoId: { in: alunosIds } },
        select: { id: true, alunoId: true },
      });

      // Inicializar map com arrays vazios para todos os alunos
      alunosIds.forEach((id) => {
        vinculosMap[id] = {
          curriculos: [],
          cursosInscricoes: [],
        };
      });

      // Agrupar currículos por usuarioId
      curriculos.forEach((curriculo) => {
        if (vinculosMap[curriculo.usuarioId]) {
          vinculosMap[curriculo.usuarioId].curriculos.push({ id: curriculo.id });
        }
      });

      // Agrupar inscrições por alunoId
      inscricoes.forEach((inscricao) => {
        if (vinculosMap[inscricao.alunoId]) {
          vinculosMap[inscricao.alunoId].cursosInscricoes.push({ id: inscricao.id });
        }
      });
    }

    // Adicionar campos curriculos e cursosInscricoes apenas para ALUNO_CANDIDATO
    const usuariosComVinculos = usuariosComEndereco.map((usuario) => {
      if (usuario.role === Roles.ALUNO_CANDIDATO) {
        const vinculos = vinculosMap[usuario.id] || {
          curriculos: [],
          cursosInscricoes: [],
        };
        return {
          ...usuario,
          curriculos: vinculos.curriculos,
          cursosInscricoes: vinculos.cursosInscricoes,
        };
      }
      return usuario;
    });

    return {
      message: 'Lista de usuários',
      usuarios: usuariosComVinculos,
      pagination: {
        page,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Invalida cache de listagens após criar/atualizar usuário
   */
  private async invalidateListCache(): Promise<void> {
    try {
      await invalidateCacheByPrefix('users:list:');
      await invalidateCacheByPrefix('instrutores:list:');
      await invalidateCacheByPrefix('candidatos:list:');
    } catch (error) {
      this.log.warn({ err: error }, 'Falha ao invalidar cache de listagens');
    }
  }

  private assertPedagogicoCanManageUser(
    actingRole: string | undefined,
    targetRole: Roles,
    action: 'visualizar' | 'editar' | 'liberar validacao de email' | 'liberar acesso',
  ) {
    if (actingRole !== Roles.PEDAGOGICO) {
      return;
    }

    if (targetRole !== Roles.ALUNO_CANDIDATO && targetRole !== Roles.INSTRUTOR) {
      throw Object.assign(
        new Error(`PEDAGOGICO só pode ${action} usuários com role ALUNO_CANDIDATO ou INSTRUTOR`),
        {
          code: 'FORBIDDEN_USER_ROLE',
          statusCode: 403,
        },
      );
    }
  }

  private getHistoryTargetSummary(
    usuario: Pick<UserHistoryTarget, 'id' | 'nomeCompleto' | 'email' | 'role' | 'status'>,
  ) {
    return {
      id: usuario.id,
      nomeCompleto: usuario.nomeCompleto,
      email: usuario.email,
      role: usuario.role,
      status: usuario.status,
    };
  }

  private async ensureHistoryTarget(userId: string, userRole?: string) {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: userHistoryTargetSelect,
    });

    if (!usuario) {
      throw this.createServiceError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    this.assertPedagogicoCanManageUser(userRole, usuario.role, 'visualizar');

    return usuario;
  }

  private normalizeHistoryAuditItem(log: UserHistoryAuditRow, alvo: UserHistoryTarget) {
    const config = getUserHistoryConfig(log.acao || log.tipo);
    const metadata = (log.metadata as Record<string, unknown> | null) ?? null;

    return {
      id: log.id,
      tipo: config.tipo,
      categoria: config.categoria,
      titulo: config.titulo,
      descricao: log.descricao,
      dataHora: log.criadoEm.toISOString(),
      ator: log.Usuarios
        ? {
            id: log.Usuarios.id,
            nome: log.Usuarios.nomeCompleto,
            role: log.Usuarios.role,
            roleLabel: getUserRoleLabel(log.Usuarios.role),
            avatarUrl: log.Usuarios.UsuariosInformation?.avatarUrl ?? null,
          }
        : null,
      alvo: this.getHistoryTargetSummary(alvo),
      contexto: {
        ip: log.ip ?? (metadata?.ip as string | null) ?? null,
        userAgent: log.userAgent ?? (metadata?.userAgent as string | null) ?? null,
        origem: (metadata?.origem as string | null) ?? null,
      },
      dadosAnteriores: (log.dadosAnteriores as Record<string, unknown> | null) ?? null,
      dadosNovos: (log.dadosNovos as Record<string, unknown> | null) ?? null,
      meta: metadata,
    };
  }

  private normalizeHistoryBlockItem(
    log: Prisma.UsuariosEmBloqueiosLogsGetPayload<{
      include: {
        Usuarios: {
          select: typeof userHistoryActorSelect;
        };
        UsuariosEmBloqueios: {
          select: {
            id: true;
            tipo: true;
            motivo: true;
            observacoes: true;
            status: true;
            inicio: true;
            fim: true;
          };
        };
      };
    }>,
    alvo: UserHistoryTarget,
  ) {
    const isRevogacao = log.acao === 'REVOGACAO';
    const action = isRevogacao ? 'USUARIO_DESBLOQUEADO' : 'USUARIO_BLOQUEADO';
    const config = getUserHistoryConfig(action);

    return {
      id: `bloqueio-${log.id}`,
      tipo: config.tipo,
      categoria: config.categoria,
      titulo: config.titulo,
      descricao:
        log.descricao ??
        (isRevogacao
          ? 'Bloqueio revogado pelo painel administrativo.'
          : 'Bloqueio aplicado pelo painel administrativo.'),
      dataHora: log.criadoEm.toISOString(),
      ator: log.Usuarios
        ? {
            id: log.Usuarios.id,
            nome: log.Usuarios.nomeCompleto,
            role: log.Usuarios.role,
            roleLabel: getUserRoleLabel(log.Usuarios.role),
            avatarUrl: log.Usuarios.UsuariosInformation?.avatarUrl ?? null,
          }
        : null,
      alvo: this.getHistoryTargetSummary(alvo),
      contexto: {
        ip: null,
        userAgent: null,
        origem: 'PAINEL_ADMIN',
      },
      dadosAnteriores: isRevogacao
        ? {
            status: Status.BLOQUEADO,
            bloqueioId: log.UsuariosEmBloqueios.id,
            tipoBloqueio: log.UsuariosEmBloqueios.tipo,
          }
        : {
            status: Status.ATIVO,
          },
      dadosNovos: isRevogacao
        ? {
            status: Status.ATIVO,
          }
        : {
            status: Status.BLOQUEADO,
            bloqueioId: log.UsuariosEmBloqueios.id,
            tipoBloqueio: log.UsuariosEmBloqueios.tipo,
            motivo: log.UsuariosEmBloqueios.motivo,
          },
      meta: {
        motivo: log.UsuariosEmBloqueios.motivo,
        tipoBloqueio: log.UsuariosEmBloqueios.tipo,
        observacoes: log.UsuariosEmBloqueios.observacoes ?? null,
        inicio: log.UsuariosEmBloqueios.inicio.toISOString(),
        fim: log.UsuariosEmBloqueios.fim?.toISOString() ?? null,
        statusBloqueio: log.UsuariosEmBloqueios.status,
      },
    };
  }

  /**
   * Lista candidatos (role ALUNO_CANDIDATO) com filtros e paginação
   */
  async listarCandidatos(
    query: unknown,
    options?: { defaultLimit?: number; maxLimit?: number; forceLimit?: number },
  ) {
    const { defaultLimit = 50, maxLimit = 100, forceLimit } = options ?? {};

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(maxLimit).default(Math.min(defaultLimit, maxLimit)),
      status: z.string().optional(),
      tipoUsuario: z.string().optional(),
      search: z.string().optional(),
    });

    const { page, limit, status, tipoUsuario, search } = querySchema.parse(query);
    const pageSize = forceLimit ? Math.max(1, Math.min(forceLimit, maxLimit)) : limit;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UsuariosWhereInput = {
      role: Roles.ALUNO_CANDIDATO,
      UsuariosCurriculos: { some: {} },
    };

    const statusFilter = this.getStatusFilter(status);
    if (statusFilter) {
      where.status = statusFilter;
    }

    const tipoUsuarioFilter = this.getTipoUsuarioFilter(tipoUsuario);
    if (tipoUsuarioFilter) {
      where.tipoUsuario = tipoUsuarioFilter;
    }

    const searchTerm = search?.trim();
    if (searchTerm && searchTerm.length < 3) {
      throw Object.assign(new Error('Busca deve conter pelo menos 3 caracteres'), {
        statusCode: 400,
        code: 'SEARCH_TERM_TOO_SHORT',
      });
    }

    if (searchTerm) {
      where.OR = [
        { nomeCompleto: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { cpf: { contains: searchTerm, mode: 'insensitive' } },
        { codUsuario: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // ✅ Usar retryOperation para tratar erros de conexão automaticamente
    const [candidatos, total] = await retryOperation(
      () =>
        prisma.$transaction([
          prisma.usuarios.findMany({
            where,
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
              status: true,
              tipoUsuario: true,
              criadoEm: true,
              ultimoLogin: true,
              UsuariosInformation: { select: usuarioInformacoesSelect },
              UsuariosEnderecos: {
                orderBy: { criadoEm: 'asc' },
                select: {
                  id: true,
                  logradouro: true,
                  numero: true,
                  bairro: true,
                  cidade: true,
                  estado: true,
                  cep: true,
                },
              },
            },
            orderBy: { criadoEm: 'desc' },
            skip,
            take: pageSize,
          }),
          prisma.usuarios.count({ where }),
        ]),
      3, // maxRetries
      1000, // delayMs
      20000, // timeoutMs - 20s para queries complexas com joins
    );

    const candidatosComEndereco = candidatos.map(
      (candidato) => attachEnderecoResumo(mergeUsuarioInformacoes(candidato))!,
    );

    return {
      message: 'Lista de candidatos',
      candidatos: candidatosComEndereco,
      pagination: {
        page,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Busca usuário específico com detalhes
   */
  async buscarUsuario(userId: string, options?: { userRole?: string }) {
    if (!userId || userId.trim() === '') {
      throw new Error('ID do usuário é obrigatório');
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        cnpj: true,
        role: true,
        status: true,
        tipoUsuario: true,
        authId: true,
        ultimoLogin: true,
        criadoEm: true,
        atualizadoEm: true,
        UsuariosRedesSociais: {
          select: {
            id: true,
            instagram: true,
            linkedin: true,
            facebook: true,
            youtube: true,
            twitter: true,
            tiktok: true,
          },
        },
        codUsuario: true,
        UsuariosInformation: {
          select: usuarioInformacoesSelect,
        },
        UsuariosVerificacaoEmail: {
          select: UsuariosVerificacaoEmailSelect,
        },
        UsuariosEnderecos: {
          orderBy: { criadoEm: 'asc' },
          select: {
            id: true,
            logradouro: true,
            numero: true,
            bairro: true,
            cidade: true,
            estado: true,
            cep: true,
          },
        },
      },
    });

    if (!usuario) {
      return null;
    }

    this.assertPedagogicoCanManageUser(options?.userRole, usuario.role, 'visualizar');

    const usuarioComInformacoes = mergeUsuarioInformacoes(usuario);
    const usuarioNormalizado = attachEnderecoResumo(usuarioComInformacoes);

    if (!usuarioNormalizado) {
      return null;
    }

    const verificationSummary = buildEmailVerificationSummary(usuario.UsuariosVerificacaoEmail);

    // Buscar relações adicionais baseadas na role
    let relacoesAdicionais: any = {};

    if (usuario.role === Roles.ALUNO_CANDIDATO) {
      // Para ALUNO_CANDIDATO: incluir currículos, candidaturas e inscrições em cursos
      // Queries sequenciais para evitar saturar pool no Supabase Free
      const curriculos = await prisma.usuariosCurriculos.findMany({
        where: { usuarioId: userId },
        select: {
          id: true,
          titulo: true,
          resumo: true,
          objetivo: true,
          principal: true,
          areasInteresse: true,
          preferencias: true,
          habilidades: true,
          idiomas: true,
          experiencias: true,
          formacao: true,
          cursosCertificacoes: true,
          premiosPublicacoes: true,
          acessibilidade: true,
          consentimentos: true,
          criadoEm: true,
          atualizadoEm: true,
          ultimaAtualizacao: true,
        },
        orderBy: [{ principal: 'desc' }, { criadoEm: 'desc' }],
      });
      const candidaturas = await prisma.empresasCandidatos.findMany({
        where: { candidatoId: userId },
        select: {
          id: true,
          vagaId: true,
          curriculoId: true,
          statusId: true,
          origem: true,
          aplicadaEm: true,
          atualizadaEm: true,
          status_processo: {
            select: {
              id: true,
              nome: true,
              descricao: true,
              ativo: true,
            },
          },
          EmpresasVagas: {
            select: {
              id: true,
              titulo: true,
              slug: true,
              status: true,
            },
          },
        },
        orderBy: { aplicadaEm: 'desc' },
      });
      const inscricoesRaw = await prisma.cursosTurmasInscricoes.findMany({
        where: { alunoId: userId },
        select: {
          id: true,
          turmaId: true,
          status: true,
          criadoEm: true,
          CursosTurmas: {
            select: {
              id: true,
              nome: true,
              codigo: true,
              dataInicio: true,
              dataFim: true,
              status: true,
              Cursos: {
                select: {
                  id: true,
                  nome: true,
                  codigo: true,
                  descricao: true,
                  cargaHoraria: true,
                  imagemUrl: true,
                },
              },
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
      });

      // Mapear inscrições no formato correto com cálculo de progresso
      const cursosInscricoes = await Promise.all(
        inscricoesRaw.map(async (inscricao) => {
          const progresso = await this.calcularProgressoInscricao(
            inscricao.id,
            inscricao.CursosTurmas.id,
            inscricao.CursosTurmas.dataInicio,
            inscricao.CursosTurmas.dataFim,
          );

          return {
            id: inscricao.id,
            statusInscricao: inscricao.status,
            progresso,
            criadoEm: inscricao.criadoEm.toISOString(),
            turma: {
              id: inscricao.CursosTurmas.id,
              nome: inscricao.CursosTurmas.nome,
              codigo: inscricao.CursosTurmas.codigo,
              dataInicio: inscricao.CursosTurmas.dataInicio?.toISOString() ?? null,
              dataFim: inscricao.CursosTurmas.dataFim?.toISOString() ?? null,
              status: inscricao.CursosTurmas.status,
            },
            curso: {
              id: inscricao.CursosTurmas.Cursos.id,
              nome: inscricao.CursosTurmas.Cursos.nome,
              codigo: inscricao.CursosTurmas.Cursos.codigo,
              descricao: inscricao.CursosTurmas.Cursos.descricao ?? null,
              cargaHoraria: inscricao.CursosTurmas.Cursos.cargaHoraria,
              imagemUrl: inscricao.CursosTurmas.Cursos.imagemUrl ?? null,
            },
          };
        }),
      );

      relacoesAdicionais = {
        curriculos,
        candidaturas,
        cursosInscricoes,
      };
    } else if (usuario.role === Roles.EMPRESA) {
      // Para EMPRESA: incluir vagas da empresa
      const vagas = await prisma.empresasVagas.findMany({
        where: { usuarioId: userId },
        select: {
          id: true,
          titulo: true,
          slug: true,
          status: true,
          modalidade: true,
          regimeDeTrabalho: true,
          senioridade: true,
          localizacao: true,
          inseridaEm: true,
          CandidatosAreasInteresse: {
            select: {
              id: true,
              categoria: true,
            },
          },
          CandidatosSubareasInteresse: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
        orderBy: { inseridaEm: 'desc' },
      });

      relacoesAdicionais = { vagas };
    }

    return {
      ...usuarioNormalizado,
      redesSociais: mapSocialLinks(usuarioComInformacoes.redesSociais),
      informacoes: usuarioComInformacoes.informacoes,
      emailVerificado: verificationSummary.verified,
      emailVerificadoEm: verificationSummary.verifiedAt,
      UsuariosVerificacaoEmail: {
        verified: verificationSummary.verified,
        verifiedAt: verificationSummary.verifiedAt,
        tokenExpiration: verificationSummary.tokenExpiration,
        attempts: verificationSummary.attempts,
        lastAttemptAt: verificationSummary.lastAttemptAt,
      },
      ...relacoesAdicionais,
    };
  }

  /**
   * Busca candidato específico com detalhes
   */
  async buscarCandidato(userId: string) {
    if (!userId || userId.trim() === '') {
      throw new Error('ID do candidato é obrigatório');
    }

    const candidato = await prisma.usuarios.findFirst({
      where: {
        id: userId,
        role: Roles.ALUNO_CANDIDATO,
        UsuariosCurriculos: { some: {} },
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        role: true,
        status: true,
        tipoUsuario: true,
        authId: true,
        ultimoLogin: true,
        criadoEm: true,
        atualizadoEm: true,
        UsuariosRedesSociais: {
          select: {
            id: true,
            instagram: true,
            linkedin: true,
            facebook: true,
            youtube: true,
            twitter: true,
            tiktok: true,
          },
        },
        codUsuario: true,
        UsuariosInformation: {
          select: usuarioInformacoesSelect,
        },
        UsuariosEnderecos: {
          orderBy: { criadoEm: 'asc' },
          select: {
            id: true,
            logradouro: true,
            numero: true,
            bairro: true,
            cidade: true,
            estado: true,
            cep: true,
          },
        },
      },
    });

    if (!candidato) {
      return null;
    }

    const candidatoComInformacoes = mergeUsuarioInformacoes(candidato);
    const candidatoNormalizado = attachEnderecoResumo(candidatoComInformacoes);

    if (!candidatoNormalizado) {
      return null;
    }

    return {
      ...candidatoNormalizado,
      redesSociais: mapSocialLinks(candidatoComInformacoes.redesSociais),
      informacoes: candidatoComInformacoes.informacoes,
    };
  }

  async listarCandidatoLogs(userId: string, query: unknown) {
    if (!userId || userId.trim() === '') {
      throw new Error('ID do candidato é obrigatório');
    }

    const candidatoExiste = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!candidatoExiste) {
      throw new Error('Candidato não encontrado');
    }

    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      tipo: z.nativeEnum(CandidatoLogTipo).optional(),
    });

    const { page, limit, tipo } = schema.parse(query);
    const skip = (page - 1) * limit;

    const where: Prisma.UsuariosCandidatosLogsWhereInput = {
      usuarioId: userId,
      ...(tipo ? { tipo } : {}),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.usuariosCandidatosLogs.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
      prisma.usuariosCandidatosLogs.count({ where }),
    ]);

    return {
      message: 'Logs do candidato',
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async buscarHistoricoUsuario(
    userId: string,
    query: {
      page: number;
      pageSize: number;
      tipos?: string[];
      categorias?: string[];
      atorId?: string;
      atorRole?: Roles;
      dataInicio?: string;
      dataFim?: string;
      search?: string;
    },
    options?: { userRole?: string },
  ) {
    if (!userId || userId.trim() === '') {
      throw this.createServiceError('ID do usuário é obrigatório', 400, 'INVALID_ID');
    }

    const alvo = await this.ensureHistoryTarget(userId, options?.userRole);

    const auditWhere: Prisma.AuditoriaLogsWhereInput = {
      entidadeId: userId,
      entidadeTipo: 'USUARIO',
    };

    if (query.atorId) {
      auditWhere.usuarioId = query.atorId;
    }

    if (query.atorRole) {
      auditWhere.Usuarios = {
        is: {
          role: query.atorRole,
        },
      };
    }

    if (query.dataInicio || query.dataFim) {
      auditWhere.criadoEm = {};
      if (query.dataInicio) {
        auditWhere.criadoEm.gte = new Date(query.dataInicio);
      }
      if (query.dataFim) {
        auditWhere.criadoEm.lte = new Date(query.dataFim);
      }
    }

    if (query.search) {
      auditWhere.OR = [
        {
          descricao: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          acao: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          tipo: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [auditLogs, bloqueioLogs] = await Promise.all([
      prisma.auditoriaLogs.findMany({
        where: auditWhere,
        include: {
          Usuarios: {
            select: userHistoryActorSelect,
          },
        },
        orderBy: {
          criadoEm: 'desc',
        },
      }),
      prisma.usuariosEmBloqueiosLogs.findMany({
        where: {
          UsuariosEmBloqueios: {
            usuarioId: userId,
          },
          ...(query.atorId ? { criadoPorId: query.atorId } : {}),
          ...(query.dataInicio || query.dataFim
            ? {
                criadoEm: {
                  ...(query.dataInicio ? { gte: new Date(query.dataInicio) } : {}),
                  ...(query.dataFim ? { lte: new Date(query.dataFim) } : {}),
                },
              }
            : {}),
          ...(query.search
            ? {
                descricao: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              }
            : {}),
        },
        include: {
          Usuarios: {
            select: userHistoryActorSelect,
          },
          UsuariosEmBloqueios: {
            select: {
              id: true,
              tipo: true,
              motivo: true,
              observacoes: true,
              status: true,
              inicio: true,
              fim: true,
            },
          },
        },
        orderBy: {
          criadoEm: 'desc',
        },
      }),
    ]);

    const auditItems = auditLogs.map((log) => this.normalizeHistoryAuditItem(log, alvo));
    const bloqueioItems = bloqueioLogs
      .filter((log) => !query.atorRole || log.Usuarios?.role === query.atorRole)
      .map((log) => this.normalizeHistoryBlockItem(log, alvo));

    const hasCreatedEvent = auditItems.some((item) => item.tipo === 'USUARIO_CRIADO');
    const syntheticCreatedEvent = hasCreatedEvent
      ? []
      : [
          {
            id: `synthetic-user-created-${alvo.id}`,
            tipo: 'USUARIO_CRIADO' as UserHistoryTipo,
            categoria: 'CADASTRO' as UserHistoryCategoria,
            titulo: 'Conta criada',
            descricao: 'Conta criada no sistema.',
            dataHora: alvo.criadoEm.toISOString(),
            ator: null,
            alvo: this.getHistoryTargetSummary(alvo),
            contexto: {
              ip: null,
              userAgent: null,
              origem: 'SISTEMA',
            },
            dadosAnteriores: null,
            dadosNovos: buildUserProfileSnapshot({
              ...alvo,
              emailVerificado: alvo.UsuariosVerificacaoEmail?.emailVerificado ?? false,
              emailVerificadoEm: alvo.UsuariosVerificacaoEmail?.emailVerificadoEm ?? null,
            }),
            meta: {
              synthetic: true,
            },
          },
        ];

    const filteredItems = [...auditItems, ...bloqueioItems, ...syntheticCreatedEvent]
      .filter((item) => {
        if (query.tipos?.length && !query.tipos.includes(item.tipo)) {
          return false;
        }

        if (query.categorias?.length && !query.categorias.includes(item.categoria)) {
          return false;
        }

        if (query.atorId && item.ator?.id !== query.atorId) {
          return false;
        }

        if (query.atorRole && item.ator?.role !== query.atorRole) {
          return false;
        }

        if (query.search) {
          const haystacks = [
            item.titulo,
            item.descricao,
            item.tipo,
            item.categoria,
            item.ator?.nome,
            item.ator?.roleLabel,
            item.alvo.nomeCompleto,
            item.alvo.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          if (!haystacks.includes(query.search.toLowerCase())) {
            return false;
          }
        }

        return true;
      })
      .sort(
        (left, right) => new Date(right.dataHora).getTime() - new Date(left.dataHora).getTime(),
      );

    const total = filteredItems.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
    const skip = (query.page - 1) * query.pageSize;
    const items = filteredItems.slice(skip, skip + query.pageSize);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
      resumo: {
        total,
        ultimoEventoEm: filteredItems[0]?.dataHora ?? null,
      },
    };
  }

  /**
   * Atualiza status do usuário - TIPAGEM CORRETA
   */
  async atualizarStatus(
    userId: string,
    status: string,
    motivo?: string,
    options?: {
      actorId?: string;
      actorRole?: string;
      ip?: string | null;
      userAgent?: string | null;
    },
  ) {
    // Validações
    if (!userId || userId.trim() === '') {
      throw new Error('ID do usuário é obrigatório');
    }

    // Validação usando enum do Prisma
    const statusEnum = status.trim();

    // Buscar dados antes da atualização
    const usuarioAntes = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { status: true, email: true, nomeCompleto: true, role: true },
    });

    if (!usuarioAntes) {
      throw new Error('Usuário não encontrado');
    }

    // Atualizar status - CORREÇÃO: usando enum
    const usuario = await prisma.usuarios.update({
      where: { id: userId },
      data: { status: statusEnum as any },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        status: true,
        atualizadoEm: true,
        authId: true,
      },
    });

    await invalidateUserCache(usuario);

    if (options?.actorId) {
      await recordUserAuditEvent({
        client: prisma,
        actorId: options.actorId,
        actorRole: options.actorRole,
        targetUserId: usuario.id,
        action: 'USUARIO_STATUS_ALTERADO',
        descricao: `Status alterado de ${usuarioAntes.status} para ${statusEnum}.`,
        dadosAnteriores: {
          status: usuarioAntes.status,
        },
        dadosNovos: {
          status: usuario.status,
        },
        meta: {
          motivo: motivo ?? null,
          origem: 'PAINEL_ADMIN',
          targetRole: usuario.role,
        },
        ip: options.ip ?? null,
        userAgent: options.userAgent ?? null,
      });
    }

    if (
      usuario.role === Roles.ALUNO_CANDIDATO &&
      statusEnum === Status.BLOQUEADO &&
      usuarioAntes.status !== Status.BLOQUEADO
    ) {
      await candidaturasService.cancelForCandidato({
        usuarioId: usuario.id,
        motivo: 'BLOQUEIO',
      });

      await candidatoLogsService.create({
        usuarioId: usuario.id,
        tipo: CandidatoLogTipo.CANDIDATO_DESATIVADO,
        metadata: {
          motivo: 'BLOQUEIO_ADMINISTRATIVO',
          statusAnterior: usuarioAntes.status,
          statusAtual: statusEnum,
        },
      });
    }

    if (
      usuario.role === Roles.ALUNO_CANDIDATO &&
      usuarioAntes.status === Status.BLOQUEADO &&
      statusEnum !== Status.BLOQUEADO
    ) {
      const curriculosAtivos = await prisma.usuariosCurriculos.count({
        where: { usuarioId: usuario.id },
      });

      if (curriculosAtivos > 0) {
        await candidatoLogsService.create({
          usuarioId: usuario.id,
          tipo: CandidatoLogTipo.CANDIDATO_ATIVADO,
          metadata: {
            motivo: 'STATUS_RESTAURADO',
            statusAnterior: usuarioAntes.status,
            statusAtual: statusEnum,
          },
        });
      }
    }

    // Cancelamento de assinatura removido após retirada do provedor de pagamentos

    // Log da alteração
    this.log.info(
      {
        userId,
        statusAnterior: usuarioAntes.status,
        statusAtual: statusEnum,
        motivo,
      },
      'Status do usuário alterado',
    );

    return {
      message: 'Status do usuário atualizado com sucesso',
      usuario,
      statusAnterior: usuarioAntes.status,
    };
  }

  /**
   * Atualiza role do usuário - TIPAGEM CORRETA
   */
  async atualizarRole(
    userId: string,
    role: string,
    motivo?: string,
    adminId?: string,
    options?: {
      actorRole?: string;
      ip?: string | null;
      userAgent?: string | null;
    },
  ) {
    if (!userId || !role) {
      throw this.createServiceError(
        'ID do usuário e role são obrigatórios',
        400,
        'VALIDATION_ERROR',
      );
    }

    const roleEnum = role.trim() as Roles;

    if (!(roleEnum in Roles)) {
      throw this.createServiceError('Role inválida', 400, 'VALIDATION_ERROR');
    }

    const usuarioAntes = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        status: true,
        UsuariosVerificacaoEmail: {
          select: UsuariosVerificacaoEmailSelect,
        },
      },
    });

    if (!usuarioAntes) {
      throw this.createServiceError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    if (adminId && adminId === userId) {
      throw this.createServiceError(
        'Você não pode alterar sua própria função.',
        403,
        'FORBIDDEN_SELF_ROLE_CHANGE',
      );
    }

    if (options?.actorRole === Roles.PEDAGOGICO) {
      const pedagogicoAllowedRoles: Roles[] = [Roles.ALUNO_CANDIDATO, Roles.INSTRUTOR];
      if (
        !pedagogicoAllowedRoles.includes(usuarioAntes.role) ||
        !pedagogicoAllowedRoles.includes(roleEnum)
      ) {
        throw this.createServiceError(
          'PEDAGOGICO só pode alterar função entre ALUNO_CANDIDATO e INSTRUTOR.',
          403,
          'FORBIDDEN_USER_ROLE',
        );
      }
    }

    if (options?.actorRole === Roles.MODERADOR) {
      const restrictedRoles: Roles[] = [Roles.ADMIN, Roles.MODERADOR];
      if (restrictedRoles.includes(usuarioAntes.role) || restrictedRoles.includes(roleEnum)) {
        throw this.createServiceError(
          'MODERADOR não pode alterar usuários ADMIN/MODERADOR nem promover para essas funções.',
          403,
          'FORBIDDEN_USER_ROLE',
        );
      }
    }

    if (usuarioAntes.role === roleEnum) {
      throw this.createServiceError(
        'A função informada já está aplicada ao usuário.',
        409,
        'USER_ROLE_UPDATE_BLOCKED',
      );
    }

    const usuario = await prisma.usuarios.update({
      where: { id: userId },
      data: { role: roleEnum as Roles },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        status: true,
        atualizadoEm: true,
        UsuariosVerificacaoEmail: {
          select: UsuariosVerificacaoEmailSelect,
        },
      },
    });

    await invalidateUserCache(usuario);
    await this.invalidateListCache();

    if (adminId) {
      await recordUserAuditEvent({
        client: prisma,
        actorId: adminId,
        actorRole: options?.actorRole,
        targetUserId: usuario.id,
        action: 'USUARIO_ROLE_ALTERADA',
        descricao: `Role alterada de ${usuarioAntes.role} para ${usuario.role}.`,
        dadosAnteriores: {
          role: usuarioAntes.role,
        },
        dadosNovos: {
          role: usuario.role,
        },
        meta: {
          motivo: motivo ?? null,
          origem: 'PAINEL_ADMIN',
          statusAtual: usuarioAntes.status,
        },
        ip: options?.ip ?? null,
        userAgent: options?.userAgent ?? null,
      });
    }

    this.log.info(
      {
        userId,
        novaRole: roleEnum,
        motivo,
      },
      'Role do usuário alterada',
    );

    return {
      id: usuario.id,
      nomeCompleto: usuario.nomeCompleto,
      email: usuario.email,
      roleAnterior: usuarioAntes.role,
      role: usuario.role,
      status: usuario.status,
      emailVerificado: normalizeEmailVerification(usuario.UsuariosVerificacaoEmail).emailVerificado,
      emailVerificadoEm: normalizeEmailVerification(usuario.UsuariosVerificacaoEmail)
        .emailVerificadoEm,
      atualizadoEm: usuario.atualizadoEm,
    };
  }

  async criarUsuario(
    dados: AdminCreateUserInput,
    options?: { correlationId?: string; adminId?: string; userRole?: string },
  ) {
    const log = this.log.child({
      action: 'criarUsuarioAdmin',
      correlationId: options?.correlationId,
      adminId: options?.adminId,
    });

    log.info('Iniciando criação administrativa de usuário');

    if (dados.senha !== dados.confirmarSenha) {
      throw this.createServiceError('Senhas não conferem', 400, 'PASSWORD_MISMATCH');
    }

    const aceitarTermos = dados.aceitarTermos ?? true;
    const authId = dados.authId?.trim() || randomUUID();
    const normalizedRole =
      dados.role && Object.values(Roles).includes(dados.role)
        ? dados.role
        : dados.tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA
          ? Roles.EMPRESA
          : Roles.ALUNO_CANDIDATO;

    // Validação de permissões por role do criador
    const userRole = options?.userRole;

    if (userRole === Roles.MODERADOR) {
      // MODERADOR não pode criar ADMIN ou MODERADOR
      if (normalizedRole === Roles.ADMIN || normalizedRole === Roles.MODERADOR) {
        throw this.createServiceError(
          'MODERADOR não pode criar usuários com role ADMIN ou MODERADOR',
          403,
          'FORBIDDEN_ROLE',
        );
      }
    }

    if (userRole === Roles.PEDAGOGICO) {
      // PEDAGOGICO só pode criar INSTRUTOR ou ALUNO_CANDIDATO
      // Não pode criar: ADMIN, MODERADOR, PEDAGOGICO, EMPRESA
      const allowedRoles: Roles[] = [Roles.ALUNO_CANDIDATO, Roles.INSTRUTOR];
      if (!allowedRoles.includes(normalizedRole as Roles)) {
        throw this.createServiceError(
          'PEDAGOGICO só pode criar usuários com role ALUNO_CANDIDATO ou INSTRUTOR',
          403,
          'FORBIDDEN_ROLE',
        );
      }
    }

    // ADMIN pode criar qualquer role (sem restrições)

    const helperLogger = log.child({ scope: 'createUserHelpers' });

    const processedData = await processUserTypeSpecificData(dados, { logger: helperLogger });
    if (!processedData.success) {
      log.warn({ error: processedData.error }, 'Validação específica falhou');
      throw this.createServiceError(
        processedData.error ?? 'Dados inválidos para criação de usuário',
        400,
        'VALIDATION_ERROR',
      );
    }

    const duplicateCheck = await checkForDuplicates(
      {
        email: dados.email,
        authId,
        cpf: processedData.cpfLimpo,
        cnpj: processedData.cnpjLimpo,
      },
      { logger: helperLogger },
    );

    if (duplicateCheck.found) {
      log.warn({ reason: duplicateCheck.reason }, 'Usuário duplicado identificado');
      throw this.createServiceError(
        duplicateCheck.reason ?? 'Usuário já cadastrado',
        409,
        'USER_ALREADY_EXISTS',
      );
    }

    const senhaHash = await bcrypt.hash(dados.senha, 12);

    const socialLinksInput = extractAdminSocialLinks(dados as unknown as Record<string, unknown>);

    const userData = buildUserDataForDatabase({
      nomeCompleto: dados.nomeCompleto,
      email: dados.email,
      senha: senhaHash,
      telefone: dados.telefone,
      tipoUsuario: dados.tipoUsuario,
      role: normalizedRole,
      aceitarTermos,
      authId,
      cpfLimpo: processedData.cpfLimpo,
      cnpjLimpo: processedData.cnpjLimpo,
      dataNascimento: processedData.dataNascimento,
      generoValidado: processedData.generoValidado,
      socialLinks: socialLinksInput,
      status: dados.status ?? Status.ATIVO,
    });

    const usuario = await createUserWithTransaction(userData, {
      logger: helperLogger,
      markEmailVerified: true,
    });

    const enderecoPayload = sanitizeAdminEnderecoInput(dados.endereco);
    if (enderecoPayload) {
      await prisma.usuariosEnderecos.create({
        data: {
          usuarioId: usuario.id,
          ...enderecoPayload,
          criadoEm: new Date(),
        },
      });
    }

    if (options?.adminId) {
      const usuarioHistorico = await prisma.usuarios.findUnique({
        where: { id: usuario.id },
        select: userHistoryTargetSelect,
      });

      if (usuarioHistorico) {
        await recordUserAuditEvent({
          client: prisma,
          actorId: options.adminId,
          actorRole: options.userRole,
          targetUserId: usuario.id,
          action: 'USUARIO_CRIADO',
          descricao: 'Conta criada pelo painel administrativo.',
          dadosNovos: buildUserProfileSnapshot({
            ...usuarioHistorico,
            emailVerificado: usuarioHistorico.UsuariosVerificacaoEmail?.emailVerificado ?? true,
            emailVerificadoEm:
              usuarioHistorico.UsuariosVerificacaoEmail?.emailVerificadoEm ?? new Date(),
          }),
          meta: {
            origem: 'PAINEL_ADMIN',
            criadoVia: 'ADMIN',
            bypassValidacaoEmail: true,
          },
        });
      }
    }

    await invalidateUserCache(usuario);

    try {
      await invalidateCacheByPrefix('dashboard:');
    } catch (error) {
      log.warn({ err: error }, 'Falha ao limpar cache de dashboard');
    }

    log.info({ userId: usuario.id }, 'Usuário criado com sucesso via admin');

    return {
      success: true,
      message: 'Usuário criado com sucesso',
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
        role: usuario.role,
        status: usuario.status,
        criadoEm: usuario.criadoEm,
        codUsuario: usuario.codUsuario,
        emailVerificado: true,
        emailVerificadoEm: new Date(),
        socialLinks: mapSocialLinks(usuario.redesSociais ?? null),
      },
      meta: {
        correlationId: options?.correlationId,
        createdBy: options?.adminId,
        UsuariosVerificacaoEmailBypassed: true,
      },
    };
  }

  /**
   * Atualiza informações completas de um usuário (ADMIN/MODERADOR/PEDAGOGICO)
   * PEDAGOGICO só pode editar usuários com role ALUNO_CANDIDATO ou INSTRUTOR
   */
  async atualizarUsuario(
    userId: string,
    dados: {
      nomeCompleto?: string;
      email?: string;
      telefone?: string | null;
      genero?: string | null;
      dataNasc?: Date | string | null;
      descricao?: string | null;
      avatarUrl?: string | null;
      endereco?: {
        logradouro?: string | null;
        numero?: string | null;
        bairro?: string | null;
        cidade?: string | null;
        estado?: string | null;
        cep?: string | null;
      } | null;
      redesSociais?: {
        linkedin?: string | null;
        instagram?: string | null;
        facebook?: string | null;
        youtube?: string | null;
        twitter?: string | null;
        tiktok?: string | null;
      } | null;
      senha?: string;
      confirmarSenha?: string;
      role?: string;
    },
    options?: {
      userRole?: string;
      actorId?: string;
      actorRole?: string;
      ip?: string | null;
      userAgent?: string | null;
    },
  ) {
    // Validar senha se fornecida
    if (dados.senha !== undefined || dados.confirmarSenha !== undefined) {
      if (dados.senha === undefined || dados.confirmarSenha === undefined) {
        throw Object.assign(new Error('Informe senha e confirmarSenha para redefinir a senha'), {
          code: 'PASSWORD_CONFIRMATION_REQUIRED',
        });
      }

      if (dados.senha !== dados.confirmarSenha) {
        throw Object.assign(new Error('Senha e confirmarSenha devem ser iguais'), {
          code: 'PASSWORD_MISMATCH',
        });
      }

      if (dados.senha.length < 8) {
        throw Object.assign(new Error('Senha deve ter pelo menos 8 caracteres'), {
          code: 'PASSWORD_TOO_SHORT',
        });
      }
    }

    // Validar email se fornecido
    if (dados.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dados.email)) {
        throw Object.assign(new Error('Informe um e-mail válido'), {
          code: 'INVALID_EMAIL',
        });
      }
    }

    // Sanitizar redes sociais
    const redesSociaisSanitizado = sanitizeSocialLinks(dados.redesSociais);
    const redesSociaisUpdate = buildSocialLinksUpdateData(redesSociaisSanitizado);
    const snapshotAntesUsuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: userHistoryTargetSelect,
    });

    if (!snapshotAntesUsuario) {
      throw Object.assign(new Error('Usuário não encontrado'), {
        code: 'USER_NOT_FOUND',
      });
    }

    const usuarioAtualizado = await prisma.$transaction(async (tx) => {
      // Verificar se usuário existe
      const usuarioExistente = await tx.usuarios.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          UsuariosInformation: true,
          UsuariosRedesSociais: true,
        },
      });

      if (!usuarioExistente) {
        throw Object.assign(new Error('Usuário não encontrado'), {
          code: 'USER_NOT_FOUND',
        });
      }

      // Validação para PEDAGOGICO: só pode editar usuários com role ALUNO_CANDIDATO ou INSTRUTOR
      if (options?.userRole === Roles.PEDAGOGICO) {
        this.assertPedagogicoCanManageUser(options.userRole, usuarioExistente.role, 'editar');
        // PEDAGOGICO não pode alterar a role do usuário
        if (dados.role !== undefined && dados.role !== usuarioExistente.role) {
          throw Object.assign(new Error('PEDAGOGICO não pode alterar a role de um usuário'), {
            code: 'FORBIDDEN_ROLE_CHANGE',
            statusCode: 403,
          });
        }

        // Se tentar definir role diferente de ALUNO_CANDIDATO ou INSTRUTOR, rejeitar
        if (dados.role && dados.role !== Roles.ALUNO_CANDIDATO && dados.role !== Roles.INSTRUTOR) {
          throw Object.assign(
            new Error('PEDAGOGICO só pode definir role como ALUNO_CANDIDATO ou INSTRUTOR'),
            {
              code: 'FORBIDDEN_ROLE',
              statusCode: 403,
            },
          );
        }
      }

      // Verificar se email já existe
      if (dados.email !== undefined) {
        const emailJaExiste = await tx.usuarios.findFirst({
          where: {
            email: dados.email.trim().toLowerCase(),
            id: { not: userId },
          },
        });

        if (emailJaExiste) {
          throw Object.assign(new Error('Este e-mail já está em uso por outro usuário'), {
            code: 'EMAIL_ALREADY_EXISTS',
          });
        }
      }

      // Preparar dados de atualização
      const dadosAtualizacao: any = {};
      if (dados.nomeCompleto !== undefined) {
        dadosAtualizacao.nomeCompleto = dados.nomeCompleto.trim();
      }
      if (dados.email !== undefined) {
        dadosAtualizacao.email = dados.email.trim().toLowerCase();
      }
      if (dados.senha !== undefined) {
        dadosAtualizacao.senha = await bcrypt.hash(dados.senha, 12);
      }
      if (Object.keys(dadosAtualizacao).length > 0) {
        dadosAtualizacao.atualizadoEm = new Date();
      }

      // Atualizar dados básicos do usuário
      if (Object.keys(dadosAtualizacao).length > 0) {
        await tx.usuarios.update({
          where: { id: userId },
          data: dadosAtualizacao,
        });
      }

      // Preparar dados de informações
      const dadosInformacoes: any = {};
      if (dados.telefone !== undefined) dadosInformacoes.telefone = dados.telefone?.trim() || null;
      if (dados.genero !== undefined) dadosInformacoes.genero = dados.genero || null;
      if (dados.dataNasc !== undefined)
        dadosInformacoes.dataNasc = dados.dataNasc ? new Date(dados.dataNasc) : null;
      if (dados.descricao !== undefined)
        dadosInformacoes.descricao = dados.descricao?.trim() || null;
      if (dados.avatarUrl !== undefined)
        dadosInformacoes.avatarUrl = dados.avatarUrl?.trim() || null;

      // Atualizar ou criar informações
      if (Object.keys(dadosInformacoes).length > 0) {
        if (usuarioExistente.UsuariosInformation) {
          await tx.usuariosInformation.update({
            where: { usuarioId: userId },
            data: dadosInformacoes,
          });
        } else {
          await tx.usuariosInformation.create({
            data: {
              usuarioId: userId,
              ...dadosInformacoes,
            },
          });
        }
      }

      // Atualizar ou criar redes sociais
      if (redesSociaisUpdate) {
        if (usuarioExistente.UsuariosRedesSociais) {
          await tx.usuariosRedesSociais.update({
            where: { usuarioId: userId },
            data: {
              ...redesSociaisUpdate,
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.usuariosRedesSociais.create({
            data: {
              usuarioId: userId,
              ...redesSociaisUpdate,
              updatedAt: new Date(),
            },
          });
        }
      }

      const enderecoAtualizado = sanitizeAdminEnderecoInput(dados.endereco);
      if (enderecoAtualizado) {
        const enderecoExistente = await tx.usuariosEnderecos.findFirst({
          where: { usuarioId: userId },
          orderBy: { criadoEm: 'desc' },
        });

        if (enderecoExistente) {
          await tx.usuariosEnderecos.update({
            where: { id: enderecoExistente.id },
            data: enderecoAtualizado,
          });
        } else {
          await tx.usuariosEnderecos.create({
            data: {
              usuarioId: userId,
              ...enderecoAtualizado,
              criadoEm: new Date(),
            },
          });
        }
      }

      // Buscar dados completos atualizados
      const usuarioCompleto = await tx.usuarios.findUnique({
        where: { id: userId },
        select: {
          id: true,
          codUsuario: true,
          nomeCompleto: true,
          email: true,
          cpf: true,
          cnpj: true,
          role: true,
          status: true,
          tipoUsuario: true,
          criadoEm: true,
          atualizadoEm: true,
          ultimoLogin: true,
          UsuariosInformation: {
            select: {
              telefone: true,
              genero: true,
              dataNasc: true,
              descricao: true,
              avatarUrl: true,
            },
          },
          UsuariosRedesSociais: {
            select: {
              linkedin: true,
              instagram: true,
              facebook: true,
              youtube: true,
              twitter: true,
              tiktok: true,
            },
          },
          UsuariosEnderecos: {
            select: {
              id: true,
              logradouro: true,
              numero: true,
              bairro: true,
              cidade: true,
              estado: true,
              cep: true,
              criadoEm: true,
            },
            orderBy: {
              criadoEm: 'desc',
            },
          },
          UsuariosVerificacaoEmail: {
            select: UsuariosVerificacaoEmailSelect,
          },
        },
      });

      return usuarioCompleto!;
    });

    // Invalidar cache do usuário
    await invalidateUserCache(usuarioAtualizado);

    // ✅ OTIMIZAÇÃO: Invalidar cache de listagens após atualizar usuário
    await this.invalidateListCache();

    const usuarioComInformacoes = mergeUsuarioInformacoes(usuarioAtualizado);
    const usuarioNormalizado = attachEnderecoResumo(usuarioComInformacoes);

    this.log.info(
      {
        userId,
        camposAtualizados: Object.keys(dados).filter(
          (k) => dados[k as keyof typeof dados] !== undefined,
        ),
      },
      '✅ Informações do usuário atualizadas com sucesso',
    );

    if (options?.actorId) {
      const snapshotDepois = buildUserProfileSnapshot({
        ...usuarioAtualizado,
        emailVerificado: usuarioAtualizado.UsuariosVerificacaoEmail?.emailVerificado ?? null,
        emailVerificadoEm: usuarioAtualizado.UsuariosVerificacaoEmail?.emailVerificadoEm ?? null,
      });
      const snapshotAntes = buildUserProfileSnapshot({
        ...snapshotAntesUsuario,
        emailVerificado: snapshotAntesUsuario.UsuariosVerificacaoEmail?.emailVerificado ?? null,
        emailVerificadoEm: snapshotAntesUsuario.UsuariosVerificacaoEmail?.emailVerificadoEm ?? null,
      });

      const payloads: {
        action: string;
        descricao: string;
        before: Record<string, unknown> | null;
        after: Record<string, unknown> | null;
        meta?: Record<string, unknown>;
      }[] = [];

      if (dados.senha !== undefined) {
        payloads.push({
          action: 'USUARIO_SENHA_RESETADA',
          descricao: 'Senha redefinida manualmente pelo painel administrativo.',
          before: null,
          after: null,
          meta: {
            modo: 'MANUAL',
            origem: 'PAINEL_ADMIN',
          },
        });
      }

      const perfilDiff = diffSnapshot(
        {
          nomeCompleto: snapshotAntes.nomeCompleto,
          email: snapshotAntes.email,
          descricao: snapshotAntes.descricao,
          genero: snapshotAntes.genero,
          dataNasc: snapshotAntes.dataNasc,
        },
        {
          nomeCompleto: snapshotDepois.nomeCompleto,
          email: snapshotDepois.email,
          descricao: snapshotDepois.descricao,
          genero: snapshotDepois.genero,
          dataNasc: snapshotDepois.dataNasc,
        },
      );

      if (perfilDiff.before || perfilDiff.after) {
        payloads.push({
          action: 'USUARIO_ATUALIZADO',
          descricao: 'Perfil atualizado pelo painel administrativo.',
          before: perfilDiff.before,
          after: perfilDiff.after,
        });
      }

      const telefoneDiff = diffSnapshot(
        { telefone: snapshotAntes.telefone },
        { telefone: snapshotDepois.telefone },
      );
      if (telefoneDiff.before || telefoneDiff.after) {
        payloads.push({
          action: 'USUARIO_TELEFONE_ATUALIZADO',
          descricao: 'Telefone atualizado pelo painel administrativo.',
          before: telefoneDiff.before,
          after: telefoneDiff.after,
        });
      }

      const avatarDiff = diffSnapshot(
        { avatarUrl: snapshotAntes.avatarUrl },
        { avatarUrl: snapshotDepois.avatarUrl },
      );
      if (avatarDiff.before || avatarDiff.after) {
        payloads.push({
          action: 'USUARIO_AVATAR_ATUALIZADO',
          descricao: 'Avatar atualizado pelo painel administrativo.',
          before: avatarDiff.before,
          after: avatarDiff.after,
        });
      }

      const enderecoDiff = diffSnapshot(
        { endereco: snapshotAntes.endereco },
        { endereco: snapshotDepois.endereco },
      );
      if (enderecoDiff.before || enderecoDiff.after) {
        payloads.push({
          action: 'USUARIO_ENDERECO_ATUALIZADO',
          descricao: 'Endereço atualizado pelo painel administrativo.',
          before: enderecoDiff.before,
          after: enderecoDiff.after,
        });
      }

      const redesDiff = diffSnapshot(
        { redesSociais: snapshotAntes.redesSociais },
        { redesSociais: snapshotDepois.redesSociais },
      );
      if (redesDiff.before || redesDiff.after) {
        payloads.push({
          action: 'USUARIO_SOCIAL_LINK_ATUALIZADO',
          descricao: 'Redes sociais atualizadas pelo painel administrativo.',
          before: redesDiff.before,
          after: redesDiff.after,
        });
      }

      for (const payload of payloads) {
        await recordUserAuditEvent({
          client: prisma,
          actorId: options.actorId,
          actorRole: options.actorRole,
          targetUserId: userId,
          action: payload.action,
          descricao: payload.descricao,
          dadosAnteriores: payload.before,
          dadosNovos: payload.after,
          meta: payload.meta ?? {
            origem: 'PAINEL_ADMIN',
          },
          ip: options.ip ?? null,
          userAgent: options.userAgent ?? null,
        });
      }
    }

    return usuarioNormalizado;
  }

  async liberarValidacaoEmail(
    userId: string,
    options?: {
      actorId?: string;
      actorRole?: string;
      motivo?: string;
      ip?: string | null;
      userAgent?: string | null;
    },
  ) {
    if (!userId || userId.trim() === '') {
      throw Object.assign(new Error('ID do usuário é obrigatório'), {
        code: 'INVALID_ID',
        statusCode: 400,
      });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuarios.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          role: true,
          status: true,
          UsuariosVerificacaoEmail: {
            select: UsuariosVerificacaoEmailSelect,
          },
        },
      });

      if (!usuario) {
        throw Object.assign(new Error('Usuário não encontrado'), {
          code: 'USER_NOT_FOUND',
          statusCode: 404,
        });
      }

      this.assertPedagogicoCanManageUser(
        options?.actorRole,
        usuario.role,
        'liberar validacao de email',
      );

      const before = normalizeEmailVerification(usuario.UsuariosVerificacaoEmail);

      const verification = await tx.usuariosVerificacaoEmail.upsert({
        where: { usuarioId: usuario.id },
        update: {
          emailVerificado: true,
          emailVerificadoEm: before.emailVerificadoEm ?? now,
          emailVerificationToken: null,
          emailVerificationTokenExp: null,
          emailVerificationAttempts: 0,
          ultimaTentativaVerificacao: null,
        },
        create: {
          usuarioId: usuario.id,
          emailVerificado: true,
          emailVerificadoEm: now,
          emailVerificationToken: null,
          emailVerificationTokenExp: null,
          emailVerificationAttempts: 0,
          ultimaTentativaVerificacao: null,
        },
      });

      const after = normalizeEmailVerification(verification);

      if (options?.actorId) {
        await recordUserAuditEvent({
          client: tx,
          actorId: options.actorId,
          actorRole: options.actorRole,
          targetUserId: usuario.id,
          action: 'USUARIO_EMAIL_LIBERADO_MANUALMENTE',
          descricao: `Validação de email liberada manualmente para ${usuario.email}.`,
          dadosAnteriores: serializeEmailVerificationAudit(before),
          dadosNovos: serializeEmailVerificationAudit(after),
          meta: {
            motivo: options?.motivo ?? null,
            targetStatus: usuario.status,
            targetRole: usuario.role,
            origem: 'PAINEL_ADMIN',
          },
          ip: options?.ip ?? null,
          userAgent: options?.userAgent ?? null,
        });
      }

      return {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        role: usuario.role,
        status: usuario.status,
        emailVerificado: after.emailVerificado,
        emailVerificadoEm: after.emailVerificadoEm,
        alreadyVerified: before.emailVerificado,
        statusPermiteLogin: usuario.status === Status.ATIVO,
      };
    });

    await invalidateUserCache(userId);
    await this.invalidateListCache();

    this.log.info(
      {
        actorId: options?.actorId,
        actorRole: options?.actorRole,
        userId,
        alreadyVerified: result.alreadyVerified,
      },
      'Validacao de email liberada manualmente via painel',
    );

    return result;
  }

  async liberarAcessoUsuario(
    userId: string,
    options?: {
      actorId?: string;
      actorRole?: string;
      motivo?: string;
      ip?: string | null;
      userAgent?: string | null;
    },
  ) {
    if (!userId || userId.trim() === '') {
      throw Object.assign(new Error('ID do usuário é obrigatório'), {
        code: 'INVALID_ID',
        statusCode: 400,
      });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuarios.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          role: true,
          status: true,
          UsuariosVerificacaoEmail: {
            select: UsuariosVerificacaoEmailSelect,
          },
        },
      });

      if (!usuario) {
        throw Object.assign(new Error('Usuário não encontrado'), {
          code: 'USER_NOT_FOUND',
          statusCode: 404,
        });
      }

      this.assertPedagogicoCanManageUser(options?.actorRole, usuario.role, 'liberar acesso');

      if (
        usuario.status === Status.BLOQUEADO ||
        usuario.status === Status.INATIVO ||
        usuario.status === Status.SUSPENSO
      ) {
        throw this.createServiceError(
          'Não é possível liberar acesso para usuários bloqueados, inativos ou suspensos.',
          409,
          'USER_ACCESS_RELEASE_BLOCKED_BY_STATUS',
          {
            statusAtual: usuario.status,
          },
        );
      }

      const beforeVerification = normalizeEmailVerification(usuario.UsuariosVerificacaoEmail);
      const beforeSnapshot = {
        status: usuario.status,
        emailVerificado: beforeVerification.emailVerificado,
        emailVerificadoEm: beforeVerification.emailVerificadoEm?.toISOString() ?? null,
      };

      const verification = await tx.usuariosVerificacaoEmail.upsert({
        where: { usuarioId: usuario.id },
        update: {
          emailVerificado: true,
          emailVerificadoEm: beforeVerification.emailVerificadoEm ?? now,
          emailVerificationToken: null,
          emailVerificationTokenExp: null,
          emailVerificationAttempts: 0,
          ultimaTentativaVerificacao: null,
        },
        create: {
          usuarioId: usuario.id,
          emailVerificado: true,
          emailVerificadoEm: now,
          emailVerificationToken: null,
          emailVerificationTokenExp: null,
          emailVerificationAttempts: 0,
          ultimaTentativaVerificacao: null,
        },
      });

      const afterVerification = normalizeEmailVerification(verification);
      const statusAnterior = usuario.status;
      let statusFinal: Status = usuario.status;

      if (usuario.status === Status.PENDENTE) {
        const usuarioAtualizado = await tx.usuarios.update({
          where: { id: usuario.id },
          data: {
            status: Status.ATIVO,
            atualizadoEm: now,
          },
          select: {
            status: true,
          },
        });

        statusFinal = usuarioAtualizado.status;
      }

      const afterSnapshot = {
        status: statusFinal,
        emailVerificado: afterVerification.emailVerificado,
        emailVerificadoEm: afterVerification.emailVerificadoEm?.toISOString() ?? null,
      };

      const houveMudanca =
        beforeSnapshot.status !== afterSnapshot.status ||
        beforeSnapshot.emailVerificado !== afterSnapshot.emailVerificado ||
        beforeSnapshot.emailVerificadoEm !== afterSnapshot.emailVerificadoEm;

      if (options?.actorId && houveMudanca) {
        await recordUserAuditEvent({
          client: tx,
          actorId: options.actorId,
          actorRole: options.actorRole,
          targetUserId: usuario.id,
          action: 'USUARIO_ACESSO_LIBERADO',
          descricao: `Acesso liberado manualmente para ${usuario.email}.`,
          dadosAnteriores: beforeSnapshot,
          dadosNovos: afterSnapshot,
          meta: {
            motivo: options?.motivo ?? null,
            targetRole: usuario.role,
            origem: 'PAINEL_ADMIN',
          },
          ip: options?.ip ?? null,
          userAgent: options?.userAgent ?? null,
        });
      }

      return {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        role: usuario.role,
        statusAnterior,
        status: statusFinal,
        emailVerificado: afterVerification.emailVerificado,
        emailVerificadoEm: afterVerification.emailVerificadoEm,
        alreadyVerified: beforeVerification.emailVerificado,
        statusPermiteLogin: statusFinal === Status.ATIVO,
        acessoLiberado: statusFinal === Status.ATIVO && afterVerification.emailVerificado,
      };
    });

    await invalidateUserCache(userId);
    await this.invalidateListCache();

    this.log.info(
      {
        actorId: options?.actorId,
        actorRole: options?.actorRole,
        userId,
        statusAnterior: result.statusAnterior,
        statusAtual: result.status,
        alreadyVerified: result.alreadyVerified,
      },
      'Acesso do usuário liberado manualmente via painel',
    );

    return result;
  }

  async buscarCurriculoPorId(curriculoId: string) {
    try {
      const curriculo = await prisma.usuariosCurriculos.findUnique({
        where: { id: curriculoId },
        select: {
          id: true,
          titulo: true,
          resumo: true,
          objetivo: true,
          principal: true,
          areasInteresse: true,
          preferencias: true,
          habilidades: true,
          idiomas: true,
          experiencias: true,
          formacao: true,
          cursosCertificacoes: true,
          premiosPublicacoes: true,
          acessibilidade: true,
          consentimentos: true,
          criadoEm: true,
          atualizadoEm: true,
          ultimaAtualizacao: true,
        },
      });

      return curriculo;
    } catch (error) {
      this.log.error({ error, curriculoId }, 'Erro ao buscar currículo por ID');
      throw error;
    }
  }
}
