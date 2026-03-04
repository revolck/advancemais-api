-- CreateTable
CREATE TABLE "CursosCertificadosConteudoProgramatico" (
    "id" TEXT NOT NULL,
    "certificadoId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosCertificadosConteudoProgramatico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CursosCertificadosConteudoProgramatico_certificadoId_key" ON "CursosCertificadosConteudoProgramatico"("certificadoId");

-- CreateIndex
CREATE INDEX "CursosCertificadosConteudoProgramatico_atualizadoEm_idx" ON "CursosCertificadosConteudoProgramatico"("atualizadoEm");

-- AddForeignKey
ALTER TABLE "CursosCertificadosConteudoProgramatico" ADD CONSTRAINT "CursosCertificadosConteudoProgramatico_certificadoId_fkey" FOREIGN KEY ("certificadoId") REFERENCES "CursosCertificadosEmitidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
