#!/bin/bash
set -euo pipefail

TMP_LOG="$(mktemp)"
cleanup() {
  rm -f "$TMP_LOG"
}
trap cleanup EXIT

echo "🚀 Executando prisma migrate deploy..."

if pnpm prisma migrate deploy 2>&1 | tee "$TMP_LOG"; then
  echo "✅ Prisma migrate deploy concluído."
  exit 0
fi

if grep -q "Error: P3005" "$TMP_LOG"; then
  echo ""
  echo "⚠️ Prisma retornou P3005: banco já existente sem baseline de migrations."
  echo "⚠️ Sincronizando o schema via prisma db push sem aceitar perda de dados."
  echo "⚠️ Se o Prisma detectar operação destrutiva, este deploy falhará."
  pnpm prisma db push --skip-generate
  echo "✅ Schema sincronizado via prisma db push."
  exit 0
fi

echo ""
echo "❌ Prisma migrate deploy falhou com erro diferente de P3005."
exit 1
