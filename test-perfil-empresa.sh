#!/bin/bash

# Script de teste para validar correções do perfil de empresa
# Testa: PUT /perfil -> GET /perfil (deve retornar dados corretamente)

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api/v1/usuarios"

CNPJ="98765432000110"
SENHA="Empresa@123"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTE: Atualização e Leitura de Perfil de Empresa"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. LOGIN
echo "1️⃣  Fazendo login com CNPJ: $CNPJ"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/login" \
  -H "Content-Type: application/json" \
  -d "{\"documento\":\"$CNPJ\",\"senha\":\"$SENHA\",\"rememberMe\":false}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ ERRO: Login falhou"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login realizado com sucesso"
echo ""

# 2. GET PERFIL ANTES DA ATUALIZAÇÃO
echo "2️⃣  Obtendo perfil ANTES da atualização..."
GET_BEFORE=$(curl -s -X GET "${API_URL}/perfil" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "📊 Perfil ANTES:"
echo "$GET_BEFORE" | jq '{
  telefone: .usuario.telefone,
  genero: .usuario.genero,
  dataNasc: .usuario.dataNasc,
  descricao: .usuario.descricao,
  endereco: .usuario.endereco
}' 2>/dev/null || echo "$GET_BEFORE"
echo ""

# 3. PUT PERFIL - ATUALIZAR DADOS
echo "3️⃣  Atualizando perfil (PUT /perfil)..."
UPDATE_PAYLOAD='{
  "telefone": "11987654322",
  "genero": "NAO_INFORMAR",
  "dataNasc": "1990-05-15",
  "descricao": "Consultoria em recursos humanos - TESTE ATUALIZADO",
  "endereco": {
    "logradouro": "Rua Teste Atualização",
    "numero": "123",
    "bairro": "Centro",
    "cidade": "Rio de Janeiro",
    "estado": "RJ",
    "cep": "20040020"
  }
}'

PUT_RESPONSE=$(curl -s -X PUT "${API_URL}/perfil" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_PAYLOAD")

SUCCESS=$(echo "$PUT_RESPONSE" | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$SUCCESS" != "true" ]; then
  echo "❌ ERRO: Atualização falhou"
  echo "$PUT_RESPONSE" | jq '.' 2>/dev/null || echo "$PUT_RESPONSE"
  exit 1
fi

echo "✅ Perfil atualizado com sucesso"
echo "📤 Resposta do PUT:"
echo "$PUT_RESPONSE" | jq '{
  success: .success,
  telefone: .usuario.telefone,
  genero: .usuario.genero,
  dataNasc: .usuario.dataNasc,
  descricao: .usuario.descricao,
  endereco: .usuario.endereco
}' 2>/dev/null || echo "$PUT_RESPONSE"
echo ""

# Aguardar 1 segundo para garantir que o cache foi invalidado
sleep 1

# 4. GET PERFIL DEPOIS DA ATUALIZAÇÃO
echo "4️⃣  Obtendo perfil DEPOIS da atualização (validando se dados foram retornados)..."
GET_AFTER=$(curl -s -X GET "${API_URL}/perfil" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "📊 Perfil DEPOIS:"
echo "$GET_AFTER" | jq '{
  telefone: .usuario.telefone,
  genero: .usuario.genero,
  dataNasc: .usuario.dataNasc,
  descricao: .usuario.descricao,
  endereco: .usuario.endereco
}' 2>/dev/null || echo "$GET_AFTER"
echo ""

# 5. VALIDAÇÃO
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 VALIDAÇÃO DOS RESULTADOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TELEFONE=$(echo "$GET_AFTER" | jq -r '.usuario.telefone // "null"' 2>/dev/null)
GENERO=$(echo "$GET_AFTER" | jq -r '.usuario.genero // "null"' 2>/dev/null)
DATA_NASC=$(echo "$GET_AFTER" | jq -r '.usuario.dataNasc // "null"' 2>/dev/null)
DESCRICAO=$(echo "$GET_AFTER" | jq -r '.usuario.descricao // "null"' 2>/dev/null)
ENDERECO_LOG=$(echo "$GET_AFTER" | jq -r '.usuario.endereco.logradouro // "null"' 2>/dev/null)

ERRORS=0

if [ "$TELEFONE" = "null" ] || [ -z "$TELEFONE" ]; then
  echo "❌ FALHOU: telefone está null ou vazio"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ telefone: $TELEFONE"
fi

if [ "$GENERO" = "null" ] || [ -z "$GENERO" ]; then
  echo "❌ FALHOU: genero está null ou vazio"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ genero: $GENERO"
fi

if [ "$DATA_NASC" = "null" ] || [ -z "$DATA_NASC" ]; then
  echo "❌ FALHOU: dataNasc está null ou vazio"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ dataNasc: $DATA_NASC"
fi

if [ "$DESCRICAO" = "null" ] || [ -z "$DESCRICAO" ]; then
  echo "❌ FALHOU: descricao está null ou vazio"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ descricao: $DESCRICAO"
fi

if [ "$ENDERECO_LOG" = "null" ] || [ -z "$ENDERECO_LOG" ]; then
  echo "❌ FALHOU: endereco.logradouro está null ou vazio"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ endereco.logradouro: $ENDERECO_LOG"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ TESTE PASSOU: Todos os campos foram retornados corretamente!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ TESTE FALHOU: $ERRORS campo(s) não foram retornados corretamente"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi



