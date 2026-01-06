#!/bin/bash

# Teste detalhado para debug do problema de perfil

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api/v1/usuarios"

CNPJ="98765432000110"
SENHA="Empresa@123"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 DEBUG: Análise Detalhada do Problema de Perfil"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. LOGIN
echo "1️⃣  Login..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/login" \
  -H "Content-Type: application/json" \
  -d "{\"documento\":\"$CNPJ\",\"senha\":\"$SENHA\",\"rememberMe\":false}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ ERRO: Login falhou"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Token obtido"
echo ""

# 2. GET PERFIL INICIAL
echo "2️⃣  GET /perfil (ANTES da atualização) - Estrutura completa:"
GET_BEFORE=$(curl -s -X GET "${API_URL}/perfil" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "$GET_BEFORE" | jq '{
  campos_nivel_raiz: {
    telefone: .usuario.telefone,
    genero: .usuario.genero,
    dataNasc: .usuario.dataNasc,
    descricao: .usuario.descricao
  },
  tem_informacoes: (.usuario | has("informacoes")),
  tem_UsuariosInformation: (.usuario | has("UsuariosInformation")),
  informacoes_object: .usuario.informacoes,
  UsuariosInformation_object: .usuario.UsuariosInformation
}' 2>/dev/null
echo ""

# 3. PUT PERFIL
echo "3️⃣  PUT /perfil - Atualizando dados..."
UPDATE_PAYLOAD='{
  "telefone": "11987654322",
  "genero": "NAO_INFORMAR",
  "dataNasc": "1990-05-15",
  "descricao": "TESTE DEBUG - Consultoria em recursos humanos",
  "endereco": {
    "logradouro": "Rua Debug Teste",
    "numero": "456",
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

echo "📤 Resposta do PUT (campos principais):"
echo "$PUT_RESPONSE" | jq '{
  success: .success,
  campos_retornados: {
    telefone: .usuario.telefone,
    genero: .usuario.genero,
    dataNasc: .usuario.dataNasc,
    descricao: .usuario.descricao,
    endereco: .usuario.endereco
  },
  tem_informacoes: (.usuario | has("informacoes")),
  tem_UsuariosInformation: (.usuario | has("UsuariosInformation"))
}' 2>/dev/null
echo ""

# Aguardar para garantir cache invalidado
echo "⏳ Aguardando 2 segundos para garantir invalidação de cache..."
sleep 2

# 4. GET PERFIL APÓS ATUALIZAÇÃO
echo "4️⃣  GET /perfil (DEPOIS da atualização) - Estrutura completa:"
GET_AFTER=$(curl -s -X GET "${API_URL}/perfil" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "$GET_AFTER" | jq '{
  campos_nivel_raiz: {
    telefone: .usuario.telefone,
    genero: .usuario.genero,
    dataNasc: .usuario.dataNasc,
    descricao: .usuario.descricao,
    endereco: .usuario.endereco
  },
  tem_informacoes: (.usuario | has("informacoes")),
  tem_UsuariosInformation: (.usuario | has("UsuariosInformation")),
  informacoes_object: .usuario.informacoes,
  UsuariosInformation_object: .usuario.UsuariosInformation,
  estrutura_completa_usuario: (.usuario | keys)
}' 2>/dev/null
echo ""

# 5. COMPARAÇÃO
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 COMPARAÇÃO: PUT vs GET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PUT_TELEFONE=$(echo "$PUT_RESPONSE" | jq -r '.usuario.telefone // "null"')
PUT_GENERO=$(echo "$PUT_RESPONSE" | jq -r '.usuario.genero // "null"')
PUT_DATANASC=$(echo "$PUT_RESPONSE" | jq -r '.usuario.dataNasc // "null"')
PUT_DESCRICAO=$(echo "$PUT_RESPONSE" | jq -r '.usuario.descricao // "null"')

GET_TELEFONE=$(echo "$GET_AFTER" | jq -r '.usuario.telefone // "null"')
GET_GENERO=$(echo "$GET_AFTER" | jq -r '.usuario.genero // "null"')
GET_DATANASC=$(echo "$GET_AFTER" | jq -r '.usuario.dataNasc // "null"')
GET_DESCRICAO=$(echo "$GET_AFTER" | jq -r '.usuario.descricao // "null"')

echo "Campo          | PUT (resposta)        | GET (depois)           | Status"
echo "---------------|-----------------------|------------------------|--------"
printf "telefone       | %-21s | %-22s |" "$PUT_TELEFONE" "$GET_TELEFONE"
[ "$PUT_TELEFONE" = "$GET_TELEFONE" ] && echo " ✅" || echo " ❌"
printf "genero         | %-21s | %-22s |" "$PUT_GENERO" "$GET_GENERO"
[ "$PUT_GENERO" = "$GET_GENERO" ] && echo " ✅" || echo " ❌"
printf "dataNasc       | %-21s | %-22s |" "$PUT_DATANASC" "$GET_DATANASC"
[ "$PUT_DATANASC" = "$GET_DATANASC" ] && echo " ✅" || echo " ❌"
printf "descricao      | %-21s | %-22s |" "$(echo "$PUT_DESCRICAO" | cut -c1-21)" "$(echo "$GET_DESCRICAO" | cut -c1-22)"
[ "$PUT_DESCRICAO" = "$GET_DESCRICAO" ] && echo " ✅" || echo " ❌"
echo ""



