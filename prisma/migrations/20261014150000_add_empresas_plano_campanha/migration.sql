-- Bonificação de inauguração e avisos de fim do plano gratuito
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "campanha" VARCHAR(40);
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "bonificacaoExibidaEm" TIMESTAMP(3);
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "lembreteExpiracaoEm" TIMESTAMP(3);
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "expiracaoNotificadaEm" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "EmpresasPlano_campanha_idx" ON "EmpresasPlano"("campanha");
