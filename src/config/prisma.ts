import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

// Criar logger ANTES de qualquer função que o use
const prismaLogger = logger.child({ module: 'PrismaClient' });

// ✅ PRIORIDADE: Direct Connection para apps Node persistentes
// Direct Connection evita problemas com prepared statements e transações longas
// Pooler (Transaction Pooler) é recomendado apenas para serverless/ephemeral
// Ordem de prioridade: DIRECT_URL > DATABASE_URL > DATABASE_POOL_URL
const datasourceUrl = 
  process.env.DIRECT_URL || 
  process.env.DATABASE_URL || 
  process.env.DATABASE_POOL_URL || 
  '';

console.log('🔧 [PRISMA CONFIG] Iniciando configuração...');
console.log('🔧 [PRISMA CONFIG] datasourceUrl length:', datasourceUrl?.length || 0);

// Configurações otimizadas de pool de conexões para Supabase
// Documentação: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
const DEFAULT_CONNECTION_LIMIT = process.env.DATABASE_CONNECTION_LIMIT || '10';
const DEFAULT_POOL_TIMEOUT = process.env.DATABASE_POOL_TIMEOUT || '30';
const DEFAULT_CONNECT_TIMEOUT = process.env.DATABASE_CONNECT_TIMEOUT || '10';

function buildConnectionUrl(baseUrl: string): string {
  console.log('🔧 [BUILD URL] Função chamada');

  if (!baseUrl) return baseUrl;

  const url = new URL(baseUrl);
  const isSupabasePooler = url.hostname.includes('pooler.supabase.com');

  // 🎯 SIMPLIFICAÇÃO: Remover TODOS os parâmetros de pool e deixar o Prisma gerenciar
  // O problema pode estar nos parâmetros conflitantes com o pgBouncer do Supabase
  const paramsToRemove = [
    'pool_size',
    'pool_timeout',
    'connect_timeout',
    'connection_limit',
    'pool',
    'application_name',
    'pgbouncer',
  ];
  paramsToRemove.forEach((param) => url.searchParams.delete(param));

  if (isSupabasePooler) {
    const connectionLimit = process.env.DATABASE_POOLER_CONNECTION_LIMIT || '1';
    const poolTimeout = process.env.DATABASE_POOLER_TIMEOUT || DEFAULT_POOL_TIMEOUT;
    const connectTimeout = process.env.DATABASE_POOLER_CONNECT_TIMEOUT || DEFAULT_CONNECT_TIMEOUT;

    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connection_limit', connectionLimit);
    url.searchParams.set('pool_timeout', poolTimeout);
    url.searchParams.set('connect_timeout', connectTimeout);

    prismaLogger.info(
      {
        mode: 'Supabase Pooler',
        connectionLimit,
        poolTimeout: `${poolTimeout}s`,
        connectTimeout: `${connectTimeout}s`,
      },
      '✅ Configuração aplicando recomendações do Supabase Pooler',
    );
  } else {
    // Conexão direta
    url.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
    url.searchParams.set('pool_timeout', DEFAULT_POOL_TIMEOUT);
    url.searchParams.set('connect_timeout', DEFAULT_CONNECT_TIMEOUT);

    prismaLogger.info(
      {
        mode: 'Direct Connection',
        connectionLimit: DEFAULT_CONNECTION_LIMIT,
        poolTimeout: `${DEFAULT_POOL_TIMEOUT}s`,
        connectTimeout: `${DEFAULT_CONNECT_TIMEOUT}s`,
      },
      '✅ Configuração para conexão direta',
    );
  }

  const finalUrl = url.toString();
  console.log('🔧 [BUILD URL] URL final (sem senha):', finalUrl.replace(/:[^:]*@/, ':***@'));
  return finalUrl;
}

const optimizedDatasourceUrl = buildConnectionUrl(datasourceUrl);

// ✅ SINGLETON PATTERN: Criar instância única do PrismaClient compartilhada
// Isso evita overhead de criação e esgota conexões do banco
// Padrão recomendado pelo Supabase para apps Node.js persistentes
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 🔄 Função para conectar com retry inteligente
async function connectWithRetry(client: PrismaClient, maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.$connect();

      // Extrair informações da conexão
      const url = new URL(optimizedDatasourceUrl);
      const connInfo = {
        poolSize: url.searchParams.get('connection_limit') || url.searchParams.get('pool_size'),
        poolTimeout: url.searchParams.get('pool_timeout'),
        poolerDetected: optimizedDatasourceUrl.includes('pooler.supabase.com'),
        pgbouncer: url.searchParams.get('pgbouncer') === 'true',
        attempt,
      };

      prismaLogger.info(connInfo, '✅ Prisma conectado com sucesso');
      return;
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s

      prismaLogger.warn(
        {
          attempt,
          maxRetries,
          nextRetryIn: isLastAttempt ? null : `${delay}ms`,
          error: error?.message,
          code: error?.code,
        },
        `⚠️ Falha ao conectar (tentativa ${attempt}/${maxRetries})`,
      );

      if (isLastAttempt) {
        prismaLogger.error({ err: error }, '❌ Todas as tentativas de conexão falharam');
        // NÃO lançar erro - permite que a aplicação inicie e tente conectar nas queries
        return;
      }

      // Aguardar antes da próxima tentativa
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Função helper para retry de queries com timeout e fail-fast
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
  timeoutMs?: number, // Opcional: timeout por tentativa (padrão: 5s para produção, sem timeout para testes)
): Promise<T> {
  // Timeout padrão: 5s para produção, sem timeout para testes (para não quebrar testes lentos)
  const finalTimeout = timeoutMs ?? (process.env.NODE_ENV === 'test' ? undefined : 5000);
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Implementar timeout para fail-fast (apenas se configurado)
      if (finalTimeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timeout after ${finalTimeout}ms`));
          }, finalTimeout);
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        return result;
      } else {
        // Sem timeout (útil para testes)
        return await operation();
      }
    } catch (error: any) {
      lastError = error;

      // Se for timeout ou erro de conexão, tenta reconectar
      const isConnectionError =
        error?.code === 'P1001' || // Can't reach database
        error?.code === 'P2024' || // Timed out
        error?.message?.includes('timeout') ||
        error?.message?.includes('database server') ||
        error?.message?.includes('connection') ||
        error?.message?.includes("can't reach") ||
        error?.message?.includes('tenant or user not found');

      if (isConnectionError) {
        prismaLogger.warn(
          {
            attempt,
            maxRetries,
            error: error?.message?.substring(0, 200), // Limitar tamanho do log
            code: error?.code,
            timeout: finalTimeout,
          },
          `⚠️ Erro de conexão/timeout, tentando reconectar (${attempt}/${maxRetries})`,
        );

        if (attempt < maxRetries) {
          // Exponential backoff com delay máximo de 5s
          const delay = Math.min(delayMs * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Tenta reconectar apenas na primeira tentativa
          if (attempt === 1) {
            try {
              await Promise.race([
                prisma.$connect(),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Connect timeout')), 3000),
                ),
              ]);
              prismaLogger.info('✅ Reconectado com sucesso');
            } catch (connectError) {
              prismaLogger.warn('⚠️ Erro ao reconectar, continuando tentativa...');
            }
          }

          continue;
        }
      }

      // Se não for erro de conexão ou última tentativa, lança o erro
      throw error;
    }
  }

  throw lastError;
}

function createPrismaClient() {
  // ✅ Usar a URL já otimizada (já tem connection_limit configurado)
  const finalDatasourceUrl = optimizedDatasourceUrl;

  const client = new PrismaClient({
    datasourceUrl: finalDatasourceUrl,
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
      ...(process.env.NODE_ENV === 'development'
        ? [{ emit: 'event' as const, level: 'query' as const }]
        : []),
    ],
  });

  // 🎯 LAZY CONNECTION: Não conectar imediatamente em produção
  // Isso evita erro na inicialização e permite retry automático nas queries
  if (process.env.NODE_ENV !== 'test' && process.env.PRISMA_EAGER_CONNECT === 'true') {
    // Apenas conectar imediatamente se explicitamente solicitado
    void connectWithRetry(client);
  } else {
    prismaLogger.info('🔄 Lazy connection habilitado (conectará na primeira query)');
  }

  client.$on('error', (e) => {
    // Se for erro de conexão, logar como warning ao invés de error
    const errorMessage = e.message?.toLowerCase() || '';
    const isConnectionError =
      errorMessage.includes('tenant or user not found') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('can\'t reach database') ||
      errorMessage.includes('fatal') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused');

    if (isConnectionError) {
      prismaLogger.warn({ err: e }, '⚠️ Prisma: Erro de conexão com banco de dados');
    } else {
      prismaLogger.error({ err: e }, '🔥 Prisma error');
    }
  });

  client.$on('warn', (e) => {
    prismaLogger.warn({ warn: e }, '⚠️ Prisma warning');
  });

  // Log de queries lentas em desenvolvimento (> 1 segundo)
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e: any) => {
      if (e.duration > 1000) {
        prismaLogger.warn(
          {
            query: e.query,
            duration: `${e.duration}ms`,
            target: e.target,
          },
          '🐌 Query lenta detectada',
        );
      }
    });
  }

  // Nota: evite middleware $use para compatibilidade com Data Proxy/Accelerate.

  return client;
}

// ✅ SINGLETON: Usar instância global em todos os ambientes (incluindo produção)
// Isso garante que o pool de conexões seja compartilhado entre todas as requisições
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

// Exportar função de retry para uso em controllers
export { retryOperation };

// Nota: O graceful shutdown do Prisma é gerenciado em src/index.ts
