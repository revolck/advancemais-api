#!/bin/bash

# Script de teste de performance para rotas do candidato
# Testa dashboard e cursos após otimizações

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

API_BASE_URL="${API_URL:-http://localhost:3000}"

echo "================================================================================"
echo -e "${BLUE}⚡ TESTE DE PERFORMANCE - APIs do Candidato${NC}"
echo "================================================================================"

# 1. Login
echo -e "\n${CYAN}🔐 Fazendo login como candidato...${NC}"
LOGIN_START=$(date +%s%N)
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/usuarios/login" \
  -H "Content-Type: application/json" \
  -d '{
    "documento": "12312312312",
    "senha": "Candidato@123"
  }')
LOGIN_END=$(date +%s%N)
LOGIN_TIME=$((($LOGIN_END - $LOGIN_START) / 1000000))

# Extrair token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // .data.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Erro no login${NC}"
  echo $LOGIN_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Login realizado (${LOGIN_TIME}ms)${NC}"

# 2. Teste Dashboard
echo -e "\n${CYAN}📊 TESTE 1: Dashboard do Candidato${NC}"
echo "Endpoint: GET /api/v1/candidatos/dashboard"
echo "Esperado: < 1000ms (otimizado)"

DASHBOARD_START=$(date +%s%N)
DASHBOARD_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/api/v1/candidatos/dashboard" \
  -H "Authorization: Bearer $TOKEN")
DASHBOARD_END=$(date +%s%N)
DASHBOARD_TIME=$((($DASHBOARD_END - $DASHBOARD_START) / 1000000))

# Separar resposta e status code
DASHBOARD_HTTP_CODE=$(echo "$DASHBOARD_RESPONSE" | tail -n1)
DASHBOARD_BODY=$(echo "$DASHBOARD_RESPONSE" | sed '$d')

if [ "$DASHBOARD_HTTP_CODE" != "200" ]; then
  echo -e "${RED}❌ Erro HTTP $DASHBOARD_HTTP_CODE${NC}"
  echo "$DASHBOARD_BODY" | jq '.' 2>/dev/null || echo "$DASHBOARD_BODY"
else
  # Verificar estrutura da resposta
  METRICAS=$(echo "$DASHBOARD_BODY" | jq '.metricas // empty')
  CURSOS_COUNT=$(echo "$DASHBOARD_BODY" | jq '.cursos | length // 0')
  CANDIDATURAS_COUNT=$(echo "$DASHBOARD_BODY" | jq '.candidaturas | length // 0')
  
  if [ -z "$METRICAS" ]; then
    echo -e "${RED}❌ Resposta inválida (sem métricas)${NC}"
  else
    if [ "$DASHBOARD_TIME" -lt 1000 ]; then
      echo -e "${GREEN}✅ Dashboard carregou em ${DASHBOARD_TIME}ms (OTIMIZADO)${NC}"
    elif [ "$DASHBOARD_TIME" -lt 2000 ]; then
      echo -e "${YELLOW}⚠️  Dashboard carregou em ${DASHBOARD_TIME}ms (ACEITÁVEL)${NC}"
    else
      echo -e "${RED}❌ Dashboard carregou em ${DASHBOARD_TIME}ms (LENTO)${NC}"
    fi
    
    echo "   📈 Métricas: $(echo "$METRICAS" | jq -c '.')"
    echo "   📚 Cursos retornados: $CURSOS_COUNT"
    echo "   💼 Candidaturas retornadas: $CANDIDATURAS_COUNT"
  fi
fi

# 3. Teste Cursos (Todos)
echo -e "\n${CYAN}📚 TESTE 2: Lista de Cursos (Todos)${NC}"
echo "Endpoint: GET /api/v1/candidatos/cursos?modalidade=TODOS"
echo "Esperado: < 1000ms (otimizado)"

CURSOS_START=$(date +%s%N)
CURSOS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/api/v1/candidatos/cursos?modalidade=TODOS" \
  -H "Authorization: Bearer $TOKEN")
CURSOS_END=$(date +%s%N)
CURSOS_TIME=$((($CURSOS_END - $CURSOS_START) / 1000000))

CURSOS_HTTP_CODE=$(echo "$CURSOS_RESPONSE" | tail -n1)
CURSOS_BODY=$(echo "$CURSOS_RESPONSE" | sed '$d')

if [ "$CURSOS_HTTP_CODE" != "200" ]; then
  echo -e "${RED}❌ Erro HTTP $CURSOS_HTTP_CODE${NC}"
  echo "$CURSOS_BODY" | jq '.' 2>/dev/null || echo "$CURSOS_BODY"
