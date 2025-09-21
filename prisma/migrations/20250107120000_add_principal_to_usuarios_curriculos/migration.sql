ALTER TABLE "UsuariosCurriculos"
ADD COLUMN "principal" BOOLEAN NOT NULL DEFAULT false;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "usuarioId" ORDER BY "atualizadoEm" DESC, "criadoEm" DESC) AS row_number
  FROM "UsuariosCurriculos"
)
UPDATE "UsuariosCurriculos" uc
SET "principal" = true
FROM ranked r
WHERE uc.id = r.id
  AND r.row_number = 1;
