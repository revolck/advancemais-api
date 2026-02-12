-- AlterTable
ALTER TABLE "CursosTurmas" ADD COLUMN "editadoPorId" TEXT,
ADD COLUMN "editadoEm" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "CursosTurmas" ADD CONSTRAINT "CursosTurmas_editadoPorId_fkey" FOREIGN KEY ("editadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
