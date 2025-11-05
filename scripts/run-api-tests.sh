#!/bin/bash

# Script para executar testes automatizados da API
# Uso: ./scripts/run-api-tests.sh [test-file]

set -e

echo "🧪 Executando testes automatizados da API..."

# Verificar se porta 3000 está em uso
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Porta 3000 já está em uso. Testes vão usar a instância existente."
else
    echo "ℹ️  Porta 3000 não está em uso. Inicie o servidor em outra janela com: npm run dev"
fi

# Executar testes
if [ -z "$1" ]; then
    echo "📋 Executando todos os testes da API..."
    npm run test -- src/__tests__/api --testTimeout=30000
else
    echo "📋 Executando teste: $1"
    npm run test -- "$1" --testTimeout=30000
fi

echo "✅ Testes concluídos!"


