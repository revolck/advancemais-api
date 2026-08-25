-- AlterEnum
ALTER TYPE "NotificacaoTipo" ADD VALUE 'TURMA_FREQUENCIA_ALERTA';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'ALUNO_FREQUENCIA_BAIXA';

-- CreateTable
CREATE TABLE "CursosTurmasFrequenciaCheckpoints" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "checkpoint" INTEGER NOT NULL,
    "processadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosTurmasFrequenciaCheckpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasAlertas" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "checkpoint" INTEGER NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "alunosAfetados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasAlertas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasFrequenciaCheckpoints_turmaId_checkpoint_key" ON "CursosTurmasFrequenciaCheckpoints"("turmaId", "checkpoint");

-- CreateIndex
CREATE INDEX "CursosTurmasFrequenciaCheckpoints_turmaId_idx" ON "CursosTurmasFrequenciaCheckpoints"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasAlertas_token_key" ON "CursosTurmasAlertas"("token");

-- CreateIndex
CREATE INDEX "CursosTurmasAlertas_turmaId_idx" ON "CursosTurmasAlertas"("turmaId");

-- CreateIndex
CREATE INDEX "CursosTurmasAlertas_expiraEm_idx" ON "CursosTurmasAlertas"("expiraEm");

-- AddForeignKey
ALTER TABLE "CursosTurmasFrequenciaCheckpoints" ADD CONSTRAINT "CursosTurmasFrequenciaCheckpoints_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasAlertas" ADD CONSTRAINT "CursosTurmasAlertas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
