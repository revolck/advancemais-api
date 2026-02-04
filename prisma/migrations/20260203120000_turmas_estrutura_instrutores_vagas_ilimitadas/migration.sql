-- Add estruturaTipo + vagasIlimitadas to CursosTurmas and create join table for multiple instrutores

-- Ensure UUID generation function exists (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "CursosTurmaEstruturaTipo" AS ENUM ('MODULAR', 'DINAMICA', 'PADRAO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CursosTurmas"
  ADD COLUMN IF NOT EXISTS "estruturaTipo" "CursosTurmaEstruturaTipo" NOT NULL DEFAULT 'PADRAO';

ALTER TABLE "CursosTurmas"
  ADD COLUMN IF NOT EXISTS "vagasIlimitadas" BOOLEAN NOT NULL DEFAULT false;

-- Compatibilidade: versões anteriores usavam vagasTotais=0 para indicar ilimitado
UPDATE "CursosTurmas"
SET "vagasIlimitadas" = true
WHERE "vagasTotais" = 0;

CREATE TABLE IF NOT EXISTS "CursosTurmasInstrutores" (
  -- IDs da base atual são TEXT (UUID em string), então manter compatível
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "turmaId" TEXT NOT NULL,
  "instrutorId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CursosTurmasInstrutores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CursosTurmasInstrutores_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CursosTurmasInstrutores_instrutorId_fkey" FOREIGN KEY ("instrutorId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$ BEGIN
  ALTER TABLE "CursosTurmasInstrutores"
    ADD CONSTRAINT "CursosTurmasInstrutores_turmaId_instrutorId_key" UNIQUE ("turmaId", "instrutorId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CursosTurmasInstrutores_turmaId_idx" ON "CursosTurmasInstrutores"("turmaId");
CREATE INDEX IF NOT EXISTS "CursosTurmasInstrutores_instrutorId_idx" ON "CursosTurmasInstrutores"("instrutorId");
