-- Add index to speed up public vagas listing by status and insertion date
CREATE INDEX IF NOT EXISTS "EmpresasVagas_status_inseridaEm_idx"
  ON "EmpresasVagas" ("status", "inseridaEm");

