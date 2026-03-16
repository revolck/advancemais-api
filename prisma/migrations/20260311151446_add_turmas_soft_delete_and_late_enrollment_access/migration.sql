-- AlterTable
ALTER TABLE "CursosTurmas" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" VARCHAR(191);

-- CreateTable
CREATE TABLE "CursosTurmasInscricoesAulasAcesso" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "liberadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disponivelAte" TIMESTAMP(3),
    "origem" VARCHAR(50) NOT NULL DEFAULT 'ENTRADA_TARDIA',
    "criadoPorId" VARCHAR(191),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosTurmasInscricoesAulasAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasInscricoesProvasAcesso" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "provaId" TEXT NOT NULL,
    "liberadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disponivelAte" TIMESTAMP(3),
    "origem" VARCHAR(50) NOT NULL DEFAULT 'ENTRADA_TARDIA',
    "criadoPorId" VARCHAR(191),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosTurmasInscricoesProvasAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CursosTurmasInscricoesAulasAcesso_aulaId_idx" ON "CursosTurmasInscricoesAulasAcesso"("aulaId");

-- CreateIndex
CREATE INDEX "CursosTurmasInscricoesAulasAcesso_disponivelAte_idx" ON "CursosTurmasInscricoesAulasAcesso"("disponivelAte");

-- CreateIndex
CREATE INDEX "CursosTurmasInscricoesAulasAcesso_inscricaoId_liberadoEm_idx" ON "CursosTurmasInscricoesAulasAcesso"("inscricaoId", "liberadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasInscricoesAulasAcesso_inscricaoId_aulaId_key" ON "CursosTurmasInscricoesAulasAcesso"("inscricaoId", "aulaId");

-- CreateIndex
CREATE INDEX "CursosTurmasInscricoesProvasAcesso_disponivelAte_idx" ON "CursosTurmasInscricoesProvasAcesso"("disponivelAte");

-- CreateIndex
CREATE INDEX "CursosTurmasInscricoesProvasAcesso_inscricaoId_liberadoEm_idx" ON "CursosTurmasInscricoesProvasAcesso"("inscricaoId", "liberadoEm");

-- CreateIndex
CREATE INDEX "CursosTurmasInscricoesProvasAcesso_provaId_idx" ON "CursosTurmasInscricoesProvasAcesso"("provaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasInscricoesProvasAcesso_inscricaoId_provaId_key" ON "CursosTurmasInscricoesProvasAcesso"("inscricaoId", "provaId");

-- CreateIndex
CREATE INDEX "CursosTurmas_deletedAt_idx" ON "CursosTurmas"("deletedAt");

-- AddForeignKey
ALTER TABLE "CursosTurmasInscricoesAulasAcesso" ADD CONSTRAINT "CursosTurmasInscricoesAulasAcesso_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasInscricoesAulasAcesso" ADD CONSTRAINT "CursosTurmasInscricoesAulasAcesso_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "CursosTurmasAulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasInscricoesProvasAcesso" ADD CONSTRAINT "CursosTurmasInscricoesProvasAcesso_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasInscricoesProvasAcesso" ADD CONSTRAINT "CursosTurmasInscricoesProvasAcesso_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "CursosTurmasProvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
