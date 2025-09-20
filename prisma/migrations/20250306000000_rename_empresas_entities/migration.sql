BEGIN;

ALTER TABLE "Vagas" RENAME TO "EmpresasVagas";
ALTER TABLE "EmpresaPlano" RENAME TO "EmpresasPlano";
ALTER TABLE "LogPagamento" RENAME COLUMN "empresaPlanoId" TO "empresasPlanoId";
ALTER INDEX "LogPagamento_empresaPlanoId_idx" RENAME TO "LogPagamento_empresasPlanoId_idx";

COMMIT;
