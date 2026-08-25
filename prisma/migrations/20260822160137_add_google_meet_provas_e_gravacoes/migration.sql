-- AlterTable: CursosTurmasAulas — Google Meet Space API + gravação
ALTER TABLE "CursosTurmasAulas" ADD COLUMN     "meetSpaceName" VARCHAR(255),
ADD COLUMN     "gravacaoDriveFileId" VARCHAR(255);

-- AlterTable: CursosTurmasProvas — Google Meet (somente modalidade AO_VIVO)
ALTER TABLE "CursosTurmasProvas" ADD COLUMN     "urlMeet" VARCHAR(2048),
ADD COLUMN     "meetEventId" VARCHAR(255),
ADD COLUMN     "meetSpaceName" VARCHAR(255),
ADD COLUMN     "linkGravacao" VARCHAR(2048),
ADD COLUMN     "gravacaoDriveFileId" VARCHAR(255),
ADD COLUMN     "statusGravacao" VARCHAR(50);

-- CreateIndex
CREATE INDEX "CursosTurmasAulas_modalidade_dataFim_idx" ON "CursosTurmasAulas"("modalidade", "dataFim");

-- CreateIndex
CREATE INDEX "CursosTurmasProvas_modalidade_dataFim_idx" ON "CursosTurmasProvas"("modalidade", "dataFim");
