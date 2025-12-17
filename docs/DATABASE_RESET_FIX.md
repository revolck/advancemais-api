# 🔧 Correção do Erro "Tenant or user not found" no Prisma Migrate Reset

## ❌ Problema

O erro `FATAL: Tenant or user not found` ocorre quando você tenta executar `prisma migrate reset` porque:

1. **O `prisma migrate reset` usa comandos DDL** (DROP, TRUNCATE CASCADE) que **não funcionam através do pooler do Supabase** (pgBouncer)
2. A `DIRECT_URL` no seu `.env` está apontando para o **pooler** (`pooler.supabase.com`) ao invés da **conexão direta**

## ✅ Solução

Ajuste a `DIRECT_URL` no seu `.env` para usar a **conexão direta** (sem pooler):

### Configuração Atual (INCORRETA):

```env
DATABASE_URL="postgresql://postgres:***@db.bofgfwsqjphyanggirzs.supabase.co:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:***@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30&pool_timeout=20&pool_size=10"
```

### Configuração Correta:

```env
# Para queries normais (com pooler para melhor performance)
DATABASE_URL="postgresql://postgres:***@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true"

# Para migrações e reset (conexão direta, SEM pooler)
DIRECT_URL="postgresql://postgres:***@db.bofgfwsqjphyanggirzs.supabase.co:5432/postgres?sslmode=require"
```

## 📝 Por que isso acontece?

- **Pooler (pgBouncer)**: Otimizado para queries DML (SELECT, INSERT, UPDATE, DELETE), mas **não suporta DDL** (DROP, TRUNCATE, ALTER TABLE, etc.)
- **Conexão Direta**: Necessária para migrações e reset, pois permite comandos DDL completos

## 🚀 Como Corrigir

1. Edite o arquivo `.env`
2. Troque a `DIRECT_URL` para usar `db.bofgfwsqjphyanggirzs.supabase.co` (sem pooler)
3. Opcionalmente, troque a `DATABASE_URL` para usar o pooler (melhor performance)

## 🔄 Alternativa: Reset Manual

Se você não quiser alterar as configurações, pode usar o reset manual que já funciona:

```bash
npx ts-node --transpile-only -r tsconfig-paths/register scripts/reset-database.ts
```

Ou executar o script diretamente que limpou todas as tabelas via SQL.

## 📚 Referências

- [Prisma + Supabase Documentation](https://www.prisma.io/docs/orm/overview/databases/supabase)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
