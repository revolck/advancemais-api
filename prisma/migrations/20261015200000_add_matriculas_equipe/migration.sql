-- Matrícula pela equipe e remoção que preserva o histórico (só acréscimos)
ALTER TABLE "CursosTurmasInscricoes"
  ADD COLUMN IF NOT EXISTS "origem" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "adicionadaPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "removidaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removidaPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoRemocao" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "statusAntesRemocao" "StatusInscricao";

ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'TURMA_MATRICULA_ADICIONADA';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'TURMA_MATRICULA_REMOVIDA';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'TURMA_SITUACAO_ALTERADA';
