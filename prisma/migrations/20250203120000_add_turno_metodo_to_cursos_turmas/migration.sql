-- AlterTable
ALTER TABLE "public"."CursosTurmas"
  ADD COLUMN     "turno" "public"."CursosTurnos" NOT NULL DEFAULT 'INTEGRAL',
  ADD COLUMN     "metodo" "public"."CursosMetodos" NOT NULL DEFAULT 'ONLINE';
