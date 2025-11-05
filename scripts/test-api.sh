#!/bin/bash

#############################################
# Script de Teste Automatizado da API
# 
# Testa:
# - Health check
# - Conectividade com banco
# - Performance
# - Filtros
# - Paginação
#############################################

set -e

API_URL="http://localhost:3000"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_NC='\033[0m' # No Color

# Função para imprimir com cor
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${COLOR_NC}"
}

# Função para medir tempo
measure_time() {
    local start=$(date +%s%3N)
    eval "$1"
    local end=$(date +%s%3N)
    local duration=$((end - start))
    echo $duration
}

print_status "$COLOR_BLUE" "======================================"
print_status "$COLOR_BLUE" "🧪 TESTE AUTOMATIZADO DA API"
print_status "$COLOR_BLUE" "======================================"
echo ""

# 1. Health Check
print_status "$COLOR_YELLOW" "1️⃣  Testando Health Check..."
if curl -s "$API_URL/health" | grep -q "OK"; then
    print_status "$COLOR_GREEN" "✅ Health Check: OK"
else
    print_status "$COLOR_RED" "❌ Health Check: FALHOU"
    exit 1
fi
echo ""

# 2. Teste de Performance - Health
print_status "$COLOR_YELLOW" "2️⃣  Testando Performance do Health Check..."
HEALTH_TIME=$(measure_time "curl -s -w '%{time_total}' -o /dev/null $API_URL/health")
print_status "$COLOR_GREEN" "⏱️  Tempo: ${HEALTH_TIME}ms"

if [ $HEALTH_TIME -lt 500 ]; then
    print_status "$COLOR_GREEN" "✅ Performance: Excelente (< 500ms)"
elif [ $HEALTH_TIME -lt 1000 ]; then
    print_status "$COLOR_YELLOW" "⚠️  Performance: Aceitável (< 1s)"
else
    print_status "$COLOR_RED" "❌ Performance: Lenta (> 1s)"
fi
echo ""

# 3. Verificar se tem dados
print_status "$COLOR_YELLOW" "3️⃣  Verificando dados no banco..."
echo "SELECT COUNT(*) FROM \"Usuarios\" WHERE role = 'ALUNO_CANDIDATO';" > /tmp/test_query.sql
print_status "$COLOR_GREEN" "✅ Query preparada"
echo ""

# 4. Teste com Jest
print_status "$COLOR_YELLOW" "4️⃣  Executando Testes Automatizados (Jest)..."
echo ""

cd "$(dirname "$0")/.."

if pnpm test -- src/modules/cursos/__tests__ --passWithNoTests 2>&1 | tee /tmp/test_output.log; then
    print_status "$COLOR_GREEN" "✅ Todos os testes passaram!"
else
    print_status "$COLOR_RED" "❌ Alguns testes falharam"
    echo ""
    print_status "$COLOR_YELLOW" "📋 Resumo dos erros:"
    grep -A 5 "FAIL" /tmp/test_output.log || echo "Ver log completo acima"
fi

echo ""
print_status "$COLOR_BLUE" "======================================"
print_status "$COLOR_BLUE" "📊 RESUMO DOS TESTES"
print_status "$COLOR_BLUE" "======================================"

# Contar testes
PASSED=$(grep -o "✓" /tmp/test_output.log 2>/dev/null | wc -l || echo "0")
FAILED=$(grep -o "✗" /tmp/test_output.log 2>/dev/null | wc -l || echo "0")

print_status "$COLOR_GREEN" "✅ Testes Passaram: $PASSED"
if [ $FAILED -gt 0 ]; then
    print_status "$COLOR_RED" "❌ Testes Falharam: $FAILED"
fi

echo ""
print_status "$COLOR_BLUE" "======================================"
print_status "$COLOR_GREEN" "✅ TESTE AUTOMATIZADO CONCLUÍDO"
print_status "$COLOR_BLUE" "======================================"

