# Configuração de Conexão com Banco de Dados (Supabase)

## Problema: "Can't reach database server"

Este erro ocorre quando o Prisma não consegue conectar ao banco de dados Supabase. As causas mais comuns são:

1. **Pooler Transaction vs Direct Connection**: O Pooler do Supabase (pgBouncer) não é recomendado para aplicações Node.js persistentes
2. **Timeout de conexão**: Queries muito longas (>30s)
3. **Prepared statements**: O pooler não suporta adequadamente prepared statements do Prisma

## Solução Recomendada: Direct Connection

### 1. Obter Connection String Direta

No Dashboard do Supabase:
1. Vá em **Settings** → **Database**
2. Em **Connection string**, selecione **URI** (não Transaction Pooler)
3. Copie a string que começa com `postgres://...` (sem `pooler.supabase.com`)

Exemplo:
```
postgres://postgres:[PASSWORD]@aws-1-sa-east-1.connect.psql.cloud:5432/postgres?sslmode=require
```

### 2. Configurar Variável de Ambiente

Adicione no seu `.env`:

```env
# ✅ PRIORIDADE: Direct Connection (recomendado para apps Node persistentes)
DIRECT_URL="postgres://postgres:[PASSWORD]@aws-1-sa-east-1.connect.psql.cloud:5432/postgres?sslmode=require"

# Fallback: DATABASE_URL (pode ser pooler ou direct)
DATABASE_URL="postgres://postgres:[PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Pooler (opcional, apenas se necessário)
DATABASE_POOL_URL="postgres://postgres:[PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true"
```

**Ordem de prioridade no código:**
1. `DIRECT_URL` (usado primeiro)
2. `DATABASE_URL` (fallback)
3. `DATABASE_POOL_URL` (último recurso)

### 3. Reiniciar a Aplicação

Após configurar `DIRECT_URL`, reinicie o servidor:

```bash
npm run dev
```

## Verificação de Conexão

### Testar DNS e Conectividade

No host onde a aplicação roda:

```bash
# Verificar DNS
dig aws-1-sa-east-1.pooler.supabase.com
dig aws-1-sa-east-1.connect.psql.cloud  # Direct connection

# Verificar conectividade TCP
nc -vz aws-1-sa-east-1.pooler.supabase.com 5432
nc -vz aws-1-sa-east-1.connect.psql.cloud 5432

# Testar conexão direta com psql
psql "postgresql://postgres:[PASSWORD]@aws-1-sa-east-1.connect.psql.cloud:5432/postgres?sslmode=require"
```

### Verificar Logs da Aplicação

A aplicação loga automaticamente qual tipo de conexão está sendo usada:

```
✅ Configuração para conexão direta
✅ Prisma conectado com sucesso
```

## Comportamento da Aplicação

### Timeout e Fail-Fast

- **Timeout por tentativa**: 3-5 segundos (configurável)
- **Retries**: 2-3 tentativas com exponential backoff
- **Fail-fast**: Se não conectar em 3-5s, retorna erro 503 ao invés de esperar 30s+

### Tratamento de Erros

- Erros de conexão são detectados automaticamente
- Retorna `503 Service Unavailable` quando o banco não está disponível
- Logs mostram tentativas de reconexão
- Cron jobs verificam conexão antes de executar

## Troubleshooting

### Problema: Ainda recebe "Can't reach database"

1. **Verifique se `DIRECT_URL` está configurado**:
   ```bash
   echo $DIRECT_URL
   ```

2. **Verifique logs de inicialização**:
   Procure por:
   ```
   🔧 [PRISMA CONFIG] datasourceUrl length: [número]
   ✅ Configuração para conexão direta
   ```

3. **Teste conexão manual**:
   ```bash
   psql "$DIRECT_URL"
   ```

4. **Verifique firewall/rede**:
   - O host precisa conseguir alcançar `*.connect.psql.cloud:5432`
   - Verifique regras de firewall corporativo
   - Verifique variáveis de proxy (`HTTP_PROXY`, `HTTPS_PROXY`)

### Problema: Conexão funciona mas queries falham

- Verifique se está usando **Direct Connection** (não pooler)
- Verifique se `connection_limit` está configurado corretamente
- Verifique logs do Prisma para queries lentas

### Problema: Timeout em queries específicas

- Queries com timeout são tratadas automaticamente
- Verifique se a query está otimizada (índices, etc.)
- Considere aumentar timeout para queries específicas (não recomendado)

## Configurações Avançadas

### Connection Pool Settings

```env
# Limite de conexões simultâneas
DATABASE_CONNECTION_LIMIT=10

# Timeout de pool
DATABASE_POOL_TIMEOUT=30

# Timeout de conexão inicial
DATABASE_CONNECT_TIMEOUT=10
```

### Habilitar Eager Connection (Opcional)

Por padrão, o Prisma usa "lazy connection" (conecta na primeira query). Para conectar imediatamente:

```env
PRISMA_EAGER_CONNECT=true
```

## Referências

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Connection String](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)


