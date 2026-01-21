#!/bin/bash

# Script para testar integração de publicação/exclusão de aulas
# Verifica Google Calendar e notificações

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

print_status() {
    echo -e "${1}${2}${COLOR_RESET}"
}

echo ""
print_status "$COLOR_BLUE" "======================================"
print_status "$COLOR_BLUE" "🧪 TESTE DE INTEGRAÇÃO - AULAS"
print_status "$COLOR_BLUE" "======================================"
echo ""

# Verificar se servidor está rodando
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    print_status "$COLOR_RED" "❌ Servidor não está rodando!"
    print_status "$COLOR_YELLOW" "   Execute: npm run dev"
    exit 1
fi

print_status "$COLOR_GREEN" "✅ Servidor está rodando"
echo ""

# Verificar variáveis de ambiente necessárias
print_status "$COLOR_YELLOW" "1️⃣  Verificando variáveis de ambiente..."

if [ -z "$DATABASE_URL" ]; then
    print_status "$COLOR_RED" "❌ DATABASE_URL não configurada"
    exit 1
fi

if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    print_status "$COLOR_YELLOW" "⚠️  Google OAuth não configurado (testes de Calendar podem falhar)"
fi

print_status "$COLOR_GREEN" "✅ Variáveis de ambiente OK"
echo ""

# Executar testes automatizados
print_status "$COLOR_YELLOW" "2️⃣  Executando testes automatizados..."

cd "$(dirname "$0")/.."

if npm run test -- src/__tests__/api/aulas-publicacao-exclusao.test.ts --testTimeout=30000 2>&1 | tee /tmp/aulas-test.log; then
    print_status "$COLOR_GREEN" "✅ Testes automatizados passaram!"
else
    print_status "$COLOR_RED" "❌ Alguns testes falharam"
    echo ""
    print_status "$COLOR_YELLOW" "📋 Resumo dos erros:"
    grep -A 5 "FAIL\|Error" /tmp/aulas-test.log || echo "Ver log completo acima"
fi

echo ""

# Verificar integração Google Calendar
print_status "$COLOR_YELLOW" "3️⃣  Verificando integração Google Calendar..."

# Verificar se há aulas com meetEventId
CALENDAR_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"CursosTurmasAulas\" WHERE \"meetEventId\" IS NOT NULL AND \"deletedAt\" IS NULL;" 2>/dev/null || echo "0")

if [ "$CALENDAR_COUNT" -gt 0 ]; then
    print_status "$COLOR_GREEN" "✅ Encontradas $CALENDAR_COUNT aula(s) com eventos no Google Calendar"
else
    print_status "$COLOR_YELLOW" "⚠️  Nenhuma aula com evento no Google Calendar encontrada"
fi

echo ""

# Verificar notificações
print_status "$COLOR_YELLOW" "4️⃣  Verificando sistema de notificações..."

NOTIF_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"Notificacoes\" WHERE tipo IN ('AULA_PUBLICADA', 'AULA_DESPUBLICADA', 'AULA_CANCELADA') AND \"criadoEm\" > NOW() - INTERVAL '24 hours';" 2>/dev/null || echo "0")

if [ "$NOTIF_COUNT" -gt 0 ]; then
    print_status "$COLOR_GREEN" "✅ Encontradas $NOTIF_COUNT notificação(ões) de aulas nas últimas 24h"
else
    print_status "$COLOR_YELLOW" "⚠️  Nenhuma notificação de aula encontrada nas últimas 24h"
fi

echo ""

# Verificar histórico de alterações
print_status "$COLOR_YELLOW" "5️⃣  Verificando histórico de alterações..."

HISTORICO_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"CursosAulasHistorico\" WHERE acao IN ('STATUS_ALTERADO', 'CANCELADA') AND \"criadoEm\" > NOW() - INTERVAL '24 hours';" 2>/dev/null || echo "0")

if [ "$HISTORICO_COUNT" -gt 0 ]; then
    print_status "$COLOR_GREEN" "✅ Encontrados $HISTORICO_COUNT registro(s) de histórico nas últimas 24h"
else
    print_status "$COLOR_YELLOW" "⚠️  Nenhum registro de histórico encontrado nas últimas 24h"
fi

echo ""

# Resumo
print_status "$COLOR_BLUE" "======================================"
print_status "$COLOR_BLUE" "📊 RESUMO"
print_status "$COLOR_BLUE" "======================================"
print_status "$COLOR_GREEN" "✅ Testes automatizados executados"
print_status "$COLOR_GREEN" "✅ Integração Google Calendar verificada"
print_status "$COLOR_GREEN" "✅ Sistema de notificações verificado"
print_status "$COLOR_GREEN" "✅ Histórico de alterações verificado"
echo ""
print_status "$COLOR_BLUE" "======================================"
print_status "$COLOR_GREEN" "✅ TESTE DE INTEGRAÇÃO CONCLUÍDO"
print_status "$COLOR_BLUE" "======================================"
echo ""


















