/**
 * Query Optimizer - Otimizações avançadas de queries Prisma
 *
 * Este módulo fornece utilitários para otimizar queries do Prisma,
 * incluindo cache, seleção condicional de campos e profiler de queries.
 *
 * @author Sistema Advance+
 * @version 1.0.0
 */

import { generateCacheKey as generateCacheKeyUtil, getCachedOrFetch } from '@/utils/cache';
import { logger } from '@/utils/logger';
import { Prisma } from '@prisma/client';

const queryLogger = logger.child({ module: 'QueryOptimizer' });

/**
 * Opções para otimização de queries
 */
export interface QueryOptimizerOptions {
  /** Habilitar cache (padrão: true) */
  enableCache?: boolean;
  /** TTL do cache em segundos (padrão: 60s) */
  cacheTTL?: number;
  /** Chave do cache (opcional, será gerada automaticamente se não fornecido) */
  cacheKey?: string;
  /** Habilitar profiler (padrão: false) */
  enableProfiler?: boolean;
  /** Campos a incluir na query (opcional) */
  includeFields?: string[];
  /** Campos a excluir da query (opcional) */
  excludeFields?: string[];
}

/**
 * Gera chave de cache baseada nos parâmetros da query
 * Re-exporta a função do utils/cache para compatibilidade
 */
export const generateCacheKey = generateCacheKeyUtil;

/**
 * Wrapper para queries com cache e profiler
 */
export async function optimizedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: QueryOptimizerOptions = {},
): Promise<T> {
  const { enableCache = true, cacheTTL = 60, enableProfiler = false } = options;

  const startTime = enableProfiler ? Date.now() : undefined;

  try {
    let result: T;

    if (enableCache) {
      result = await getCachedOrFetch(key, queryFn, cacheTTL);
    } else {
      result = await queryFn();
    }

    if (enableProfiler && startTime) {
      const duration = Date.now() - startTime;
      queryLogger.info(
        {
          key,
          duration: `${duration}ms`,
          cached: enableCache,
        },
        'Query executada',
      );
    }

    return result;
  } catch (error) {
    if (enableProfiler && startTime) {
      const duration = Date.now() - startTime;
      queryLogger.error(
        {
          err: error,
          key,
          duration: `${duration}ms`,
        },
        'Erro ao executar query',
      );
    }
    throw error;
  }
}

/**
 * Seleção otimizada de campos para listagem de usuários
 * Remove campos desnecessários baseado no contexto
 */
export function getOptimizedUserSelect(options?: {
  includeRedesSociais?: boolean;
  includeEnderecoCompleto?: boolean;
  includeInformacoesCompletas?: boolean;
}): Prisma.UsuariosSelect {
  const {
    includeRedesSociais = false,
    includeEnderecoCompleto = false,
    includeInformacoesCompletas = true,
  } = options || {};

  const select: Prisma.UsuariosSelect = {
    id: true,
    email: true,
    nomeCompleto: true,
    cpf: true,
    cnpj: true,
    codUsuario: true,
    role: true,
    status: true,
    tipoUsuario: true,
    criadoEm: true,
    ultimoLogin: true,
  };

  // Informações do usuário (sempre incluir, mas apenas campos essenciais)
  if (includeInformacoesCompletas) {
    select.UsuariosInformation = {
      select: {
        telefone: true,
        genero: true,
        dataNasc: true,
        descricao: true,
        avatarUrl: true,
        // Campos adicionais apenas se necessário
        ...(includeInformacoesCompletas ? { inscricao: true, aceitarTermos: true } : {}),
      },
    };
  }

  // Redes sociais (apenas se necessário)
  if (includeRedesSociais) {
    select.UsuariosRedesSociais = {
      select: {
        linkedin: true,
        instagram: true,
        facebook: true,
        youtube: true,
        twitter: true,
        tiktok: true,
      },
    };
  }

  // Endereço (sempre incluir, mas apenas campos essenciais)
  select.UsuariosEnderecos = {
    select: {
      cidade: true,
      estado: true,
      ...(includeEnderecoCompleto
        ? {
            id: true,
            logradouro: true,
            numero: true,
            bairro: true,
            cep: true,
          }
        : {}),
    },
    take: 1,
    orderBy: {
      criadoEm: 'desc',
    },
  };

  return select;
}

/**
 * Seleção otimizada para instrutores
 */
export function getOptimizedInstrutorSelect(options?: {
  includeRedesSociais?: boolean;
}): Prisma.UsuariosSelect {
  return getOptimizedUserSelect({
    includeRedesSociais: options?.includeRedesSociais ?? true, // Instrutores geralmente precisam de redes sociais
    includeEnderecoCompleto: false,
    includeInformacoesCompletas: true,
  });
}

/**
 * Otimiza filtros de busca (nome, email, CPF)
 * Converte para lowercase para usar índices case-insensitive
 */
export function optimizeSearchFilter(searchTerm: string): Prisma.UsuariosWhereInput {
  const trimmed = searchTerm.trim();
  if (trimmed.length < 3) {
    return {};
  }

  // Para busca case-insensitive, usar modo 'insensitive' do Prisma
  // Isso usa os índices LOWER() que criamos
  return {
    OR: [
      { nomeCompleto: { contains: trimmed, mode: 'insensitive' } },
      { email: { contains: trimmed, mode: 'insensitive' } },
      { cpf: { contains: trimmed.replace(/\D/g, '') } },
      { codUsuario: { contains: trimmed, mode: 'insensitive' } },
    ],
  };
}

/**
 * Otimiza filtro de endereço (cidade/estado)
 * Usa índices criados para melhor performance
 */
export function optimizeAddressFilter(
  cidade?: string,
  estado?: string,
): Prisma.UsuariosWhereInput | undefined {
  if (!cidade && !estado) {
    return undefined;
  }

  // Usar some apenas se necessário (já otimizado com índices)
  return {
    UsuariosEnderecos: {
      some: {
        ...(cidade ? { cidade: { contains: cidade.trim(), mode: 'insensitive' } } : {}),
        ...(estado ? { estado: { contains: estado.trim(), mode: 'insensitive' } } : {}),
      },
    },
  };
}

/**
 * Profiler de queries - registra queries lentas
 */
export class QueryProfiler {
  private static queries = new Map<string, { count: number; totalTime: number; maxTime: number }>();

  static record(key: string, duration: number): void {
    const existing = this.queries.get(key) || { count: 0, totalTime: 0, maxTime: 0 };
    existing.count++;
    existing.totalTime += duration;
    existing.maxTime = Math.max(existing.maxTime, duration);
    this.queries.set(key, existing);

    // Log queries lentas (>1s)
    if (duration > 1000) {
      queryLogger.warn(
        {
          key,
          duration: `${duration}ms`,
          count: existing.count,
          avgTime: `${Math.round(existing.totalTime / existing.count)}ms`,
        },
        '🐌 Query lenta detectada',
      );
    }
  }

  static getStats(): Record<string, { count: number; avgTime: number; maxTime: number }> {
    const stats: Record<string, { count: number; avgTime: number; maxTime: number }> = {};
    for (const [key, data] of this.queries.entries()) {
      stats[key] = {
        count: data.count,
        avgTime: Math.round(data.totalTime / data.count),
        maxTime: data.maxTime,
      };
    }
    return stats;
  }

  static reset(): void {
    this.queries.clear();
  }
}
