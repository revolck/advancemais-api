-- Entrega/devolução por envio do comunicado
ALTER TABLE "ComunicadosEnvios" ADD COLUMN IF NOT EXISTS "entregueEm" TIMESTAMP(3);
ALTER TABLE "ComunicadosEnvios" ADD COLUMN IF NOT EXISTS "devolvidoEm" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ComunicadosEnvios_comunicado_enviadoEm_idx" ON "ComunicadosEnvios"("comunicado", "enviadoEm");
CREATE INDEX IF NOT EXISTS "ComunicadosEnvios_messageId_idx" ON "ComunicadosEnvios"("messageId");

-- Resultado da validação de cada endereço de e-mail
CREATE TABLE IF NOT EXISTS "EmailsValidacoes" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "resultado" VARCHAR(20) NOT NULL,
  "fonte" VARCHAR(20) NOT NULL,
  "motivo" VARCHAR(255),
  "sugestao" VARCHAR(255),
  "tentativas" INTEGER NOT NULL DEFAULT 1,
  "detalhes" JSONB,
  "validadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "proximaTentativaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailsValidacoes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailsValidacoes_email_key" ON "EmailsValidacoes"("email");
CREATE INDEX IF NOT EXISTS "EmailsValidacoes_resultado_idx" ON "EmailsValidacoes"("resultado");
