-- CreateEnum
CREATE TYPE "public"."CursosNotasTipo" AS ENUM ('PROVA', 'TRABALHO');

-- CreateTable
CREATE TABLE "public"."CursosNotas" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "tipo" "public"."CursosNotasTipo" NOT NULL,
    "provaId" TEXT,
    "referenciaExterna" VARCHAR(120),
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" VARCHAR(1000),
    "nota" DECIMAL(4,1),
    "peso" DECIMAL(5,2),
    "valorMaximo" DECIMAL(4,1),
    "dataReferencia" TIMESTAMP(3),
    "observacoes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosNotas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."CursosNotas" ADD CONSTRAINT "CursosNotas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "public"."CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosNotas" ADD CONSTRAINT "CursosNotas_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "public"."CursosTurmasMatriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosNotas" ADD CONSTRAINT "CursosNotas_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "public"."CursosTurmasProvas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "CursosNotas_matriculaId_provaId_key" ON "public"."CursosNotas"("matriculaId", "provaId");

-- CreateIndex
CREATE INDEX "CursosNotas_turmaId_idx" ON "public"."CursosNotas"("turmaId");

-- CreateIndex
CREATE INDEX "CursosNotas_matriculaId_idx" ON "public"."CursosNotas"("matriculaId");

-- CreateIndex
CREATE INDEX "CursosNotas_tipo_idx" ON "public"."CursosNotas"("tipo");
