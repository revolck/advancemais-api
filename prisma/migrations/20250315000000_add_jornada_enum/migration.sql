-- CreateEnum
CREATE TYPE "Jornadas" AS ENUM ('INTEGRAL', 'MEIO_PERIODO', 'FLEXIVEL', 'TURNOS', 'NOTURNO');

-- AddColumn
ALTER TABLE "empresas_vagas" ADD COLUMN "jornada" "Jornadas" NOT NULL DEFAULT 'INTEGRAL';

-- DropColumn
ALTER TABLE "empresas_vagas" DROP COLUMN "cargaHoraria";

-- Drop default after backfilling new column values
ALTER TABLE "empresas_vagas" ALTER COLUMN "jornada" DROP DEFAULT;
