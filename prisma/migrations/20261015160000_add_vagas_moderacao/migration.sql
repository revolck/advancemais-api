-- Moderação da vaga em campos próprios: antes o motivo da rejeição (e a observação da
-- aprovação) era gravado por cima das "observações" escritas pela empresa.
ALTER TABLE "EmpresasVagas"
  ADD COLUMN IF NOT EXISTS "motivoRejeicao" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "observacoesAprovacao" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "moderadaEm" TIMESTAMP(3);
