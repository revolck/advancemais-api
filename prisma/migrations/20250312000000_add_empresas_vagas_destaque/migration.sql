-- AlterTable
ALTER TABLE "EmpresasVagas" ADD COLUMN     "destaque" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmpresasVagasDestaque" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vagaId" UUID NOT NULL,
    "empresasPlanoId" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ativadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desativadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmpresasVagasDestaque_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EmpresasVagasDestaque_vagaId_key" UNIQUE ("vagaId")
);

-- CreateIndex
CREATE INDEX "EmpresasVagasDestaque_empresasPlanoId_ativo_idx" ON "EmpresasVagasDestaque"("empresasPlanoId", "ativo");

-- AddForeignKey
ALTER TABLE "EmpresasVagasDestaque"
  ADD CONSTRAINT "EmpresasVagasDestaque_vagaId_fkey"
  FOREIGN KEY ("vagaId") REFERENCES "EmpresasVagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagasDestaque"
  ADD CONSTRAINT "EmpresasVagasDestaque_empresasPlanoId_fkey"
  FOREIGN KEY ("empresasPlanoId") REFERENCES "EmpresasPlano"("id") ON DELETE CASCADE ON UPDATE CASCADE;
