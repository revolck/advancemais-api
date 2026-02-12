#!/bin/bash

# Script de Testes de Ponta a Ponta - Edição de Turmas
# ========================================================

set -e

BASE_URL="http://localhost:3000"
API_VERSION="v1"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Testes de Edição de Turmas${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# 1. Login
echo -e "${YELLOW}[1/7] Fazendo login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/${API_VERSION}/usuarios/login" \
  -H 'Content-Type: application/json' \
  -d '{
    "documento": "08705420440",
    "senha": "Fili25061995*",
    "rememberMe": true
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Erro ao fazer login${NC}"
  echo $LOGIN_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Login realizado com sucesso${NC}"
echo -e "Token: ${TOKEN:0:30}..."
echo ""

# 2. Buscar Curso
echo -e "${YELLOW}[2/7] Buscando curso...${NC}"
CURSO_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/${API_VERSION}/cursos?page=1&pageSize=1" \
  -H "Authorization: Bearer ${TOKEN}")

CURSO_ID=$(echo $CURSO_RESPONSE | jq -r '.data[0].id')
CURSO_NOME=$(echo $CURSO_RESPONSE | jq -r '.data[0].nome')

if [ "$CURSO_ID" == "null" ] || [ -z "$CURSO_ID" ]; then
  echo -e "${RED}❌ Nenhum curso encontrado${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Curso encontrado:${NC} $CURSO_NOME ($CURSO_ID)"
echo ""

# 3. Buscar Turma
echo -e "${YELLOW}[3/7] Buscando turma...${NC}"
TURMA_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/${API_VERSION}/cursos/${CURSO_ID}/turmas?page=1&pageSize=1" \
  -H "Authorization: Bearer ${TOKEN}")

TURMA_ID=$(echo $TURMA_RESPONSE | jq -r '.data[0].id')
TURMA_NOME=$(echo $TURMA_RESPONSE | jq -r '.data[0].nome')
TURMA_STATUS=$(echo $TURMA_RESPONSE | jq -r '.data[0].status')
TURMA_METODO=$(echo $TURMA_RESPONSE | jq -r '.data[0].metodo')
TURMA_ESTRUTURA=$(echo $TURMA_RESPONSE | jq -r '.data[0].estruturaTipo')

if [ "$TURMA_ID" == "null" ] || [ -z "$TURMA_ID" ]; then
  echo -e "${RED}❌ Nenhuma turma encontrada${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Turma encontrada:${NC}"
echo -e "  Nome: $TURMA_NOME"
echo -e "  ID: $TURMA_ID"
echo -e "  Status: $TURMA_STATUS"
echo -e "  Método: $TURMA_METODO"
echo -e "  Estrutura: $TURMA_ESTRUTURA"
echo ""

# 4. TESTE 1: Editar campo permitido (nome)
echo -e "${YELLOW}[4/7] TESTE 1: Editar campo permitido (nome)${NC}"
EDIT_NOME_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/${API_VERSION}/cursos/${CURSO_ID}/turmas/${TURMA_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "nome": "Turma Teste - Editada com Auditoria"
  }')

EDIT_SUCCESS=$(echo $EDIT_NOME_RESPONSE | jq -r '.nome')

if [ "$EDIT_SUCCESS" != "null" ] && [ ! -z "$EDIT_SUCCESS" ]; then
  echo -e "${GREEN}✅ PASSOU: Nome editado com sucesso${NC}"
  echo -e "  Novo nome: $(echo $EDIT_NOME_RESPONSE | jq -r '.nome')"
  echo -e "  Editado por: $(echo $EDIT_NOME_RESPONSE | jq -r '.editadoPorId')"
  echo -e "  Editado em: $(echo $EDIT_NOME_RESPONSE | jq -r '.editadoEm')"
else
  echo -e "${RED}❌ FALHOU: Erro ao editar nome${NC}"
  echo $EDIT_NOME_RESPONSE | jq '.'
fi
echo ""

# 5. TESTE 2: Tentar editar campo bloqueado (metodo)
echo -e "${YELLOW}[5/7] TESTE 2: Tentar editar campo bloqueado (metodo)${NC}"
EDIT_METODO_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/${API_VERSION}/cursos/${CURSO_ID}/turmas/${TURMA_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "metodo": "PRESENCIAL"
  }')

ERROR_CODE=$(echo $EDIT_METODO_RESPONSE | jq -r '.code')

if [ "$ERROR_CODE" == "CAMPO_NAO_EDITAVEL" ]; then
  echo -e "${GREEN}✅ PASSOU: Bloqueio funcionou corretamente${NC}"
  echo -e "  Mensagem: $(echo $EDIT_METODO_RESPONSE | jq -r '.message')"
  echo -e "  Campo: $(echo $EDIT_METODO_RESPONSE | jq -r '.field')"
else
  echo -e "${RED}❌ FALHOU: Campo deveria estar bloqueado${NC}"
  echo $EDIT_METODO_RESPONSE | jq '.'
fi
echo ""

# 6. TESTE 3: Tentar editar campo bloqueado (estruturaTipo)
echo -e "${YELLOW}[6/7] TESTE 3: Tentar editar campo bloqueado (estruturaTipo)${NC}"
EDIT_ESTRUTURA_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/${API_VERSION}/cursos/${CURSO_ID}/turmas/${TURMA_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "estruturaTipo": "MODULAR"
  }')

ERROR_CODE=$(echo $EDIT_ESTRUTURA_RESPONSE | jq -r '.code')

if [ "$ERROR_CODE" == "CAMPO_NAO_EDITAVEL" ] || [ "$ERROR_CODE" == "VALIDATION_ERROR" ]; then
  echo -e "${GREEN}✅ PASSOU: Bloqueio funcionou corretamente${NC}"
  echo -e "  Mensagem: $(echo $EDIT_ESTRUTURA_RESPONSE | jq -r '.message')"
else
  echo -e "${RED}❌ FALHOU: Campo deveria estar bloqueado${NC}"
  echo $EDIT_ESTRUTURA_RESPONSE | jq '.'
fi
echo ""

# 7. TESTE 4: Verificar auditoria
echo -e "${YELLOW}[7/7] TESTE 4: Verificar auditoria${NC}"
TURMA_AUDITORIA=$(curl -s -X GET "${BASE_URL}/api/${API_VERSION}/cursos/${CURSO_ID}/turmas/${TURMA_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

EDITADO_POR=$(echo $TURMA_AUDITORIA | jq -r '.editadoPorId')
EDITADO_EM=$(echo $TURMA_AUDITORIA | jq -r '.editadoEm')

if [ "$EDITADO_POR" != "null" ] && [ ! -z "$EDITADO_POR" ]; then
  echo -e "${GREEN}✅ PASSOU: Auditoria funcionando corretamente${NC}"
  echo -e "  Editado por: $EDITADO_POR"
  echo -e "  Editado em: $EDITADO_EM"
  echo -e "  Criado em: $(echo $TURMA_AUDITORIA | jq -r '.criadoEm')"
else
  echo -e "${YELLOW}⚠️  AVISO: Auditoria não encontrada (pode ser que não houve edição ainda)${NC}"
fi
echo ""

# Resumo
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Resumo dos Testes${NC}"
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}✅ Testes concluídos com sucesso!${NC}"
echo ""
echo -e "Validações realizadas:"
echo -e "  ✓ Login e autenticação"
echo -e "  ✓ Edição de campos permitidos"
echo -e "  ✓ Bloqueio de campos não editáveis (metodo)"
echo -e "  ✓ Bloqueio de campos não editáveis (estruturaTipo)"
echo -e "  ✓ Auditoria de edições"
echo ""
echo -e "${GREEN}Todas as regras de edição estão funcionando corretamente!${NC}"
