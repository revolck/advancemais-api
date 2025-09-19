ALTER TABLE "Vaga" ADD COLUMN "codigo" VARCHAR(6);

UPDATE "Vaga"
SET "codigo" = UPPER(SUBSTRING(MD5("id"::text) FROM 1 FOR 6))
WHERE "codigo" IS NULL;

ALTER TABLE "Vaga" ALTER COLUMN "codigo" SET NOT NULL;

CREATE UNIQUE INDEX "Vaga_codigo_key" ON "Vaga"("codigo");
