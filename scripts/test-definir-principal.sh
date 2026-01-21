#!/bin/bash

# Script de teste para definir currículo como principal
# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

API_BASE_URL="${API_URL:-http://localhost:3000}"

echo "================================================================================"
echo -e "${BLUE}🧪 TESTE: Definir Currículo como Principal${NC}"
echo "================================================================================"

# 1. Login
echo -e "\n${CYAN}🔐 Fazendo login como João da Silva...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/usuarios/login" \
  -H "Content-Type: application/json" \
  -d '{
    "documento": "12312312312",
    "senha": "Candidato@123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // .data.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Erro no login${NC}"
  echo $LOGIN_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Login realizado com sucesso${NC}"
echo "Token: ${TOKEN:0:50}..."

# 2. Listar currículos existentes
echo -e "\n${CYAN}📋 Listando currículos existentes...${NC}"
CURRICULOS=$(curl -s -X GET "$API_BASE_URL/api/v1/candidatos/curriculos" \
  -H "Authorization: Bearer $TOKEN")

echo -e "\n${BLUE}Currículos encontrados:${NC}"
echo $CURRICULOS | jq -r '.[] | "  \(if .principal then "⭐ PRINCIPAL" else "   secundário" end) - \(.titulo) (ID: \(.id[0:8])...)"'

TOTAL=$(echo $CURRICULOS | jq 'length')
if [ "$TOTAL" -lt 2 ]; then
  echo -e "${YELLOW}⚠️  É necessário ter pelo menos 2 currículos para testar. Criando...${NC}"
  
  # Criar primeiro currículo se não existir
  if [ "$TOTAL" -eq 0 ]; then
    echo -e "${CYAN}Criando primeiro currículo...${NC}"
    CURRICULO1=$(curl -s -X POST "$API_BASE_URL/api/v1/candidatos/curriculos" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "titulo": "Meu Primeiro Currículo",
        "resumo": "Desenvolvedor Full Stack",
        "objetivo": "Busco oportunidades na área de tecnologia"
      }')
    echo -e "${GREEN}✅ Primeiro currículo criado${NC}"
  fi
  
  # Criar segundo currículo
  echo -e "${CYAN}Criando segundo currículo...${NC}"
  CURRICULO2=$(curl -s -X POST "$API_BASE_URL/api/v1/candidatos/curriculos" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "titulo": "Meu Segundo Currículo",
      "resumo": "Desenvolvedor Backend",
      "objetivo": "Foco em APIs e microservices"
    }')
  echo -e "${GREEN}✅ Segundo currículo criado${NC}"
  
  # Recarregar lista
  CURRICULOS=$(curl -s -X GET "$API_BASE_URL/api/v1/candidatos/curriculos" \
    -H "Authorization: Bearer $TOKEN")
fi

# 3. Identificar currículos
PRINCIPAL_ATUAL=$(echo $CURRICULOS | jq -r '.[] | select(.principal == true) | .id')
SECUNDARIO=$(echo $CURRICULOS | jq -r '.[] | select(.principal == false) | .id' | head -1)

if [ -z "$SECUNDARIO" ]; then
  echo -e "${RED}❌ Não foi possível encontrar um currículo secundário para testar${NC}"
  exit 1
fi

PRINCIPAL_TITULO=$(echo $CURRICULOS | jq -r ".[] | select(.id == \"$PRINCIPAL_ATUAL\") | .titulo")
SECUNDARIO_TITULO=$(echo $CURRICULOS | jq -r ".[] | select(.id == \"$SECUNDARIO\") | .titulo")

echo -e "\n${BLUE}📊 Situação atual:${NC}"
echo "  Principal atual: $PRINCIPAL_TITULO ($PRINCIPAL_ATUAL)"
echo "  Vamos definir como principal: $SECUNDARIO_TITULO ($SECUNDARIO)"

