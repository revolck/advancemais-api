-- Alter table to support extended vaga metadata
ALTER TABLE "EmpresasVagas"
  ADD COLUMN "slug" VARCHAR(120),
  ADD COLUMN "numeroVagas" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "descricao" TEXT,
  ADD COLUMN "localizacao" JSONB,
  ADD COLUMN "salarioMin" DECIMAL(12, 2),
  ADD COLUMN "salarioMax" DECIMAL(12, 2),
  ADD COLUMN "salarioConfidencial" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "maxCandidaturasPorUsuario" INTEGER;

-- Ensure jornada and senioridade have sensible defaults
ALTER TABLE "EmpresasVagas"
  ALTER COLUMN "jornada" SET DEFAULT 'INTEGRAL',
  ALTER COLUMN "senioridade" SET DEFAULT 'ABERTO';

-- Convert textual content into structured JSON objects
ALTER TABLE "EmpresasVagas"
  ALTER COLUMN "requisitos" TYPE JSONB USING
    CASE
      WHEN "requisitos" IS NULL OR btrim("requisitos") = '' THEN jsonb_build_object('obrigatorios', '[]'::jsonb, 'desejaveis', '[]'::jsonb)
      ELSE jsonb_build_object('obrigatorios', jsonb_build_array(btrim("requisitos")), 'desejaveis', '[]'::jsonb)
    END,
  ALTER COLUMN "atividades" TYPE JSONB USING
    CASE
      WHEN "atividades" IS NULL OR btrim("atividades") = '' THEN jsonb_build_object('principais', '[]'::jsonb, 'extras', '[]'::jsonb)
      ELSE jsonb_build_object('principais', jsonb_build_array(btrim("atividades")), 'extras', '[]'::jsonb)
    END,
  ALTER COLUMN "beneficios" TYPE JSONB USING
    CASE
      WHEN "beneficios" IS NULL OR btrim("beneficios") = '' THEN jsonb_build_object('lista', '[]'::jsonb, 'observacoes', NULL)
      ELSE jsonb_build_object('lista', jsonb_build_array(btrim("beneficios")), 'observacoes', NULL)
    END;

ALTER TABLE "EmpresasVagas"
  ALTER COLUMN "requisitos" SET DEFAULT jsonb_build_object('obrigatorios', '[]'::jsonb, 'desejaveis', '[]'::jsonb),
  ALTER COLUMN "atividades" SET DEFAULT jsonb_build_object('principais', '[]'::jsonb, 'extras', '[]'::jsonb),
  ALTER COLUMN "beneficios" SET DEFAULT jsonb_build_object('lista', '[]'::jsonb, 'observacoes', NULL),
  ALTER COLUMN "requisitos" SET NOT NULL,
  ALTER COLUMN "atividades" SET NOT NULL,
  ALTER COLUMN "beneficios" SET NOT NULL;

-- Populate slug values based on existing titles/codes
WITH base AS (
  SELECT
    id,
    regexp_replace(
      lower(
        coalesce(
          nullif(btrim("titulo"), ''),
          'vaga-' || regexp_replace(lower(coalesce("codigo", substring(id::text, 1, 6))), '[^a-z0-9]+', '-', 'g')
        )
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    ) AS slug_base
  FROM "EmpresasVagas"
),
slugged AS (
  SELECT
    id,
    slug_base,
    slug_base || CASE WHEN rn > 1 THEN '-' || (rn - 1)::text ELSE '' END AS slug
  FROM (
    SELECT
      id,
      slug_base,
      ROW_NUMBER() OVER (PARTITION BY slug_base ORDER BY id) AS rn
    FROM base
  ) ranked
)
UPDATE "EmpresasVagas" ev
SET "slug" = slugged.slug
FROM slugged
WHERE ev.id = slugged.id;

-- Ensure every row has a valid slug
UPDATE "EmpresasVagas"
SET "slug" = 'vaga-' || substring(id::text, 1, 12)
WHERE "slug" IS NULL OR "slug" = '';

-- Final constraints and indexes
ALTER TABLE "EmpresasVagas"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "EmpresasVagas_slug_key" ON "EmpresasVagas" ("slug");

-- Normalize beneficio defaults now that slug is set
ALTER TABLE "EmpresasVagas"
  ALTER COLUMN "numeroVagas" SET DEFAULT 1,
  ALTER COLUMN "salarioConfidencial" SET DEFAULT TRUE;
