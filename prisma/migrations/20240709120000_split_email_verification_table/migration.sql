-- CreateTable
CREATE TABLE "UsuariosVerificacaoEmail" (
    "usuarioId" UUID NOT NULL,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificadoEm" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "emailVerificationTokenExp" TIMESTAMP(3),
    "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "ultimaTentativaVerificacao" TIMESTAMP(3),
    CONSTRAINT "UsuariosVerificacaoEmail_pkey" PRIMARY KEY ("usuarioId"),
    CONSTRAINT "UsuariosVerificacaoEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate existing verification data
INSERT INTO "UsuariosVerificacaoEmail" (
    "usuarioId",
    "emailVerificado",
    "emailVerificadoEm",
    "emailVerificationToken",
    "emailVerificationTokenExp",
    "emailVerificationAttempts",
    "ultimaTentativaVerificacao"
)
SELECT
    "id",
    COALESCE("emailVerificado", false),
    "emailVerificadoEm",
    "emailVerificationToken",
    "emailVerificationTokenExp",
    COALESCE("emailVerificationAttempts", 0),
    "ultimaTentativaVerificacao"
FROM "Usuarios";

-- Drop legacy columns from Usuarios
ALTER TABLE "Usuarios" DROP COLUMN "emailVerificado";
ALTER TABLE "Usuarios" DROP COLUMN "emailVerificadoEm";
ALTER TABLE "Usuarios" DROP COLUMN "emailVerificationToken";
ALTER TABLE "Usuarios" DROP COLUMN "emailVerificationTokenExp";
ALTER TABLE "Usuarios" DROP COLUMN "emailVerificationAttempts";
ALTER TABLE "Usuarios" DROP COLUMN "ultimaTentativaVerificacao";

-- Indexes for the new table
CREATE UNIQUE INDEX "UsuariosVerificacaoEmail_emailVerificationToken_key" ON "UsuariosVerificacaoEmail"("emailVerificationToken");
CREATE INDEX "UsuariosVerificacaoEmail_emailVerificationTokenExp_idx" ON "UsuariosVerificacaoEmail"("emailVerificationTokenExp");
