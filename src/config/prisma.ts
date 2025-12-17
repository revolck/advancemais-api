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
  const port = parseInt(url.port || '5432');
  const isPoolerPort = port === 6543;
  const isPoolerHostname = url.hostname.includes('pooler.supabase.com');

  // 🎯 OTIMIZAÇÃO: Remover parâmetros que serão reconfigurados
  const paramsToRemove = [
    'pool_size',
    'application_name', // Opcional, pode causar conflitos
    'pgbouncer', // Remover primeiro - será adicionado depois se necessário
  ];
  paramsToRemove.forEach((param) => url.searchParams.delete(param));

  // ✅ Sempre garantir sslmode=require para Supabase
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }

  // ✅ CRÍTICO: Configurar parâmetros de pool do Prisma
  // Esses parâmetros são essenciais para evitar esgotamento de conexões
  // Documentação: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections#connection-pool
  url.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
  url.searchParams.set('pool_timeout', DEFAULT_POOL_TIMEOUT);
  url.searchParams.set('connect_timeout', DEFAULT_CONNECT_TIMEOUT);

  // ✅ Lógica correta para pgbouncer:
  // - Porta 6543 = Transaction Pooler (sempre precisa pgbouncer=true)
  // - Porta 5432 = Conexão direta (NÃO deve ter pgbouncer=true)
  if (isPoolerPort) {
    // Porta 6543 = Transaction Pooler
    url.searchParams.set('pgbouncer', 'true');
    // Para pgbouncer, usar connection_limit menor (gerenciado pelo pooler)
    url.searchParams.set('connection_limit', DEFAULT_POOLER_CONNECTION_LIMIT);
    prismaLogger.info(
      {
        mode: 'Transaction Pooler',
        port,
        connectionLimit: DEFAULT_POOLER_CONNECTION_LIMIT,
        poolTimeout: DEFAULT_POOL_TIMEOUT,
        note: 'Pool gerenciado pelo Supabase pgBouncer (porta 6543)',
      },
      '✅ Configuração para Transaction Pooler',
    );
  } else if (isPoolerHostname && port === 5432) {
    // Hostname pooler mas porta 5432 = Conexão direta através do pooler
    url.searchParams.delete('pgbouncer');
    prismaLogger.info(
      {
        mode: 'Direct Connection',
        port,
        hostname: url.hostname,
        connectionLimit: DEFAULT_CONNECTION_LIMIT,
        poolTimeout: DEFAULT_POOL_TIMEOUT,
        note: 'Conexão direta através de hostname pooler (porta 5432)',
      },
      '✅ Configuração para conexão direta',
    );
  } else {
    // Conexão direta padrão
    url.searchParams.delete('pgbouncer');
    prismaLogger.info(
      {
        mode: 'Direct Connection',
        port,
        connectionLimit: DEFAULT_CONNECTION_LIMIT,
        poolTimeout: DEFAULT_POOL_TIMEOUT,
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
        const result = await operation();
        return result;
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

          continue; // Tenta novamente
        }
        // Se for última tentativa e erro de conexão, o erro será lançado no final do loop
      } else {
        // Se não for erro de conexão, lança imediatamente
        throw error;
      }
    }
  }

  // Todas as tentativas falharam
  prismaLogger.error(
    {
      maxRetries,
      error: lastError?.message?.substring(0, 200),
      code: lastError?.code,
      errorType: lastError?.constructor?.name,
      isPrismaError: lastError?.code?.startsWith('P'),
    },
    `❌ Todas as tentativas falharam após ${maxRetries} tentativas`,
  );

  // Preservar o erro original para que o controller possa detectá-lo corretamente
  throw lastError;
}

function createPrismaClient() {
  // ✅ CRÍTICO: Passar datasourceUrl com parâmetros de pool otimizados
  // O Prisma Client usa os parâmetros de URL para configurar o connection pool
  // Sem esses parâmetros, o Prisma usa defaults muito baixos (connection_limit: 9, pool_timeout: 10)
  // que causam erros de timeout em produção
  
  // Log da configuração que será usada (para debug)
  if (optimizedDatasourceUrl) {
    try {
      const url = new URL(optimizedDatasourceUrl);
      prismaLogger.info(
        {
          hostname: url.hostname,
          port: url.port || '5432',
          connectionLimit: url.searchParams.get('connection_limit'),
          poolTimeout: url.searchParams.get('pool_timeout'),
          connectTimeout: url.searchParams.get('connect_timeout'),
          hasSslMode: url.searchParams.has('sslmode'),
          hasPgbouncer: url.searchParams.has('pgbouncer'),
          usingDirectUrl: !!process.env.DIRECT_URL,
          usingDatabaseUrl: !!process.env.DATABASE_URL,
        },
        '🔧 Configuração do PrismaClient com pool otimizado',
      );
    } catch (error) {
      prismaLogger.warn({ err: error }, '⚠️ Erro ao analisar URL');
    }
  }

  // ✅ Configurar Prisma Client com URL otimizada
  // IMPORTANTE: Passar datasourceUrl para aplicar os parâmetros de pool
  // connection_limit, pool_timeout e connect_timeout são configurados na URL
  const client = new PrismaClient({
    datasourceUrl: optimizedDatasourceUrl,
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