else
  # A resposta vem dentro de data
  CURSOS_DATA=$(echo "$CURSOS_BODY" | jq '.data // .')
  CURSOS_LIST_COUNT=$(echo "$CURSOS_DATA" | jq '.cursos | length // 0')
  PROXIMA_AULA=$(echo "$CURSOS_DATA" | jq '.proximaAula // empty')
  PAGINACAO=$(echo "$CURSOS_DATA" | jq '.paginacao // empty')
  
  if [ -z "$PAGINACAO" ] || [ "$PAGINACAO" = "null" ]; then
    echo -e "${RED}❌ Resposta inválida (sem paginação)${NC}"
    echo "Resposta completa:"
    echo "$CURSOS_BODY" | jq '.' | head -20
  else
    if [ "$CURSOS_TIME" -lt 1000 ]; then
      echo -e "${GREEN}✅ Cursos carregaram em ${CURSOS_TIME}ms (OTIMIZADO)${NC}"
    elif [ "$CURSOS_TIME" -lt 2000 ]; then
      echo -e "${YELLOW}⚠️  Cursos carregaram em ${CURSOS_TIME}ms (ACEITÁVEL)${NC}"
    else
      echo -e "${RED}❌ Cursos carregaram em ${CURSOS_TIME}ms (LENTO)${NC}"
    fi
    
    echo "   📚 Cursos retornados: $CURSOS_LIST_COUNT"
    echo "   📄 Total de páginas: $(echo "$PAGINACAO" | jq '.totalPages // 0')"
    if [ "$PROXIMA_AULA" != "null" ] && [ -n "$PROXIMA_AULA" ]; then
      echo "   🎓 Próxima aula: $(echo "$PROXIMA_AULA" | jq -r '.titulo // "N/A"')"
    else
      echo "   🎓 Próxima aula: Nenhuma agendada"
    fi
  fi
fi

# 4. Teste Cursos (Online)
echo -e "\n${CYAN}📚 TESTE 3: Lista de Cursos (Online)${NC}"
echo "Endpoint: GET /api/v1/candidatos/cursos?modalidade=ONLINE"

CURSOS_ONLINE_START=$(date +%s%N)
CURSOS_ONLINE_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/api/v1/candidatos/cursos?modalidade=ONLINE" \
  -H "Authorization: Bearer $TOKEN")
CURSOS_ONLINE_END=$(date +%s%N)
CURSOS_ONLINE_TIME=$((($CURSOS_ONLINE_END - $CURSOS_ONLINE_START) / 1000000))

CURSOS_ONLINE_HTTP_CODE=$(echo "$CURSOS_ONLINE_RESPONSE" | tail -n1)

if [ "$CURSOS_ONLINE_HTTP_CODE" = "200" ]; then
  if [ "$CURSOS_ONLINE_TIME" -lt 1000 ]; then
    echo -e "${GREEN}✅ Cursos Online carregaram em ${CURSOS_ONLINE_TIME}ms${NC}"
  else
    echo -e "${YELLOW}⚠️  Cursos Online carregaram em ${CURSOS_ONLINE_TIME}ms${NC}"
  fi
else
  echo -e "${RED}❌ Erro HTTP $CURSOS_ONLINE_HTTP_CODE${NC}"
fi

# 5. Resumo Final
echo -e "\n================================================================================"
echo -e "${BLUE}📊 RESUMO DE PERFORMANCE${NC}"
echo "================================================================================"

echo -e "\n${CYAN}⏱️  Tempos de Resposta:${NC}"
echo "   🔐 Login:              ${LOGIN_TIME}ms"
echo "   📊 Dashboard:          ${DASHBOARD_TIME}ms"
echo "   📚 Cursos (Todos):     ${CURSOS_TIME}ms"
echo "   📚 Cursos (Online):    ${CURSOS_ONLINE_TIME}ms"

echo -e "\n${CYAN}✅ Critérios de Performance:${NC}"
if [ "$DASHBOARD_TIME" -lt 1000 ]; then
  echo -e "   ${GREEN}✅ Dashboard: OTIMIZADO (< 1s)${NC}"
else
  echo -e "   ${YELLOW}⚠️  Dashboard: Pode melhorar (> 1s)${NC}"
fi

if [ "$CURSOS_TIME" -lt 1000 ]; then
  echo -e "   ${GREEN}✅ Cursos: OTIMIZADO (< 1s)${NC}"
else
  echo -e "   ${YELLOW}⚠️  Cursos: Pode melhorar (> 1s)${NC}"
fi

echo -e "\n${CYAN}📈 Comparação Esperada:${NC}"
echo "   Antes: 2-8 segundos (35-58 queries)"
echo "   Depois: < 1 segundo (3-4 queries)"
echo "   Redução: 91-93% menos queries"

echo -e "\n================================================================================"
echo -e "${GREEN}✅ TESTES DE PERFORMANCE CONCLUÍDOS${NC}"
echo "================================================================================"
