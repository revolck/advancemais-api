-- Add soft delete fields for Cursos
ALTER TABLE "Cursos"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" VARCHAR(191);

CREATE INDEX "Cursos_deletedAt_idx" ON "Cursos"("deletedAt");
