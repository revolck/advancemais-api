-- Migration: Adicionar índice único para prevenir duplicatas em logs de pagamento
-- Data: 09/12/2025
-- Descrição: Cria índice único composto para evitar duplicatas de logs do mesmo evento

-- Primeiro, remover duplicatas existentes (manter apenas o mais recente de cada grupo)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tipo, "mpResourceId", status, "empresasPlanoId" 
      ORDER BY "criadoEm" DESC
    ) as rn
  FROM "LogsPagamentosDeAssinaturas"
  WHERE "mpResourceId" IS NOT NULL
)
DELETE FROM "LogsPagamentosDeAssinaturas"
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Criar índice único composto
-- Permite apenas 1 log por combinação de tipo + mpResourceId + status + empresasPlanoId
-- Isso previne que o mesmo evento de pagamento seja logado múltiplas vezes
CREATE UNIQUE INDEX IF NOT EXISTS "LogsPagamentosDeAssinaturas_unique_event" 
ON "LogsPagamentosDeAssinaturas" (tipo, "mpResourceId", status, "empresasPlanoId")
WHERE "mpResourceId" IS NOT NULL AND "empresasPlanoId" IS NOT NULL;

-- Criar índice parcial adicional para eventos sem mpResourceId (checkout start, errors, etc)
-- Permite apenas 1 log por combinação de tipo + externalRef + status
CREATE UNIQUE INDEX IF NOT EXISTS "LogsPagamentosDeAssinaturas_unique_checkout_event"
ON "LogsPagamentosDeAssinaturas" (tipo, "externalRef", status)
WHERE "mpResourceId" IS NULL AND "externalRef" IS NOT NULL;



