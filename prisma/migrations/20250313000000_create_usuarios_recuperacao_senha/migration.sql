BEGIN;

-- Create recovery table
CREATE TABLE IF NOT EXISTS "UsuariosRecuperacaoSenha" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tokenRecuperacao" TEXT,
  "tokenRecuperacaoExp" TIMESTAMP(3),
  "tentativasRecuperacao" INTEGER NOT NULL DEFAULT 0,
  "ultimaTentativaRecuperacao" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsuariosRecuperacaoSenha_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UsuariosRecuperacaoSenha_usuarioId_key" UNIQUE ("usuarioId"),
  CONSTRAINT "UsuariosRecuperacaoSenha_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UsuariosRecuperacaoSenha_tokenRecuperacao_idx"
  ON "UsuariosRecuperacaoSenha"("tokenRecuperacao");

-- Migrate existing recovery data
INSERT INTO "UsuariosRecuperacaoSenha" (
  "id",
  "usuarioId",
  "tokenRecuperacao",
  "tokenRecuperacaoExp",
  "tentativasRecuperacao",
  "ultimaTentativaRecuperacao",
  "criadoEm",
  "atualizadoEm"
)
SELECT
  "id" AS "id",
  "id" AS "usuarioId",
  "tokenRecuperacao",
  "tokenRecuperacaoExp",
  COALESCE("tentativasRecuperacao", 0),
  "ultimaTentativaRecuperacao",
  COALESCE("criadoEm", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "Usuarios"
WHERE "tokenRecuperacao" IS NOT NULL
   OR "tokenRecuperacaoExp" IS NOT NULL
   OR COALESCE("tentativasRecuperacao", 0) <> 0
   OR "ultimaTentativaRecuperacao" IS NOT NULL
ON CONFLICT ("usuarioId") DO NOTHING;

-- Cleanup old indexes
DROP INDEX IF EXISTS "Usuarios_tokenRecuperacao_idx";

-- Drop old columns
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "tokenRecuperacao";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "tokenRecuperacaoExp";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "tentativasRecuperacao";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "ultimaTentativaRecuperacao";

COMMIT;
