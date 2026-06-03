ALTER TABLE "CursosTurmasInscricoes" ADD COLUMN IF NOT EXISTS "mpOrderId" VARCHAR(255);
CREATE INDEX IF NOT EXISTS "CursosTurmasInscricoes_mpOrderId_idx" ON "CursosTurmasInscricoes"("mpOrderId");
