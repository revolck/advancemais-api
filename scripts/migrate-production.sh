#!/bin/bash
# Script para executar migrações no banco de produção do Neon
# Uso: ./scripts/migrate-production.sh [comando]
# Exemplo: ./scripts/migrate-production.sh migrate deploy

# Connection strings da branch de produção
export DATABASE_URL="postgresql://neondb_owner:npg_nmzwKraXY6E1@ep-dawn-hat-acz0mjq4-pooler.sa-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
export DIRECT_URL="postgresql://neondb_owner:npg_nmzwKraXY6E1@ep-dawn-hat-acz0mjq4.sa-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

# Comando padrão se não fornecido
COMMAND="${*:-migrate deploy}"

echo "🚀 Executando migração na branch de PRODUÇÃO..."
echo "📊 Branch: production (br-quiet-bird-acv00y7w)"
echo "🔗 Host: ep-dawn-hat-acz0mjq4"
echo "📝 Comando: pnpm prisma $COMMAND"
echo ""

# Executa o comando do Prisma
pnpm prisma $COMMAND

