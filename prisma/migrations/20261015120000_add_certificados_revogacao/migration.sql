-- Revogação de certificados (aluno que não concluiu): o registro e o código ficam guardados
ALTER TYPE "CursosCertificadosLogAcao" ADD VALUE IF NOT EXISTS 'REVOGACAO';
ALTER TYPE "CursosCertificadosLogAcao" ADD VALUE IF NOT EXISTS 'RESTAURACAO';

ALTER TABLE "CursosCertificadosEmitidos"
  ADD COLUMN IF NOT EXISTS "revogadoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revogadoPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoRevogacao" VARCHAR(500);
