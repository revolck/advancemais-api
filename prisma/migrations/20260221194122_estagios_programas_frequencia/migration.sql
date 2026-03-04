-- CreateEnum
CREATE TYPE "CursosEstagioModoAlocacao" AS ENUM ('TODOS', 'ESPECIFICOS');

-- CreateEnum
CREATE TYPE "CursosEstagioPeriodicidade" AS ENUM ('DIAS_SEMANA', 'INTERVALO');

-- CreateEnum
CREATE TYPE "CursosEstagioProgramaStatus" AS ENUM ('PLANEJADO', 'EM_ANDAMENTO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CursosEstagioGrupoTurno" AS ENUM ('MANHA', 'TARDE', 'NOITE', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "CursosEstagioTipoParticipacao" AS ENUM ('INICIAL', 'RECICLAGEM');

-- CreateEnum
CREATE TYPE "CursosEstagioParticipanteStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'REPROVADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CursosEstagioFrequenciaStatus" AS ENUM ('PRESENTE', 'AUSENTE');

-- AlterTable
ALTER TABLE "CursosTurmasInstrutores" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CursosEstagiosProgramas" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "modoAlocacao" "CursosEstagioModoAlocacao" NOT NULL DEFAULT 'TODOS',
    "periodicidade" "CursosEstagioPeriodicidade" NOT NULL,
    "diasSemana" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "incluirSabados" BOOLEAN NOT NULL DEFAULT false,
    "cargaHorariaMinutos" INTEGER,
    "status" "CursosEstagioProgramaStatus" NOT NULL DEFAULT 'PLANEJADO',
    "criadoPorId" TEXT,
    "atualizadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosEstagiosProgramas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosEstagiosProgramasGrupos" (
    "id" TEXT NOT NULL,
    "estagioId" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "turno" "CursosEstagioGrupoTurno" NOT NULL DEFAULT 'PERSONALIZADO',
    "capacidade" INTEGER,
    "empresaId" TEXT,
    "empresaNome" VARCHAR(255),
    "supervisorNome" VARCHAR(120),
    "contatoSupervisor" VARCHAR(120),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosEstagiosProgramasGrupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosEstagiosProgramasAlunos" (
    "id" TEXT NOT NULL,
    "estagioId" TEXT NOT NULL,
    "grupoId" TEXT,
    "inscricaoId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "tipoParticipacao" "CursosEstagioTipoParticipacao" NOT NULL DEFAULT 'INICIAL',
    "status" "CursosEstagioParticipanteStatus" NOT NULL DEFAULT 'PENDENTE',
    "conclusaoEm" TIMESTAMP(3),
    "validadeAte" TIMESTAMP(3),
    "percentualFrequencia" DECIMAL(5,2),
    "diasObrigatorios" INTEGER NOT NULL DEFAULT 0,
    "diasPresentes" INTEGER NOT NULL DEFAULT 0,
    "diasAusentes" INTEGER NOT NULL DEFAULT 0,
    "criadoPorId" TEXT,
    "atualizadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosEstagiosProgramasAlunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosEstagiosProgramasFrequencias" (
    "id" TEXT NOT NULL,
    "estagioId" TEXT NOT NULL,
    "estagioAlunoId" TEXT NOT NULL,
    "dataReferencia" TIMESTAMP(3) NOT NULL,
    "status" "CursosEstagioFrequenciaStatus" NOT NULL,
    "motivo" VARCHAR(500),
    "lancadoPorId" TEXT,
    "lancadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoPorId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosEstagiosProgramasFrequencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosEstagiosProgramasFrequenciasHistorico" (
    "id" TEXT NOT NULL,
    "estagioId" TEXT NOT NULL,
    "frequenciaId" TEXT NOT NULL,
    "fromStatus" "CursosEstagioFrequenciaStatus",
    "toStatus" "CursosEstagioFrequenciaStatus" NOT NULL,
    "motivo" VARCHAR(500),
    "actorId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "CursosEstagiosProgramasFrequenciasHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramas_cursoId_idx" ON "CursosEstagiosProgramas"("cursoId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramas_turmaId_idx" ON "CursosEstagiosProgramas"("turmaId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramas_status_idx" ON "CursosEstagiosProgramas"("status");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramas_dataInicio_idx" ON "CursosEstagiosProgramas"("dataInicio");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramas_dataFim_idx" ON "CursosEstagiosProgramas"("dataFim");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasGrupos_estagioId_idx" ON "CursosEstagiosProgramasGrupos"("estagioId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasGrupos_empresaId_idx" ON "CursosEstagiosProgramasGrupos"("empresaId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasAlunos_alunoId_idx" ON "CursosEstagiosProgramasAlunos"("alunoId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasAlunos_grupoId_idx" ON "CursosEstagiosProgramasAlunos"("grupoId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasAlunos_status_idx" ON "CursosEstagiosProgramasAlunos"("status");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasAlunos_validadeAte_idx" ON "CursosEstagiosProgramasAlunos"("validadeAte");

-- CreateIndex
CREATE UNIQUE INDEX "CursosEstagiosProgramasAlunos_estagioId_inscricaoId_key" ON "CursosEstagiosProgramasAlunos"("estagioId", "inscricaoId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasFrequencias_estagioId_dataReferencia_idx" ON "CursosEstagiosProgramasFrequencias"("estagioId", "dataReferencia");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasFrequencias_status_idx" ON "CursosEstagiosProgramasFrequencias"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CursosEstagiosProgramasFrequencias_estagioAlunoId_dataRefer_key" ON "CursosEstagiosProgramasFrequencias"("estagioAlunoId", "dataReferencia");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasFrequenciasHistorico_estagioId_idx" ON "CursosEstagiosProgramasFrequenciasHistorico"("estagioId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasFrequenciasHistorico_frequenciaId_idx" ON "CursosEstagiosProgramasFrequenciasHistorico"("frequenciaId");

-- CreateIndex
CREATE INDEX "CursosEstagiosProgramasFrequenciasHistorico_changedAt_idx" ON "CursosEstagiosProgramasFrequenciasHistorico"("changedAt");

-- CreateIndex
CREATE INDEX "cursos_turmas_curso_criadoem_desc_idx" ON "CursosTurmas"("cursoId", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX "cti_turma_criadoem_desc_idx" ON "CursosTurmasInscricoes"("turmaId", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX "cti_turma_status_idx" ON "CursosTurmasInscricoes"("turmaId", "status");

-- CreateIndex
CREATE INDEX "cti_turma_status_pagamento_idx" ON "CursosTurmasInscricoes"("turmaId", "statusPagamento");

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramas" ADD CONSTRAINT "CursosEstagiosProgramas_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramas" ADD CONSTRAINT "CursosEstagiosProgramas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramas" ADD CONSTRAINT "CursosEstagiosProgramas_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramas" ADD CONSTRAINT "CursosEstagiosProgramas_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasGrupos" ADD CONSTRAINT "CursosEstagiosProgramasGrupos_estagioId_fkey" FOREIGN KEY ("estagioId") REFERENCES "CursosEstagiosProgramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasGrupos" ADD CONSTRAINT "CursosEstagiosProgramasGrupos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasAlunos" ADD CONSTRAINT "CursosEstagiosProgramasAlunos_estagioId_fkey" FOREIGN KEY ("estagioId") REFERENCES "CursosEstagiosProgramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasAlunos" ADD CONSTRAINT "CursosEstagiosProgramasAlunos_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "CursosEstagiosProgramasGrupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasAlunos" ADD CONSTRAINT "CursosEstagiosProgramasAlunos_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasAlunos" ADD CONSTRAINT "CursosEstagiosProgramasAlunos_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasAlunos" ADD CONSTRAINT "CursosEstagiosProgramasAlunos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasAlunos" ADD CONSTRAINT "CursosEstagiosProgramasAlunos_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasFrequencias" ADD CONSTRAINT "CursosEstagiosProgramasFrequencias_estagioId_fkey" FOREIGN KEY ("estagioId") REFERENCES "CursosEstagiosProgramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasFrequencias" ADD CONSTRAINT "CursosEstagiosProgramasFrequencias_estagioAlunoId_fkey" FOREIGN KEY ("estagioAlunoId") REFERENCES "CursosEstagiosProgramasAlunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasFrequencias" ADD CONSTRAINT "CursosEstagiosProgramasFrequencias_lancadoPorId_fkey" FOREIGN KEY ("lancadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasFrequencias" ADD CONSTRAINT "CursosEstagiosProgramasFrequencias_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasFrequenciasHistorico" ADD CONSTRAINT "CursosEstagiosProgramasFrequenciasHistorico_estagioId_fkey" FOREIGN KEY ("estagioId") REFERENCES "CursosEstagiosProgramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasFrequenciasHistorico" ADD CONSTRAINT "CursosEstagiosProgramasFrequenciasHistorico_frequenciaId_fkey" FOREIGN KEY ("frequenciaId") REFERENCES "CursosEstagiosProgramasFrequencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosProgramasFrequenciasHistorico" ADD CONSTRAINT "CursosEstagiosProgramasFrequenciasHistorico_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
