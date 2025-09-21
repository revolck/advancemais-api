-- Optional supporting indexes for common filters
CREATE INDEX IF NOT EXISTS "EmpresasVagas_status_modalidade_idx"
  ON "EmpresasVagas" ("status", "modalidade");

CREATE INDEX IF NOT EXISTS "EmpresasVagas_status_regime_idx"
  ON "EmpresasVagas" ("status", "regimeDeTrabalho");

CREATE INDEX IF NOT EXISTS "EmpresasVagas_status_senioridade_idx"
  ON "EmpresasVagas" ("status", "senioridade");

CREATE INDEX IF NOT EXISTS "EmpresasVagas_areaInteresse_idx"
  ON "EmpresasVagas" ("areaInteresseId");

CREATE INDEX IF NOT EXISTS "EmpresasVagas_subareaInteresse_idx"
  ON "EmpresasVagas" ("subareaInteresseId");

