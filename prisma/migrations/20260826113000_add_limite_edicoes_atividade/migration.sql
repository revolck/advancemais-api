ALTER TABLE "CursosTurmasProvasEnvios"
  ADD COLUMN IF NOT EXISTS "tentativasEnvio" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bloqueadoEdicaoEm" TIMESTAMP(3);

UPDATE "CursosTurmasProvasEnvios" AS envio
SET "tentativasEnvio" = 1
WHERE envio."realizadoEm" IS NOT NULL
   OR EXISTS (
     SELECT 1
     FROM "CursosTurmasProvasRespostas" AS resposta
     WHERE resposta."envioId" = envio."id"
   );

UPDATE "CursosTurmasProvasEnvios" AS envio
SET "bloqueadoEdicaoEm" = COALESCE(envio."realizadoEm", envio."atualizadoEm")
WHERE envio."nota" IS NOT NULL
   OR EXISTS (
     SELECT 1
     FROM "CursosTurmasProvasRespostas" AS resposta
     WHERE resposta."envioId" = envio."id"
       AND resposta."corrigida" = TRUE
   );
