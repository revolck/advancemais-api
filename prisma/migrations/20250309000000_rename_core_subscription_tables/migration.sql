-- AlterTable
ALTER TABLE "LogPagamento" RENAME TO "LogsPagamentosDeAssinaturas";
ALTER INDEX "LogPagamento_usuarioId_idx" RENAME TO "LogsPagamentosDeAssinaturas_usuarioId_idx";
ALTER INDEX "LogPagamento_empresasPlanoId_idx" RENAME TO "LogsPagamentosDeAssinaturas_empresasPlanoId_idx";
ALTER INDEX "LogPagamento_tipo_idx" RENAME TO "LogsPagamentosDeAssinaturas_tipo_idx";
ALTER INDEX "LogPagamento_criadoEm_idx" RENAME TO "LogsPagamentosDeAssinaturas_criadoEm_idx";

ALTER TABLE "EmpresaBanimento" RENAME TO "EmpresasEmBanimentos";
ALTER INDEX "EmpresaBanimento_usuarioId_idx" RENAME TO "EmpresasEmBanimentos_usuarioId_idx";
ALTER INDEX "EmpresaBanimento_fim_idx" RENAME TO "EmpresasEmBanimentos_fim_idx";

ALTER TABLE "PlanoEmpresarial" RENAME TO "PlanosEmpresariais";
ALTER INDEX "PlanoEmpresarial_mpPreapprovalPlanId_key" RENAME TO "PlanosEmpresariais_mpPreapprovalPlanId_key";

ALTER TABLE "EmpresasPlano" RENAME COLUMN "planoEmpresarialId" TO "planosEmpresariaisId";
ALTER INDEX "EmpresasPlano_planoEmpresarialId_idx" RENAME TO "EmpresasPlano_planosEmpresariaisId_idx";
ALTER TABLE "EmpresasPlano" RENAME CONSTRAINT "EmpresasPlano_planoEmpresarialId_fkey" TO "EmpresasPlano_planosEmpresariaisId_fkey";
