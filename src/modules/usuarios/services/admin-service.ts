/**
 * Service administrativo - Lógica de negócio
 * Responsabilidade única: operações administrativas no banco
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { Prisma, Roles, Status, TiposDeUsuarios, CandidatoLogTipo } from '@prisma/client';
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
      // Buscar contagem de aulas e provas da turma
      const [totalAulas, totalProvas, aulasComFrequencia, provasComEnvio] = await Promise.all([
        prisma.cursosTurmasAulas.count({
          where: { turmaId },
        }),
        prisma.cursosTurmasProvas.count({
          where: { turmaId },
        }),
        prisma.cursosFrequenciaAlunos.count({
          where: { inscricaoId, status: 'PRESENTE' },
        }),
        prisma.cursosTurmasProvasEnvios.count({
          where: { inscricaoId },
        }),
      ]);

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
            return await Promise.all([
              prisma.usuarios.findMany({
                where,
                select,
                // ✅ Usar índice composto para melhor performance
                orderBy: { criadoEm: 'desc' },
                skip,
                take: pageSize,
              }),
              // ✅ Count em paralelo - usa índice para contar rapidamente
              prisma.usuarios.count({ where }),
            ]);
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
      // Buscar currículos e inscrições em paralelo
      const [curriculos, inscricoes] = await Promise.all([
        prisma.usuariosCurriculos.findMany({
          where: { usuarioId: { in: alunosIds } },
          select: { id: true, usuarioId: true },
        }),
        prisma.cursosTurmasInscricoes.findMany({
          where: { alunoId: { in: alunosIds } },
          select: { id: true, alunoId: true },
        }),
      ]);

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

    const [candidatos, total] = await prisma.$transaction([
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
    ]);

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
        supabaseId: true,
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

    if (!usuario) {
      return null;
    }

    // Validação para PEDAGOGICO: só pode ver usuários com role ALUNO_CANDIDATO ou INSTRUTOR
    if (options?.userRole === Roles.PEDAGOGICO) {
      if (usuario.role !== Roles.ALUNO_CANDIDATO && usuario.role !== Roles.INSTRUTOR) {
        throw Object.assign(
          new Error('PEDAGOGICO só pode visualizar usuários com role ALUNO_CANDIDATO ou INSTRUTOR'),
          {
            code: 'FORBIDDEN_USER_ROLE',
            statusCode: 403,
          },
        );
      }
    }

    const usuarioComInformacoes = mergeUsuarioInformacoes(usuario);
    const usuarioNormalizado = attachEnderecoResumo(usuarioComInformacoes);

    if (!usuarioNormalizado) {
      return null;
    }

    // Buscar relações adicionais baseadas na role
    let relacoesAdicionais: any = {};

    if (usuario.role === Roles.ALUNO_CANDIDATO) {
      // Para ALUNO_CANDIDATO: incluir currículos, candidaturas e inscrições em cursos
      const [curriculos, candidaturas, inscricoesRaw] = await Promise.all([
        prisma.usuariosCurriculos.findMany({
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
        }),
        prisma.empresasCandidatos.findMany({
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
        }),
        prisma.cursosTurmasInscricoes.findMany({
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
        }),
      ]);

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
        supabaseId: true,
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

  /**
   * Atualiza status do usuário - TIPAGEM CORRETA
   */
  async atualizarStatus(userId: string, status: string, motivo?: string) {
    // Validações
    if (!userId || userId.trim() === '') {
      throw new Error('ID do usuário é obrigatório');
    }

    // Validação usando enum do Prisma
    const statusEnum = status.trim();

    // Buscar dados antes da atualização
    const usuarioAntes = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { status: true, email: true, nomeCompleto: true },
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
        supabaseId: true,
      },
    });

    await invalidateUserCache(usuario);

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
  async atualizarRole(userId: string, role: string, motivo?: string, adminId?: string) {
    // Validações
    if (!userId || !role) {
      throw new Error('ID do usuário e role são obrigatórios');
    }

    const roleEnum = role.trim();

    // Prevenir auto-demoção de ADMIN
    if (adminId === userId && roleEnum !== Roles.ADMIN) {
      throw new Error('Você não pode alterar sua própria role para uma função não-administrativa');
    }

    const usuario = await prisma.usuarios.update({
      where: { id: userId },
      data: { role: roleEnum as Roles },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        atualizadoEm: true,
        supabaseId: true,
      },
    });

    await invalidateUserCache(usuario);

    this.log.info(
      {
        userId,
        novaRole: roleEnum,
        motivo,
      },
      'Role do usuário alterada',
    );

    return {
      message: 'Role do usuário atualizada com sucesso',
      usuario,
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
    const supabaseId = dados.supabaseId?.trim() || randomUUID();
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
        supabaseId,
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
      supabaseId,
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
    options?: { userRole?: string },
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
        if (
          usuarioExistente.role !== Roles.ALUNO_CANDIDATO &&
          usuarioExistente.role !== Roles.INSTRUTOR
        ) {
          throw Object.assign(
            new Error('PEDAGOGICO só pode editar usuários com role ALUNO_CANDIDATO ou INSTRUTOR'),
            {
              code: 'FORBIDDEN_USER_ROLE',
              statusCode: 403,
            },
          );
        }

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

    return usuarioNormalizado;
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
