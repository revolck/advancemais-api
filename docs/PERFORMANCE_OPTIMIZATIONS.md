# Otimizações de Performance - API Advance+

Este documento descreve as otimizações implementadas para melhorar a performance da API, seguindo as recomendações do Supabase e boas práticas de desenvolvimento.

## ✅ Implementações Críticas (Alto Impacto)

### 1. PrismaClient Singleton

**Status**: ✅ Implementado

- Instância única do PrismaClient compartilhada entre todas as requisições
- Evita overhead de criação e esgota conexões do banco
- Configurado em `src/config/prisma.ts`

```typescript
// ✅ SINGLETON: Usar instância global em todos os ambientes
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
```

### 2. Direct Connection (Prioridade sobre Pooler)

**Status**: ✅ Implementado

- Prioriza `DIRECT_URL` sobre `DATABASE_URL` ou `DATABASE_POOL_URL`
- Direct Connection evita problemas com prepared statements e transações longas
- Pooler é recomendado apenas para serverless/ephemeral

**Configuração no `.env`**:

```env
DIRECT_URL="postgres://postgres:[PASSWORD]@aws-1-sa-east-1.connect.psql.cloud:5432/postgres?sslmode=require"
```

### 3. Índices Otimizados para Login

**Status**: ✅ Migração criada

- Índices compostos para CPF/CNPJ/Email com status
- Índice parcial para usuários ativos
- Migração: `prisma/migrations/add_login_performance_indexes/migration.sql`

**Índices adicionados**:

- `usuarios_cpf_status_idx` - Otimiza busca por CPF com filtro de status
- `usuarios_cnpj_status_idx` - Otimiza busca por CNPJ com filtro de status
- `usuarios_email_status_idx` - Otimiza busca por email com filtro de status
- `usuarios_ativo_idx` - Índice parcial para usuários ativos

**Aplicar migração**:

```bash
pnpm prisma migrate dev --name add_login_performance_indexes
```

### 4. Cache Redis para Login

**Status**: ✅ Implementado

- Cache de tentativas de login (rate limiting)
- Cache de bloqueios temporários
- Fallback para in-memory cache quando Redis não está disponível
- Implementado em `src/utils/cache.ts`

**Funcionalidades**:

- `loginCache.getAttempts()` - Busca tentativas de login
- `loginCache.setAttempts()` - Armazena tentativas (TTL: 15 min)
- `loginCache.getBlocked()` - Verifica se usuário está bloqueado
- `loginCache.setBlocked()` - Bloqueia usuário (TTL: 1 hora)

**Uso no login**:

```typescript
// Verifica bloqueio antes de buscar no banco
const isBlocked = await loginCache.getBlocked(documentoLimpo);
if (isBlocked) {
  return res.status(429).json({ message: 'Muitas tentativas...' });
}

// Incrementa tentativas após falha
await loginCache.setAttempts(documentoLimpo, attempts + 1, 900);

// Limpa cache após login bem-sucedido
await loginCache.deleteAttempts(documentoLimpo);
```

### 5. Timeout e Fail-Fast

**Status**: ✅ Implementado

- Timeout de 3s por tentativa no login (fail-fast)
- Retorna erro 503 em até 6-9s (antes ~30s)
- Reduz latência percebida pelo usuário

**Configuração**:

```typescript
await retryOperation(
  () => prisma.usuarios.findUnique(...),
  2,    // 2 tentativas
  500,  // 500ms delay
  3000, // 3s timeout por tentativa
);
```

### 6. Pool de Conexões Otimizado

**Status**: ✅ Configurado

- `connection_limit` ajustado baseado no número de instâncias
- Fórmula: `total_connections = N * pool_size < db_max_connections`
- Exemplo: 5 instâncias × 10 conexões = 50 conexões (limite DB: 100)

**Configuração atual**:

- Default: `connection_limit=10`
- Ajustar via `DATABASE_CONNECTION_LIMIT` no `.env`

## 🟡 Implementações de Médio Impacto (Pendentes)

### 7. Jobs Assíncronos para Auditoria

**Status**: ⏳ Pendente

- Mover logs de auditoria para fila (BullMQ/Redis Queue)
- Login deve apenas enfileirar evento de auditoria
- Processar em background worker

