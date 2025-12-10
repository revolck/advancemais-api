-- Script para atualizar cursos existentes com valores de teste
-- Execute este script para adicionar preços aos cursos que já existem no banco

-- Atualizar o curso "Node.js Avançado" (se existir)
UPDATE "Cursos"
SET 
  "valor" = 299.90,
  "valorPromocional" = 249.90,
  "gratuito" = false
WHERE "codigo" = 'NODEJS2025';

-- Atualizar o curso "Introdução à Programação" como gratuito (se existir)
UPDATE "Cursos"
SET 
  "valor" = 0,
  "valorPromocional" = NULL,
  "gratuito" = true
WHERE "codigo" = 'INTRO2025';

-- Atualizar todos os cursos que ainda têm valor = 0 e não são gratuitos
-- Define um valor padrão de R$ 199,90
UPDATE "Cursos"
SET 
  "valor" = 199.90,
  "gratuito" = false
WHERE "valor" = 0 AND "gratuito" = false AND "statusPadrao" = 'PUBLICADO';

-- Verificar resultados
SELECT 
  "codigo",
  "nome",
  "valor",
  "valorPromocional",
  "gratuito",
  "statusPadrao"
FROM "Cursos"
WHERE "statusPadrao" = 'PUBLICADO'
ORDER BY "criadoEm" DESC
LIMIT 10;

