-- CreateEnum
CREATE TYPE "CursosEstagioEmpresaVinculoModo" AS ENUM ('CADASTRADA', 'MANUAL');

-- AlterTable
ALTER TABLE "CursosEstagiosProgramas" ADD COLUMN     "diasObrigatorios" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "empresaCnpj" VARCHAR(20),
ADD COLUMN     "empresaEmail" VARCHAR(255),
ADD COLUMN     "empresaEndereco" JSONB,
ADD COLUMN     "empresaId" TEXT,
ADD COLUMN     "empresaNome" VARCHAR(255),
ADD COLUMN     "empresaTelefone" VARCHAR(20),
ADD COLUMN     "empresaVinculoModo" "CursosEstagioEmpresaVinculoModo",
ADD COLUMN     "horarioPadraoFim" VARCHAR(5),
ADD COLUMN     "horarioPadraoInicio" VARCHAR(5),
ADD COLUMN     "usarGrupos" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CursosEstagiosProgramasGrupos" ADD COLUMN     "horaFim" VARCHAR(5),
ADD COLUMN     "horaInicio" VARCHAR(5);

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramas_usarGrupos_idx" ON "CursosEstagiosProgramas"("usarGrupos");
