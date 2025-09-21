-- CreateTable
CREATE TABLE "UsuariosSessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuarioId" UUID NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "ip" VARCHAR(45),
    "userAgent" VARCHAR(512),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    CONSTRAINT "UsuariosSessoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosSessoes_refreshToken_key" ON "UsuariosSessoes"("refreshToken");
CREATE INDEX "UsuariosSessoes_usuarioId_rememberMe_idx" ON "UsuariosSessoes"("usuarioId", "rememberMe");
CREATE INDEX "UsuariosSessoes_expiraEm_idx" ON "UsuariosSessoes"("expiraEm");

-- AddForeignKey
ALTER TABLE "UsuariosSessoes"
ADD CONSTRAINT "UsuariosSessoes_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update trigger for updatedAt column
CREATE OR REPLACE FUNCTION set_current_timestamp_updated_at_UsuariosSessoes()
RETURNS TRIGGER AS $$
BEGIN
  NEW."atualizadoEm" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON "UsuariosSessoes"
FOR EACH ROW
EXECUTE PROCEDURE set_current_timestamp_updated_at_UsuariosSessoes();
