ALTER TABLE "public"."CursosCertificadosLogs"
ADD COLUMN "formato" "public"."CursosCertificadosTipos" NOT NULL DEFAULT 'DIGITAL';

UPDATE "public"."CursosCertificadosLogs" AS logs
SET "formato" = certificados."formato"
FROM "public"."CursosCertificadosEmitidos" AS certificados
WHERE logs."certificadoId" = certificados."id";

ALTER TABLE "public"."CursosCertificadosLogs"
ALTER COLUMN "formato" DROP DEFAULT;
