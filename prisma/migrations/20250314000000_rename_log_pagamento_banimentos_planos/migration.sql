-- Alterações de renomeação de tabelas e índices para acompanhar os novos nomes de entidades
ALTER TABLE "LogPagamento" RENAME TO "LogsPagamentosDeAssinaturas";
ALTER INDEX "LogPagamento_pkey" RENAME TO "LogsPagamentosDeAssinaturas_pkey";
ALTER INDEX "LogPagamento_usuarioId_idx" RENAME TO "LogsPagamentosDeAssinaturas_usuarioId_idx";
ALTER INDEX "LogPagamento_empresasPlanoId_idx" RENAME TO "LogsPagamentosDeAssinaturas_empresasPlanoId_idx";
ALTER INDEX "LogPagamento_tipo_idx" RENAME TO "LogsPagamentosDeAssinaturas_tipo_idx";
ALTER INDEX "LogPagamento_criadoEm_idx" RENAME TO "LogsPagamentosDeAssinaturas_criadoEm_idx";

ALTER TABLE "EmpresaBanimento" RENAME TO "EmpresasEmBanimentos";
ALTER INDEX "EmpresaBanimento_pkey" RENAME TO "EmpresasEmBanimentos_pkey";
ALTER INDEX "EmpresaBanimento_usuarioId_idx" RENAME TO "EmpresasEmBanimentos_usuarioId_idx";
ALTER INDEX "EmpresaBanimento_fim_idx" RENAME TO "EmpresasEmBanimentos_fim_idx";
ALTER TABLE "EmpresasEmBanimentos" RENAME CONSTRAINT "EmpresaBanimento_usuarioId_fkey" TO "EmpresasEmBanimentos_usuarioId_fkey";
ALTER TABLE "EmpresasEmBanimentos" RENAME CONSTRAINT "EmpresaBanimento_criadoPorId_fkey" TO "EmpresasEmBanimentos_criadoPorId_fkey";

ALTER TABLE "PlanoEmpresarial" RENAME TO "PlanosEmpresariais";
ALTER INDEX "PlanoEmpresarial_pkey" RENAME TO "PlanosEmpresariais_pkey";
ALTER INDEX "PlanoEmpresarial_mpPreapprovalPlanId_key" RENAME TO "PlanosEmpresariais_mpPreapprovalPlanId_key";