**Benefício**: Reduz latência do login de ~50ms para ~10ms

### 8. Cache de Queries Frequentes

**Status**: ⏳ Parcial

- Cache de perfil de usuário implementado (`userCache`)
- Cache de cursos públicos (pendente)
- Cache de categorias (pendente)

**Uso**:

```typescript
import { getCachedOrFetch } from '@/utils/cache';

const cursos = await getCachedOrFetch(
  'cursos:publicos',
  () => prisma.cursos.findMany({ where: { statusPadrao: 'PUBLICADO' } }),
  300, // 5 min TTL
);
```

### 9. Otimização de Queries N+1

**Status**: ⏳ Verificar

- Verificar includes e batch requests
- Usar `findMany` com `include` ao invés de múltiplos `findUnique` em loops
- Implementar DataLoader para batch requests

### 10. Cursor-Based Pagination

**Status**: ⏳ Pendente

- Substituir `LIMIT/OFFSET` por cursor-based pagination
- Melhor performance para listas grandes
- Implementar `cursor` e `take` ao invés de `skip`/`take`

**Exemplo**:

```typescript
// ❌ Antigo (lento com OFFSET grande)
const cursos = await prisma.cursos.findMany({
  skip: 10000,
  take: 20,
});

// ✅ Novo (cursor-based)
const cursos = await prisma.cursos.findMany({
  cursor: { id: lastId },
  take: 20,
});
```

## 🟢 Implementações de Baixo Impacto (Futuro)

### 11. Monitoring Avançado

- Prometheus/Datadog para métricas de latência p99
- Distributed tracing (OpenTelemetry)
- Alertas para queries lentas

### 12. Índices Parciais Adicionais

- Índices parciais para queries frequentes com filtros específicos
- Exemplo: `CREATE INDEX ON usuarios(id, status) WHERE status = 'ATIVO'`

## 📊 Métricas de Performance Esperadas

### Login

- **Antes**: ~100-200ms (com DB lento: 30s+)
- **Depois**: ~50-100ms (com DB lento: 6-9s fail-fast)
- **Melhoria**: 50-90% mais rápido

### Queries de Listagem

- **Antes**: ~200-500ms
- **Depois**: ~100-200ms (com cache)
- **Melhoria**: 50-60% mais rápido

### Conexão com Banco

- **Antes**: Falhas frequentes com pooler
- **Depois**: Estável com Direct Connection
- **Melhoria**: 100% menos erros de conexão

## 🔧 Configuração Recomendada

### Variáveis de Ambiente

```env
# ✅ PRIORIDADE: Direct Connection
DIRECT_URL="postgres://postgres:[PASSWORD]@aws-1-sa-east-1.connect.psql.cloud:5432/postgres?sslmode=require"

# Pool de conexões (ajustar baseado em número de instâncias)
DATABASE_CONNECTION_LIMIT=10  # Para 5 instâncias: 5 × 10 = 50 conexões

# Cache Redis
REDIS_URL="redis://localhost:6379"

# Timeouts
DATABASE_CONNECT_TIMEOUT=10
DATABASE_POOL_TIMEOUT=30
```

### Cálculo de Pool Size

```
total_connections = número_instâncias × connection_limit
total_connections < db_max_connections (geralmente 100)

Exemplo:
- 5 instâncias da API
- connection_limit = 10
- Total: 5 × 10 = 50 conexões
- Sobra: 100 - 50 = 50 conexões para outras operações
```

## 🚀 Próximos Passos

1. **Imediato**:
   - [ ] Aplicar migração de índices: `pnpm prisma migrate dev`
   - [ ] Configurar `DIRECT_URL` no `.env`
   - [ ] Testar login com cache Redis

2. **Curto Prazo**:
   - [ ] Implementar jobs assíncronos para auditoria
   - [ ] Adicionar cache para cursos públicos
   - [ ] Otimizar queries N+1

3. **Médio Prazo**:
   - [ ] Implementar cursor-based pagination
   - [ ] Adicionar monitoring avançado
   - [ ] Testes de carga (k6/artillery)

## 📚 Referências

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma Performance](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Indexing](https://www.postgresql.org/docs/current/indexes.html)
