# 🔧 Correção do Erro de Migration "type already exists"

## ❌ Problema

O erro ocorre quando:
1. O tipo enum `AcoesDeLogDeBloqueio` (ou outros) já existe no banco
2. A migration `20251105140000_init` tenta criá-lo novamente
3. O histórico de migrations do Prisma está dessincronizado

**Erro no Render:**
```
ERROR: type "AcoesDeLogDeBloqueio" already exists
Migration name: 20251105140000_init
```

## ✅ Soluções

### Opção 1: Reset Completo (Recomendado para Produção)

Limpa completamente o banco e aplica o schema sem migrations:

```bash
pnpm run prisma:reset:prod
```

Este comando:
1. Remove todas as tabelas, enums, tipos e sequences
2. Aplica o schema usando `prisma db push` (sem criar migrations)
3. Gera o cliente Prisma

### Opção 2: Corrigir Estado de Migrations

Remove apenas a migration problemática do histórico:

```bash
pnpm run prisma:fix:migration
pnpm run prisma:push
pnpm run prisma:generate
```

### Opção 3: Reset Manual Completo

Para limpar tudo manualmente:

```bash
pnpm run prisma:reset:complete
pnpm run prisma:push
pnpm run prisma:generate
```

## 🚀 Para Deploy no Render

### Problema no Build

O comando de build no Render está usando:
```bash
pnpm prisma migrate deploy
```

Isso tenta aplicar migrations que podem estar conflitando.

### Solução 1: Alterar Build Command no Render

No dashboard do Render, altere o build command para:
```bash
pnpm install --frozen-lockfile && pnpm run prisma:fix:migration && pnpm prisma db push && pnpm prisma generate && pnpm run build
```

Ou se preferir reset completo (⚠️ CUIDADO: apaga todos os dados):
```bash
pnpm install --frozen-lockfile && pnpm run prisma:reset:complete && pnpm prisma db push && pnpm prisma generate && pnpm run build
```

### Solução 2: Usar db push ao invés de migrate deploy

Altere o build command para:
```bash
pnpm install --frozen-lockfile && pnpm prisma db push && pnpm prisma generate && pnpm run build
```

**Nota:** `db push` não usa migrations, apenas sincroniza o schema diretamente.

## 📝 Comandos Disponíveis

- `pnpm run prisma:reset:complete` - Limpa completamente o banco
- `pnpm run prisma:reset:prod` - Reset completo + push + generate
- `pnpm run prisma:fix:migration` - Corrige estado de migrations
- `pnpm run prisma:push` - Aplica schema sem migrations
- `pnpm run prisma:generate` - Gera cliente Prisma

## ⚠️ Avisos

1. **Reset completo apaga TODOS os dados** - Use apenas em desenvolvimento ou quando necessário
2. **db push não cria migrations** - Use apenas quando não precisar de histórico de migrations
3. **Sempre faça backup** antes de executar resets em produção

