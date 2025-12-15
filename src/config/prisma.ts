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

  // 🎯 OTIMIZAÇÃO: Remover apenas parâmetros conflitantes de pool
  // O Prisma Client gerencia o pool internamente, não via parâmetros de URL
  // Mas preservar parâmetros essenciais como sslmode
  const paramsToRemove = [
    'pool_size',
    'pool_timeout',
    'connection_limit', // Prisma gerencia internamente
    'application_name', // Opcional, pode causar conflitos
    'pgbouncer', // Remover primeiro - será adicionado depois se necessário
  ];
  paramsToRemove.forEach((param) => url.searchParams.delete(param));

  // ✅ Sempre garantir sslmode=require para Supabase
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }

  // ✅ Lógica correta para pgbouncer:
  // - Porta 6543 = Transaction Pooler (sempre precisa pgbouncer=true)
  // - Porta 5432 = Conexão direta (NÃO deve ter pgbouncer=true)
  if (isPoolerPort) {
    // Porta 6543 = Transaction Pooler
    url.searchParams.set('pgbouncer', 'true');
    prismaLogger.info(
      {
        mode: 'Transaction Pooler',
        port,
        note: 'Pool gerenciado pelo Supabase pgBouncer (porta 6543)',
      },
      '✅ Configuração para Transaction Pooler',
    );
  } else if (isPoolerHostname && port === 5432) {
    // Hostname pooler mas porta 5432 = Conexão direta através do pooler
    // Remover pgbouncer se existir (não é pooler, é conexão direta)
    url.searchParams.delete('pgbouncer');
    prismaLogger.info(
      {
        mode: 'Direct Connection',
        port,
        hostname: url.hostname,
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:169',message:'starting retry attempt',data:{attempt,maxRetries,hasTimeout:!!finalTimeout,timeoutMs:finalTimeout},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    try {
      // Implementar timeout para fail-fast (apenas se configurado)
      if (finalTimeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timeout after ${finalTimeout}ms`));
          }, finalTimeout);
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:179',message:'operation succeeded',data:{attempt},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return result;
      } else {
        // Sem timeout (útil para testes)
        const result = await operation();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:183',message:'operation succeeded (no timeout)',data:{attempt},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return result;
      }
    } catch (error: any) {
      lastError = error;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:184',message:'retryOperation error caught',data:{attempt,errorCode:error?.code,errorMessage:error?.message?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Se for timeout ou erro de conexão, tenta reconectar
      const isConnectionError =
        error?.code === 'P1001' || // Can't reach database
        error?.code === 'P2024' || // Timed out
        error?.message?.includes('timeout') ||
        error?.message?.includes('database server') ||
        error?.message?.includes('connection') ||
        error?.message?.includes("can't reach") ||
        error?.message?.includes('tenant or user not found');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:197',message:'connection error check',data:{isConnectionError,errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (isConnectionError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:203',message:'isConnectionError=true, checking retry logic',data:{attempt,maxRetries,willRetry:attempt < maxRetries},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:217',message:'waiting before retry',data:{attempt,delay,maxRetries},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Tenta reconectar apenas na primeira tentativa
          if (attempt === 1) {
            try {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:222',message:'attempting reconnect',data:{attempt},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
              await Promise.race([
                prisma.$connect(),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Connect timeout')), 3000),
                ),
              ]);
              prismaLogger.info('✅ Reconectado com sucesso');
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:230',message:'reconnect successful',data:{attempt},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
            } catch (connectError) {
              prismaLogger.warn('⚠️ Erro ao reconectar, continuando tentativa...');
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:233',message:'reconnect failed, continuing',data:{attempt},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
            }
          }

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:238',message:'continuing to next retry attempt',data:{attempt,nextAttempt:attempt+1,maxRetries},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          continue; // Tenta novamente
        }
        // Se for última tentativa e erro de conexão, o erro será lançado no final do loop
        // (não faz continue, então vai para o final do loop e lança lastError)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:242',message:'last attempt failed, will exit loop and throw',data:{attempt,maxRetries},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      } else {
        // Se não for erro de conexão, lança imediatamente
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:246',message:'not connection error, throwing immediately',data:{attempt,errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'prisma.ts:252',message:'throwing lastError after all retries failed',data:{errorCode:lastError?.code,errorType:lastError?.constructor?.name,errorMessage:lastError?.message?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Preservar o erro original para que o controller possa detectá-lo corretamente
  throw lastError;
}

function createPrismaClient() {
  // ✅ IMPORTANTE: Não passar datasourceUrl explicitamente
  // O Prisma Client lê automaticamente de DATABASE_URL e DIRECT_URL definidos no schema.prisma
  // Passar datasourceUrl pode causar conflitos e ignorar as configurações do schema
  
  // Log da configuração que será usada (para debug)
  if (datasourceUrl) {
    try {
      const url = new URL(datasourceUrl);
      prismaLogger.info(
        {
          hostname: url.hostname,
          port: url.port || '5432',
          hasSslMode: url.searchParams.has('sslmode'),
          hasPgbouncer: url.searchParams.has('pgbouncer'),
          usingDirectUrl: !!process.env.DIRECT_URL,
          usingDatabaseUrl: !!process.env.DATABASE_URL,
          note: 'Prisma lerá DATABASE_URL e DIRECT_URL do schema.prisma (não via datasourceUrl)',
        },
        '🔧 Configuração do PrismaClient',
      );
    } catch (error) {
      prismaLogger.warn({ err: error }, '⚠️ Erro ao analisar URL');
    }
  }

  // ✅ Configurar Prisma Client
  // O Prisma Client lê DATABASE_URL e DIRECT_URL automaticamente do schema.prisma
  // NÃO passar datasourceUrl - deixa o Prisma usar as variáveis de ambiente diretamente
  // Isso evita conflitos e garante que o schema.prisma seja respeitado
  const client = new PrismaClient({
    // ⚠️ NÃO passar datasourceUrl aqui - Prisma lê de schema.prisma via env vars
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
