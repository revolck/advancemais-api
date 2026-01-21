#!/bin/bash

# Teste para verificar se os dados estão sendo salvos no banco

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api/v1/usuarios"

CNPJ="98765432000110"
SENHA="Empresa@123"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 TESTE: Verificando Salvamento no Banco"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. LOGIN
TOKEN=$(curl -s -X POST "${API_URL}/login" \
  -H "Content-Type: application/json" \
  -d "{\"documento\":\"$CNPJ\",\"senha\":\"$SENHA\",\"rememberMe\":false}" \
  | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ ERRO: Login falhou"
  exit 1
fi

echo "✅ Login realizado"
echo ""

# 2. GET INICIAL
echo "📊 Estado INICIAL do perfil:"
GET_INITIAL=$(curl -s -X GET "${API_URL}/perfil" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "$GET_INITIAL" | jq '{
  telefone: .usuario.telefone,
  genero: .usuario.genero,
  dataNasc: .usuario.dataNasc,
  descricao: .usuario.descricao
}' 2>/dev/null
echo ""

# 3. PUT - ATUALIZAR
echo "✏️  Atualizando perfil..."
UPDATE_PAYLOAD='{
  "telefone": "11987654322",
  "genero": "NAO_INFORMAR",
  "dataNasc": "1990-05-15",
  "descricao": "DESCRICAO TESTE SALVAMENTO - Consultoria em recursos humanos"
}'

PUT_RESPONSE=$(curl -s -X PUT "${API_URL}/perfil" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_PAYLOAD")

echo "📤 Resposta do PUT:"
echo "$PUT_RESPONSE" | jq '{
  success: .success,
  campos: {
    telefone: .usuario.telefone,
    genero: .usuario.genero,
    dataNasc: .usuario.dataNasc,
    descricao: .usuario.descricao
  }
}' 2>/dev/null
echo ""

# Aguardar para garantir que a transação foi commitada
sleep 3

# 4. GET APÓS ATUALIZAÇÃO - FORÇAR BUSCA DO BANCO (invalidar cache fazendo 2 requisições)
echo "🔄 Invalidando cache (fazendo 2 requisições rápidas)..."
curl -s -X GET "${API_URL}/perfil" -H "Authorization: Bearer $TOKEN" > /dev/null
sleep 1

echo "📊 Estado FINAL do perfil (após atualização):"
GET_FINAL=$(curl -s -X GET "${API_URL}/perfil" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "$GET_FINAL" | jq '{
  telefone: .usuario.telefone,
  genero: .usuario.genero,
  dataNasc: .usuario.dataNasc,
  descricao: .usuario.descricao,
  endereco: .usuario.endereco
}' 2>/dev/null
echo ""

# 5. COMPARAÇÃO
PUT_GENERO=$(echo "$PUT_RESPONSE" | jq -r '.usuario.genero // "null"')
PUT_DATANASC=$(echo "$PUT_RESPONSE" | jq -r '.usuario.dataNasc // "null"')
PUT_DESCRICAO=$(echo "$PUT_RESPONSE" | jq -r '.usuario.descricao // "null"')

GET_GENERO=$(echo "$GET_FINAL" | jq -r '.usuario.genero // "null"')
GET_DATANASC=$(echo "$GET_FINAL" | jq -r '.usuario.dataNasc // "null"')
GET_DESCRICAO=$(echo "$GET_FINAL" | jq -r '.usuario.descricao // "null"')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 COMPARAÇÃO FINAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Campo       | PUT retornou           | GET retornou            | Status"
echo "------------|------------------------|-------------------------|--------"
printf "genero      | %-22s | %-23s |" "$PUT_GENERO" "$GET_GENERO"
[ "$PUT_GENERO" = "$GET_GENERO" ] && echo " ✅" || echo " ❌ DIFERENTE"
printf "dataNasc    | %-22s | %-23s |" "$(echo "$PUT_DATANASC" | cut -c1-22)" "$(echo "$GET_DATANASC" | cut -c1-23)"
[ "$PUT_DATANASC" = "$GET_DATANASC" ] && echo " ✅" || echo " ❌ DIFERENTE"
printf "descricao   | %-22s | %-23s |" "$(echo "$PUT_DESCRICAO" | cut -c1-22)" "$(echo "$GET_DESCRICAO" | cut -c1-23)"
[ "$PUT_DESCRICAO" = "$GET_DESCRICAO" ] && echo " ✅" || echo " ❌ DIFERENTE"
echo ""

if [ "$PUT_GENERO" != "$GET_GENERO" ] || [ "$PUT_DATANASC" != "$GET_DATANASC" ] || [ "$PUT_DESCRICAO" != "$GET_DESCRICAO" ]; then
  echo "❌ PROBLEMA IDENTIFICADO: Dados retornados pelo PUT não estão sendo retornados pelo GET"
  echo "   Isso indica que o problema está no GET, não no salvamento."
  exit 1
else
  echo "✅ TESTE PASSOU: Todos os dados foram retornados corretamente!"
  exit 0
fi










