import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

// Criar logger ANTES de qualquer função que o use
const prismaLogger = logger.child({ module: 'PrismaClient' });

console.log('🔧 [PRISMA CONFIG] Iniciando configuração...');

// ✅ PRIORIDADE: Direct Connection para apps Node persistentes (Render, Railway, etc.)
// Direct Connection evita problemas com prepared statements e transações longas
// Pooler (Transaction Pooler) é recomendado apenas para serverless/ephemeral (Vercel, Lambda)
// Ordem de prioridade: DIRECT_URL > DATABASE_URL > DATABASE_POOL_URL
// ⚠️ IMPORTANTE: Para produção no Render, SEMPRE use DIRECT_URL (não pooler)
const datasourceUrl =
  process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.DATABASE_POOL_URL || '';

console.log('🔧 [PRISMA CONFIG] datasourceUrl length:', datasourceUrl?.length || 0);

// Log para debug (sem expor senha)
if (datasourceUrl) {
  try {
    const url = new URL(datasourceUrl);
    const isPooler = url.hostname.includes('pooler.supabase.com');
    prismaLogger.info(
      {
        mode: isPooler ? 'Pooler' : 'Direct',
        hostname: url.hostname,
        note: isPooler
          ? '⚠️ Pooler detectado - considere usar DIRECT_URL para melhor performance'
          : '✅ Direct connection - ideal para apps persistentes',
      },
      '🔧 Configuração de conexão',
    );
  } catch (error) {
    prismaLogger.warn({ err: error }, '⚠️ Erro ao analisar URL de conexão');
  }
}

// Configurações otimizadas de pool de conexões para Supabase
// Documentação: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
// ⚠️ IMPORTANTE: Connection limit deve ser alto o suficiente para suportar requisições simultâneas
// Para produção no Render, recomenda-se pelo menos 20-50 conexões
const DEFAULT_CONNECTION_LIMIT = process.env.DATABASE_CONNECTION_LIMIT || '20';
const DEFAULT_POOL_TIMEOUT = process.env.DATABASE_POOL_TIMEOUT || '60';
const DEFAULT_CONNECT_TIMEOUT = process.env.DATABASE_CONNECT_TIMEOUT || '15';
const DEFAULT_POOLER_CONNECTION_LIMIT = process.env.DATABASE_POOLER_CONNECTION_LIMIT || '20';

function buildConnectionUrl(baseUrl: string): string {
  console.log('🔧 [BUILD URL] Função chamada');

  if (!baseUrl) return baseUrl;

  const url = new URL(baseUrl);
  const isSupabasePooler = url.hostname.includes('pooler.supabase.com');

  // 🎯 OTIMIZAÇÃO: Remover TODOS os parâmetros de pool da URL
  // O Prisma Client gerencia o pool internamente, não via parâmetros de URL
  // Parâmetros na URL podem causar conflitos e limitar o pool incorretamente
  const paramsToRemove = [
    'pool_size',
    'pool_timeout',
    'connect_timeout',
    'connection_limit',
    'pool',
    'application_name',
    'pgbouncer',
    'connection_limit',
  ];
  paramsToRemove.forEach((param) => url.searchParams.delete(param));

  // ✅ Para Supabase Pooler: apenas manter parâmetros essenciais
  if (isSupabasePooler) {
    // Para pooler, apenas adicionar pgbouncer=true se necessário
    // O Supabase gerencia o pool, não precisamos definir limites aqui
    url.searchParams.set('pgbouncer', 'true');

    prismaLogger.info(
      {
        mode: 'Supabase Pooler',
        note: 'Pool gerenciado pelo Supabase pgBouncer',
      },
      '✅ Configuração para Supabase Pooler',
    );
  } else {
    // Conexão direta - Prisma gerencia o pool internamente
    // Apenas garantir que a URL está limpa de parâmetros conflitantes
    prismaLogger.info(
      {
        mode: 'Direct Connection',
        note: 'Pool gerenciado pelo Prisma Client internamente',
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
  // Timeout padrão: 15s para produção (queries complexas podem levar mais tempo)
  // Sem timeout para testes (para não quebrar testes lentos)
  // Para queries de listagem com muitos dados, aumentar timeout via parâmetro
  const finalTimeout = timeoutMs ?? (process.env.NODE_ENV === 'test' ? undefined : 15000);
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
  // ✅ Usar a URL otimizada (sem parâmetros de pool conflitantes)
  // O Prisma Client gerencia o pool internamente - não precisa de parâmetros na URL
  const finalDatasourceUrl = optimizedDatasourceUrl;

  // ✅ Configurar Prisma Client
  // O Prisma Client usa um pool interno otimizado que não precisa de configuração manual
  // Para Supabase Direct Connection, o Prisma gerencia automaticamente o pool de conexões
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
      errorMessage.includes("can't reach database") ||
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
