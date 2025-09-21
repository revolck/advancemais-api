-- Add enum and column origin to EmpresasPlano
DO $$ BEGIN
  CREATE TYPE "EmpresasPlanoOrigin" AS ENUM ('CHECKOUT', 'ADMIN', 'IMPORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "EmpresasPlano"
  ADD COLUMN IF NOT EXISTS "origin" "EmpresasPlanoOrigin";

-- Default existing rows to CHECKOUT when null
UPDATE "EmpresasPlano" SET "origin" = 'CHECKOUT' WHERE "origin" IS NULL;

-- Set default at schema level
ALTER TABLE "EmpresasPlano"
  ALTER COLUMN "origin" SET DEFAULT 'CHECKOUT',
  ALTER COLUMN "origin" SET NOT NULL;

