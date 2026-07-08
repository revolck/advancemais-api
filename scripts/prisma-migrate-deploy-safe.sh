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
  echo "⚠️ O build seguirá sem aplicar migrations automaticamente para evitar falha no deploy."
  echo "⚠️ Faça o baseline/manual resolve antes de voltar a exigir migrate deploy no pipeline."
  exit 0
fi

echo ""
echo "❌ Prisma migrate deploy falhou com erro diferente de P3005."
exit 1
