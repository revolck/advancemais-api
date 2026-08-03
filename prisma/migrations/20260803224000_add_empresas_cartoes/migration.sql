ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "mpCustomerId" VARCHAR(255);

CREATE TABLE IF NOT EXISTS "EmpresasCartoes" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "mpCustomerId" VARCHAR(255) NOT NULL,
  "mpCardId" VARCHAR(255) NOT NULL,
  "ultimos4Digitos" VARCHAR(4) NOT NULL,
  "bandeira" VARCHAR(50) NOT NULL,
  "nomeNoCartao" VARCHAR(255) NOT NULL,
  "mesExpiracao" VARCHAR(2) NOT NULL,
  "anoExpiracao" VARCHAR(4) NOT NULL,
  "isPadrao" BOOLEAN NOT NULL DEFAULT false,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "tipo" VARCHAR(20) NOT NULL DEFAULT 'credito',
  "paymentMethodId" VARCHAR(50),
  "validadoEm" TIMESTAMP(3),
  "falhasConsecutivas" INTEGER NOT NULL DEFAULT 0,
  "ultimaFalhaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmpresasCartoes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "usuarioId" TEXT;
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "mpCustomerId" VARCHAR(255);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "mpCardId" VARCHAR(255);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "ultimos4Digitos" VARCHAR(4);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "bandeira" VARCHAR(50);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "nomeNoCartao" VARCHAR(255);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "mesExpiracao" VARCHAR(2);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "anoExpiracao" VARCHAR(4);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "isPadrao" BOOLEAN DEFAULT false;
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN DEFAULT true;
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "tipo" VARCHAR(20) DEFAULT 'credito';
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "paymentMethodId" VARCHAR(50);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "validadoEm" TIMESTAMP(3);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "falhasConsecutivas" INTEGER DEFAULT 0;
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "ultimaFalhaEm" TIMESTAMP(3);
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "criadoEm" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EmpresasCartoes" ADD COLUMN IF NOT EXISTS "atualizadoEm" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "EmpresasCartoes"
SET
  "isPadrao" = COALESCE("isPadrao", false),
  "ativo" = COALESCE("ativo", true),
  "tipo" = COALESCE("tipo", 'credito'),
  "falhasConsecutivas" = COALESCE("falhasConsecutivas", 0),
  "criadoEm" = COALESCE("criadoEm", CURRENT_TIMESTAMP),
  "atualizadoEm" = COALESCE("atualizadoEm", CURRENT_TIMESTAMP);

ALTER TABLE "EmpresasCartoes" ALTER COLUMN "usuarioId" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "mpCustomerId" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "mpCardId" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "ultimos4Digitos" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "bandeira" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "nomeNoCartao" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "mesExpiracao" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "anoExpiracao" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "isPadrao" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "ativo" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "tipo" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "falhasConsecutivas" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "criadoEm" SET NOT NULL;
ALTER TABLE "EmpresasCartoes" ALTER COLUMN "atualizadoEm" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmpresasCartoes_usuarioId_fkey'
  ) THEN
    ALTER TABLE "EmpresasCartoes"
      ADD CONSTRAINT "EmpresasCartoes_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Usuarios_mpCustomerId_idx" ON "Usuarios"("mpCustomerId");
CREATE INDEX IF NOT EXISTS "EmpresasCartoes_usuarioId_ativo_idx" ON "EmpresasCartoes"("usuarioId", "ativo");
CREATE INDEX IF NOT EXISTS "EmpresasCartoes_usuarioId_isPadrao_idx" ON "EmpresasCartoes"("usuarioId", "isPadrao");
CREATE INDEX IF NOT EXISTS "EmpresasCartoes_mpCustomerId_idx" ON "EmpresasCartoes"("mpCustomerId");
CREATE INDEX IF NOT EXISTS "EmpresasCartoes_mpCardId_idx" ON "EmpresasCartoes"("mpCardId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmpresasCartoes_usuarioId_padrao_ativo_key"
  ON "EmpresasCartoes"("usuarioId")
  WHERE "ativo" = true AND "isPadrao" = true;
