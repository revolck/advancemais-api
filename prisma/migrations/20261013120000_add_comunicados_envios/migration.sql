-- Fila/registro de comunicados em massa (ex.: primeiro acesso da nova plataforma)
CREATE TABLE IF NOT EXISTS "ComunicadosEnvios" (
  "id" TEXT NOT NULL,
  "comunicado" VARCHAR(80) NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "provider" VARCHAR(20),
  "messageId" VARCHAR(255),
  "erro" VARCHAR(500),
  "enviadoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComunicadosEnvios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ComunicadosEnvios_comunicado_usuarioId_key" ON "ComunicadosEnvios"("comunicado", "usuarioId");
CREATE INDEX IF NOT EXISTS "ComunicadosEnvios_comunicado_status_idx" ON "ComunicadosEnvios"("comunicado", "status");
ALTER TABLE "ComunicadosEnvios" ADD CONSTRAINT "ComunicadosEnvios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
