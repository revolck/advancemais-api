-- CreateEnum
CREATE TYPE "public"."CursosCertificadosLogAcao" AS ENUM ('EMISSAO', 'VISUALIZACAO');

-- CreateTable
CREATE TABLE "public"."CursosCertificadosEmitidos" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "tipo" "public"."CursosCertificados" NOT NULL,
    "formato" "public"."CursosCertificadosTipos" NOT NULL,
    "cargaHoraria" INTEGER NOT NULL,
    "assinaturaUrl" VARCHAR(2048),
    "alunoNome" VARCHAR(255) NOT NULL,
    "alunoCpf" VARCHAR(14),
    "cursoNome" VARCHAR(255) NOT NULL,
    "turmaNome" VARCHAR(255) NOT NULL,
    "emitidoPorId" TEXT,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" VARCHAR(500),

    CONSTRAINT "CursosCertificadosEmitidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosCertificadosLogs" (
    "id" TEXT NOT NULL,
    "certificadoId" TEXT NOT NULL,
    "acao" "public"."CursosCertificadosLogAcao" NOT NULL,
    "detalhes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosCertificadosLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CursosCertificadosEmitidos_codigo_key" ON "public"."CursosCertificadosEmitidos"("codigo");

-- CreateIndex
CREATE INDEX "CursosCertificadosEmitidos_inscricaoId_idx" ON "public"."CursosCertificadosEmitidos"("inscricaoId");

-- CreateIndex
CREATE INDEX "CursosCertificadosEmitidos_emitidoPorId_idx" ON "public"."CursosCertificadosEmitidos"("emitidoPorId");

-- CreateIndex
CREATE INDEX "CursosCertificadosEmitidos_emitidoEm_idx" ON "public"."CursosCertificadosEmitidos"("emitidoEm");

-- CreateIndex
CREATE INDEX "CursosCertificadosLogs_certificadoId_idx" ON "public"."CursosCertificadosLogs"("certificadoId");

-- CreateIndex
CREATE INDEX "CursosCertificadosLogs_acao_idx" ON "public"."CursosCertificadosLogs"("acao");

-- CreateIndex
CREATE INDEX "CursosCertificadosLogs_criadoEm_idx" ON "public"."CursosCertificadosLogs"("criadoEm");

-- AddForeignKey
ALTER TABLE "public"."CursosCertificadosEmitidos" ADD CONSTRAINT "CursosCertificadosEmitidos_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "public"."CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosCertificadosEmitidos" ADD CONSTRAINT "CursosCertificadosEmitidos_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "public"."Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosCertificadosLogs" ADD CONSTRAINT "CursosCertificadosLogs_certificadoId_fkey" FOREIGN KEY ("certificadoId") REFERENCES "public"."CursosCertificadosEmitidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
