ALTER TABLE "Vaga" ADD COLUMN "titulo" VARCHAR(255);

UPDATE "Vaga"
SET "titulo" = 'Título pendente'
WHERE "titulo" IS NULL;

ALTER TABLE "Vaga" ALTER COLUMN "titulo" SET NOT NULL;
