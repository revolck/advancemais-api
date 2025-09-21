-- Adiciona relação entre vagas e áreas/subáreas de interesse
ALTER TABLE "EmpresasVagas"
  ADD COLUMN "areaInteresseId" INTEGER,
  ADD COLUMN "subareaInteresseId" INTEGER;

ALTER TABLE "EmpresasVagas"
  ADD CONSTRAINT "EmpresasVagas_areaInteresseId_fkey"
    FOREIGN KEY ("areaInteresseId") REFERENCES "candidatos_areas_interesse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmpresasVagas"
  ADD CONSTRAINT "EmpresasVagas_subareaInteresseId_fkey"
    FOREIGN KEY ("subareaInteresseId") REFERENCES "candidatos_subareas_interesse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EmpresasVagas_areaInteresseId_idx" ON "EmpresasVagas" ("areaInteresseId");
CREATE INDEX "EmpresasVagas_subareaInteresseId_idx" ON "EmpresasVagas" ("subareaInteresseId");
