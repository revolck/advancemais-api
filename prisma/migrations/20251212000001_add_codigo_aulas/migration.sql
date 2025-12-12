-- Migration: Adicionar campo codigo em CursosTurmasAulas
-- Data: 2025-12-12
-- Descrição: Código único para identificação rápida das aulas (ex: AUL-001)

-- 1. Adicionar campo codigo
ALTER TABLE "CursosTurmasAulas"
ADD COLUMN "codigo" VARCHAR(12) NULL;

-- 2. Gerar códigos para aulas existentes (usando subquery)
WITH numbered_aulas AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY "criadoEm") as rn
  FROM "CursosTurmasAulas"
  WHERE "codigo" IS NULL
)
UPDATE "CursosTurmasAulas" AS a
SET "codigo" = 'AUL-' || LPAD(n.rn::TEXT, 6, '0')
FROM numbered_aulas n
WHERE a.id = n.id;

-- 3. Tornar campo obrigatório e único
ALTER TABLE "CursosTurmasAulas"
ALTER COLUMN "codigo" SET NOT NULL;

CREATE UNIQUE INDEX "CursosTurmasAulas_codigo_key" ON "CursosTurmasAulas"("codigo");

-- Comentário
COMMENT ON COLUMN "CursosTurmasAulas"."codigo" IS 'Código único da aula (ex: AUL-000001). Gerado automaticamente.';

