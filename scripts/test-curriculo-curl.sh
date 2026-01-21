#!/bin/bash

# Script de teste do currículo principal usando curl
# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_BASE_URL="${API_URL:-http://localhost:3000}"

echo "================================================================================"
echo -e "${BLUE}🧪 TESTE: Regra de Currículo Principal${NC}"
echo "================================================================================"

# 1. Login
echo -e "\n${BLUE}🔐 Fazendo login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/usuarios/login" \
  -H "Content-Type: application/json" \
  -d '{
    "documento": "12312312312",
    "senha": "Candidato@123"
  }')

# Extrair token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // .data.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Erro no login${NC}"
  echo $LOGIN_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Login realizado com sucesso${NC}"
echo "Token: ${TOKEN:0:50}..."

# 2. Listar currículos existentes e limpar
echo -e "\n${BLUE}🧹 Verificando currículos existentes...${NC}"
CURRICULOS_EXISTENTES=$(curl -s -X GET "$API_BASE_URL/api/v1/candidatos/curriculos" \
  -H "Authorization: Bearer $TOKEN")

echo $CURRICULOS_EXISTENTES | jq -r '.[] | "  - \(.id) - \(.titulo // "Sem título") - Principal: \(.principal)"'

# Excluir todos os currículos
echo -e "${YELLOW}Excluindo currículos existentes...${NC}"
CURRICULO_IDS=$(echo $CURRICULOS_EXISTENTES | jq -r '.[].id')
for id in $CURRICULO_IDS; do
  curl -s -X DELETE "$API_BASE_URL/api/v1/candidatos/curriculos/$id" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
done
echo -e "${GREEN}✅ Currículos removidos${NC}"

# 3. TESTE 1: Criar primeiro currículo
echo -e "\n${BLUE}📝 TESTE 1: Criar primeiro currículo${NC}"
echo "Esperado: Deve ser marcado como principal automaticamente"

CURRICULO1=$(curl -s -X POST "$API_BASE_URL/api/v1/candidatos/curriculos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Meu Primeiro Currículo",
    "resumo": "Desenvolvedor Full Stack",
    "objetivo": "Busco oportunidades na área de tecnologia"
  }')

CURRICULO1_ID=$(echo $CURRICULO1 | jq -r '.id')
CURRICULO1_PRINCIPAL=$(echo $CURRICULO1 | jq -r '.principal')

if [ "$CURRICULO1_PRINCIPAL" = "true" ]; then
  echo -e "${GREEN}✅ PASSOU: Primeiro currículo é principal${NC}"
else
  echo -e "${RED}❌ FALHOU: Primeiro currículo NÃO é principal${NC}"
fi

# 4. TESTE 2: Criar segundo currículo marcando como principal
echo -e "\n${BLUE}📝 TESTE 2: Criar segundo currículo como principal${NC}"
echo "Esperado: O primeiro deve ser desmarcado, o segundo deve ser principal"

CURRICULO2=$(curl -s -X POST "$API_BASE_URL/api/v1/candidatos/curriculos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Meu Segundo Currículo",
    "resumo": "Desenvolvedor Backend",
    "objetivo": "Foco em APIs e microservices",
    "principal": true
  }')

CURRICULO2_ID=$(echo $CURRICULO2 | jq -r '.id')
CURRICULO2_PRINCIPAL=$(echo $CURRICULO2 | jq -r '.principal')

if [ "$CURRICULO2_PRINCIPAL" = "true" ]; then
  echo -e "${GREEN}✅ Segundo currículo criado como principal${NC}"
else
  echo -e "${RED}❌ FALHOU: Segundo currículo NÃO foi criado como principal${NC}"
fi

# 5. TESTE 3: Verificar lista de currículos
echo -e "\n${BLUE}📝 TESTE 3: Verificar lista de currículos${NC}"
echo "Esperado: Exatamente 1 currículo principal"

CURRICULOS=$(curl -s -X GET "$API_BASE_URL/api/v1/candidatos/curriculos" \
  -H "Authorization: Bearer $TOKEN")

echo -e "\n${BLUE}📊 Lista de currículos:${NC}"
echo $CURRICULOS | jq -r '.[] | "  \(if .principal then "⭐ PRINCIPAL" else "   secundário" end) - \(.titulo) (\(.id[0:8])...)"'

PRINCIPAIS=$(echo $CURRICULOS | jq '[.[] | select(.principal == true)] | length')

echo -e "\nTotal de currículos: $(echo $CURRICULOS | jq 'length')"
echo "Currículos principais: $PRINCIPAIS"

if [ "$PRINCIPAIS" = "1" ]; then
  echo -e "${GREEN}✅ PASSOU: Exatamente 1 currículo principal${NC}"
else
  echo -e "${RED}❌ FALHOU: $PRINCIPAIS currículos principais (esperado: 1)${NC}"
fi

# 6. Resumo final
echo -e "\n================================================================================"
echo -e "${BLUE}📊 RESUMO DOS TESTES${NC}"
echo "================================================================================"

CURRICULOS_FINAIS=$(curl -s -X GET "$API_BASE_URL/api/v1/candidatos/curriculos" \
  -H "Authorization: Bearer $TOKEN")

echo "Total de currículos: $(echo $CURRICULOS_FINAIS | jq 'length')"
echo "Currículos principais: $(echo $CURRICULOS_FINAIS | jq '[.[] | select(.principal == true)] | length')"

echo -e "\n================================================================================"
echo -e "${GREEN}✅ TESTES CONCLUÍDOS${NC}"
echo "================================================================================\n"

