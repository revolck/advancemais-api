BEGIN;

-- Create auxiliary table for user profile information
CREATE TABLE IF NOT EXISTS "UsuariosInformation" (
  "usuarioId" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "genero" TEXT,
  "dataNasc" TIMESTAMP(3),
  "matricula" TEXT,
  "avatarUrl" TEXT,
  "descricao" VARCHAR(500),
  "aceitarTermos" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "UsuariosInformation_pkey" PRIMARY KEY ("usuarioId"),
  CONSTRAINT "UsuariosInformation_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy existing profile data into the new table
INSERT INTO "UsuariosInformation" (
  "usuarioId",
  "telefone",
  "genero",
  "dataNasc",
  "matricula",
  "avatarUrl",
  "descricao",
  "aceitarTermos"
)
SELECT
  "id" AS "usuarioId",
  COALESCE(NULLIF(TRIM("telefone"), ''), '+55 00 0000-0000') AS "telefone",
  "genero",
  "dataNasc",
  "matricula",
  "avatarUrl",
  "descricao",
  COALESCE("aceitarTermos", FALSE)
FROM "Usuarios"
ON CONFLICT ("usuarioId") DO UPDATE
SET
  "telefone" = EXCLUDED."telefone",
  "genero" = EXCLUDED."genero",
  "dataNasc" = EXCLUDED."dataNasc",
  "matricula" = EXCLUDED."matricula",
  "avatarUrl" = EXCLUDED."avatarUrl",
  "descricao" = EXCLUDED."descricao",
  "aceitarTermos" = EXCLUDED."aceitarTermos";

-- Remove legacy columns from Usuarios
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "telefone";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "genero";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "dataNasc";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "matricula";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "avatarUrl";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "descricao";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "aceitarTermos";

COMMIT;
