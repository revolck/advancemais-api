#!/bin/bash

# Script para testar a API de cursos do candidato
# Uso: ./scripts/test-cursos-candidato.sh [token]

BASE_URL="${BASE_URL:-http://localhost:3000}"
TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
  echo "❌ Erro: Token não fornecido"
  echo "Uso: $0 <token>"
  echo "Ou: TOKEN=<seu_token> $0"
  exit 1
fi

echo "🧪 Testando API de Cursos do Candidato"
echo "======================================"
echo ""

# Teste 1: Listar todos os cursos
echo "📋 Teste 1: Listar todos os cursos (primeira página)"
echo "GET $BASE_URL/api/v1/candidatos/cursos"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/candidatos/cursos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "Status: $http_code"
if [ "$http_code" -eq 200 ]; then
  echo "✅ Sucesso!"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
  echo "❌ Erro!"
  echo "$body"
fi
echo ""

# Teste 2: Filtrar por modalidade ONLINE
echo "📋 Teste 2: Filtrar por modalidade ONLINE"
echo "GET $BASE_URL/api/v1/candidatos/cursos?modalidade=ONLINE"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/candidatos/cursos?modalidade=ONLINE" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "Status: $http_code"
if [ "$http_code" -eq 200 ]; then
  echo "✅ Sucesso!"
  echo "$body" | jq '.data.cursos | length' 2>/dev/null || echo "$body"
else
  echo "❌ Erro!"
  echo "$body"
fi
echo ""

# Teste 3: Filtrar por modalidade AO_VIVO
echo "📋 Teste 3: Filtrar por modalidade AO_VIVO"
echo "GET $BASE_URL/api/v1/candidatos/cursos?modalidade=AO_VIVO"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/candidatos/cursos?modalidade=AO_VIVO" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "Status: $http_code"
if [ "$http_code" -eq 200 ]; then
  echo "✅ Sucesso!"
  echo "$body" | jq '.data.cursos | length' 2>/dev/null || echo "$body"
else
  echo "❌ Erro!"
  echo "$body"
fi
echo ""

# Teste 4: Paginação (segunda página)
echo "📋 Teste 4: Paginação (segunda página)"
echo "GET $BASE_URL/api/v1/candidatos/cursos?page=2&limit=8"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/candidatos/cursos?page=2&limit=8" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "Status: $http_code"
if [ "$http_code" -eq 200 ]; then
  echo "✅ Sucesso!"
  echo "$body" | jq '.data.paginacao' 2>/dev/null || echo "$body"
else
  echo "❌ Erro!"
  echo "$body"
fi
echo ""

# Teste 5: Verificar próxima aula
echo "📋 Teste 5: Verificar se há próxima aula"
echo "GET $BASE_URL/api/v1/candidatos/cursos"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/candidatos/cursos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "Status: $http_code"
if [ "$http_code" -eq 200 ]; then
  echo "✅ Sucesso!"
  proximaAula=$(echo "$body" | jq '.data.proximaAula' 2>/dev/null)
  if [ "$proximaAula" != "null" ] && [ -n "$proximaAula" ]; then
    echo "✅ Próxima aula encontrada:"
    echo "$proximaAula" | jq '.' 2>/dev/null || echo "$proximaAula"
  else
    echo "ℹ️  Nenhuma próxima aula agendada"
  fi
else
  echo "❌ Erro!"
  echo "$body"
fi
echo ""

echo "✅ Testes concluídos!"

