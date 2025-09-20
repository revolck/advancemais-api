BEGIN;

ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "instagram";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "linkedin";

CREATE TABLE IF NOT EXISTS "UsuariosRedesSociais" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "instagram" TEXT,
  "linkedin" TEXT,
  "facebook" TEXT,
  "youtube" TEXT,
  "twitter" TEXT,
  "tiktok" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsuariosRedesSociais_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UsuariosRedesSociais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UsuariosRedesSociais_usuarioId_key" ON "UsuariosRedesSociais"("usuarioId");
CREATE INDEX IF NOT EXISTS "UsuariosRedesSociais_usuarioId_idx" ON "UsuariosRedesSociais"("usuarioId");

COMMIT;