# 4. TESTE: Definir currículo secundário como principal
echo -e "\n${BLUE}📝 TESTE: Definir currículo secundário como principal${NC}"
echo "Esperado: O principal atual deve ser desmarcado e o secundário deve virar principal"

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_BASE_URL/api/v1/candidatos/curriculos/$SECUNDARIO/principal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Requisição bem-sucedida (HTTP 200)${NC}"
  
  NOVO_PRINCIPAL=$(echo $BODY | jq -r '.principal')
  NOVO_TITULO=$(echo $BODY | jq -r '.titulo')
  
  if [ "$NOVO_PRINCIPAL" = "true" ]; then
    echo -e "${GREEN}✅ Currículo foi marcado como principal${NC}"
    echo "  Título: $NOVO_TITULO"
  else
    echo -e "${RED}❌ FALHOU: Currículo não foi marcado como principal${NC}"
  fi
else
  echo -e "${RED}❌ Erro na requisição (HTTP $HTTP_CODE)${NC}"
  echo "$BODY" | jq '.'
  exit 1
fi

# 5. Verificar lista atualizada
echo -e "\n${CYAN}🔍 Verificando lista atualizada...${NC}"
CURRICULOS_ATUALIZADOS=$(curl -s -X GET "$API_BASE_URL/api/v1/candidatos/curriculos" \
  -H "Authorization: Bearer $TOKEN")

echo -e "\n${BLUE}📊 Lista após definir principal:${NC}"
echo $CURRICULOS_ATUALIZADOS | jq -r '.[] | "  \(if .principal then "⭐ PRINCIPAL" else "   secundário" end) - \(.titulo) (ID: \(.id[0:8])...)"'

PRINCIPAIS=$(echo $CURRICULOS_ATUALIZADOS | jq '[.[] | select(.principal == true)] | length')
NOVO_PRINCIPAL_ID=$(echo $CURRICULOS_ATUALIZADOS | jq -r '.[] | select(.principal == true) | .id')

echo -e "\nTotal de currículos: $(echo $CURRICULOS_ATUALIZADOS | jq 'length')"
echo "Currículos principais: $PRINCIPAIS"

if [ "$PRINCIPAIS" = "1" ]; then
  echo -e "${GREEN}✅ PASSOU: Exatamente 1 currículo principal${NC}"
else
  echo -e "${RED}❌ FALHOU: $PRINCIPAIS currículos principais (esperado: 1)${NC}"
fi

if [ "$NOVO_PRINCIPAL_ID" = "$SECUNDARIO" ]; then
  echo -e "${GREEN}✅ PASSOU: O currículo correto foi definido como principal${NC}"
else
  echo -e "${RED}❌ FALHOU: O currículo principal não é o esperado${NC}"
  echo "  Esperado: $SECUNDARIO"
  echo "  Obtido: $NOVO_PRINCIPAL_ID"
fi

# 6. Verificar se o anterior foi desmarcado
ANTIGO_PRINCIPAL_AGORA=$(echo $CURRICULOS_ATUALIZADOS | jq -r ".[] | select(.id == \"$PRINCIPAL_ATUAL\") | .principal")

if [ "$ANTIGO_PRINCIPAL_AGORA" = "false" ]; then
  echo -e "${GREEN}✅ PASSOU: O currículo anterior foi desmarcado corretamente${NC}"
else
  echo -e "${RED}❌ FALHOU: O currículo anterior ainda está marcado como principal${NC}"
fi

# 7. TESTE: Tentar definir o mesmo currículo como principal novamente (idempotência)
echo -e "\n${BLUE}📝 TESTE: Idempotência - definir o mesmo currículo como principal novamente${NC}"
echo "Esperado: Deve retornar sucesso sem erro (já é principal)"

RESPONSE2=$(curl -s -w "\n%{http_code}" -X PATCH "$API_BASE_URL/api/v1/candidatos/curriculos/$SECUNDARIO/principal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

HTTP_CODE2=$(echo "$RESPONSE2" | tail -1)
BODY2=$(echo "$RESPONSE2" | head -n -1)

if [ "$HTTP_CODE2" = "200" ]; then
  echo -e "${GREEN}✅ PASSOU: Operação idempotente funcionou (HTTP 200)${NC}"
else
  echo -e "${RED}❌ FALHOU: Deveria retornar 200 mas retornou $HTTP_CODE2${NC}"
fi

# Resumo final
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


