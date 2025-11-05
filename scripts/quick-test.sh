#!/bin/bash

#############################################
# Script de Teste Rápido
# Executa testes essenciais rapidamente
#############################################

set -e

API_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 TESTE RÁPIDO DA API${NC}"
echo ""

# 1. Health Check
echo -e "${YELLOW}1. Health Check...${NC}"
if curl -s "$API_URL/health" | grep -q "OK"; then
    echo -e "${GREEN}✅ API está respondendo${NC}"
else
    echo -e "${RED}❌ API não está respondendo${NC}"
    exit 1
fi

# 2. Teste de Performance
echo -e "${YELLOW}2. Performance...${NC}"
START=$(date +%s%3N)
curl -s -o /dev/null "$API_URL/health"
END=$(date +%s%3N)
DURATION=$((END - START))

if [ $DURATION -lt 500 ]; then
    echo -e "${GREEN}✅ Performance excelente: ${DURATION}ms${NC}"
elif [ $DURATION -lt 1000 ]; then
    echo -e "${YELLOW}⚠️  Performance aceitável: ${DURATION}ms${NC}"
else
    echo -e "${RED}❌ Performance lenta: ${DURATION}ms${NC}"
fi

# 3. Verificar se o servidor está aceitando conexões
echo -e "${YELLOW}3. Verificando endpoints...${NC}"
ENDPOINTS=("/health" "/api/v1/usuarios" "/api/v1/cursos")
for endpoint in "${ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint" || echo "000")
    if [ "$STATUS" != "000" ]; then
        echo -e "${GREEN}  ✅ $endpoint - HTTP $STATUS${NC}"
    else
        echo -e "${RED}  ❌ $endpoint - Não acessível${NC}"
    fi
done

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}✅ TESTES RÁPIDOS CONCLUÍDOS!${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo -e "${YELLOW}💡 Para testes completos com banco de dados:${NC}"
echo -e "   ${BLUE}pnpm test:integration${NC}"
