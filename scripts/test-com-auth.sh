#!/bin/bash

# Script de testes completos com autenticação
# Uso: ./scripts/test-com-auth.sh

BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api/v1"

echo "🧪 Testes Completos - Sistema de Cursos e Aulas"
echo "═══════════════════════════════════════════════"
echo ""

# Para testes, você precisa de um token válido
# Opção 1: Fazer login via API
# Opção 2: Usar token existente

echo "⚠️  INSTRUÇÕES:"
echo "1. Faça login no frontend ou via Postman"
echo "2. Copie o token JWT"
echo "3. Execute os comandos abaixo substituindo TOKEN"
echo ""
echo "═══════════════════════════════════════════════"
echo ""

echo "📋 TESTES DISPONÍVEIS:"
echo ""

echo "# 1. Health Check (público)"
echo "curl $BASE_URL/health | jq"
echo ""

echo "# 2. Listar cursos com preços (público)"
echo "curl '$API_URL/cursos?pageSize=3' | jq '.data[] | {nome, valor, valorPromocional, gratuito}'"
echo ""

echo "# 3. Listar aulas (requer auth)"
echo "curl -H 'Authorization: Bearer TOKEN' '$API_URL/cursos/aulas?pageSize=5' | jq"
echo ""

echo "# 4. Criar aula ONLINE (requer auth)"
echo "curl -X POST -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' \\"
echo "  '$API_URL/cursos/aulas' -d '{"
echo "    \"titulo\": \"Teste - Intro Node.js\","
echo "    \"modalidade\": \"ONLINE\","
echo "    \"youtubeUrl\": \"https://youtube.com/watch?v=test\","
echo "    \"turmaId\": \"UUID_TURMA\","
echo "    \"obrigatoria\": true"
echo "  }' | jq"
echo ""

echo "# 5. Buscar agenda (requer auth)"
echo "curl -H 'Authorization: Bearer TOKEN' \\"
echo "  '$API_URL/cursos/agenda?dataInicio=2025-01-01&dataFim=2025-12-31' | jq"
echo ""

echo "# 6. Status Google OAuth (requer auth)"
echo "curl -H 'Authorization: Bearer TOKEN' '$API_URL/auth/google/status' | jq"
echo ""

echo "# 7. Conectar Google (requer auth)"
echo "curl -H 'Authorization: Bearer TOKEN' '$API_URL/auth/google/connect' | jq"
echo ""

echo "═══════════════════════════════════════════════"
echo "✅ Todos os comandos prontos!"
echo "📝 Substitua TOKEN pelo seu token JWT"
echo "═══════════════════════════════════════════════"

