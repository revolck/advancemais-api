-- Primeiro acesso com senha provisória: obriga a troca de senha no próximo login.
ALTER TABLE "Usuarios"
  ADD COLUMN IF NOT EXISTS "precisaTrocarSenha" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "senhaProvisoriaEm" TIMESTAMP(3);
