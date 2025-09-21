-- Alter enum StatusDeVagas to include new workflow stages
ALTER TYPE "StatusDeVagas" ADD VALUE 'DESPUBLICADA';
ALTER TYPE "StatusDeVagas" ADD VALUE 'PAUSADA';
ALTER TYPE "StatusDeVagas" ADD VALUE 'ENCERRADA';

-- Create Senioridade enum
CREATE TYPE "Senioridade" AS ENUM (
  'ABERTO',
  'ESTAGIARIO',
  'JUNIOR',
  'PLENO',
  'SENIOR',
  'ESPECIALISTA',
  'LIDER'
);

-- Add senioridade column to EmpresasVagas with default value
ALTER TABLE "EmpresasVagas"
  ADD COLUMN "senioridade" "Senioridade" NOT NULL DEFAULT 'ABERTO';
