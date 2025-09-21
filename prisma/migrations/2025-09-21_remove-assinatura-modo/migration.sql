-- Migration to remove 'ASSINATURA' from EmpresasPlanoModo and make column nullable
-- 1) Drop default and allow NULLs on column
ALTER TABLE "EmpresasPlano"
  ALTER COLUMN "modo" DROP DEFAULT,
  ALTER COLUMN "modo" DROP NOT NULL;

-- 2) Create a new enum without 'ASSINATURA'
DO $$ BEGIN
  CREATE TYPE "EmpresasPlanoModo_new" AS ENUM ('TESTE', 'PARCEIRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Re-type the column, mapping 'ASSINATURA' to NULL
ALTER TABLE "EmpresasPlano"
  ALTER COLUMN "modo" TYPE "EmpresasPlanoModo_new"
  USING CASE
    WHEN "modo"::text = 'ASSINATURA' THEN NULL
    ELSE "modo"::text::"EmpresasPlanoModo_new"
  END;

-- 4) Swap types: rename old to _old, new to target name
DO $$ BEGIN
  ALTER TYPE "EmpresasPlanoModo" RENAME TO "EmpresasPlanoModo_old";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "EmpresasPlanoModo_new" RENAME TO "EmpresasPlanoModo";
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Clean up old enum type
DO $$ BEGIN
  DROP TYPE IF EXISTS "EmpresasPlanoModo_old";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

