CREATE TYPE "WebsitePopupLeadStatus" AS ENUM (
  'NOVO',
  'EM_ATENDIMENTO',
  'QUALIFICANDO',
  'QUALIFICADO',
  'CONVERTIDO',
  'PERDIDO',
  'ARQUIVADO'
);

CREATE TYPE "WebsitePopupLeadInterestSource" AS ENUM ('AUTO', 'MANUAL');

CREATE TYPE "WebsitePopupLeadOpportunityStatus" AS ENUM (
  'ABERTA',
  'EM_ANDAMENTO',
  'GANHA',
  'PERDIDA'
);

CREATE TABLE "WebsitePopupLead" (
  "id" TEXT NOT NULL,
  "contactKey" VARCHAR(255) NOT NULL,
  "nome" VARCHAR(160),
  "email" VARCHAR(255),
  "telefone" VARCHAR(30),
  "whatsapp" VARCHAR(30),
  "empresa" VARCHAR(160),
  "idade" INTEGER,
  "endereco" VARCHAR(255),
  "cidade" VARCHAR(120),
  "estado" VARCHAR(80),
  "tag" VARCHAR(80),
  "status" "WebsitePopupLeadStatus" NOT NULL DEFAULT 'NOVO',
  "ownerUsuarioId" TEXT,
  "origemPrincipal" VARCHAR(2048),
  "ultimoPopupId" TEXT,
  "ultimoPopupNome" VARCHAR(100),
  "primeiraCapturaEm" TIMESTAMP(3) NOT NULL,
  "ultimaCapturaEm" TIMESTAMP(3) NOT NULL,
  "removidoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsitePopupLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsitePopupLeadNote" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "autorUsuarioId" TEXT,
  "conteudo" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsitePopupLeadNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsitePopupLeadInterest" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "source" "WebsitePopupLeadInterestSource" NOT NULL DEFAULT 'MANUAL',
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsitePopupLeadInterest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsitePopupLeadOpportunity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "titulo" VARCHAR(160) NOT NULL,
  "status" "WebsitePopupLeadOpportunityStatus" NOT NULL DEFAULT 'ABERTA',
  "valorEsperado" DECIMAL(12,2),
  "closeDate" TIMESTAMP(3),
  "descricao" TEXT,
  "ownerUsuarioId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsitePopupLeadOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsitePopupLead_contactKey_key" ON "WebsitePopupLead"("contactKey");
CREATE INDEX "WebsitePopupLead_email_idx" ON "WebsitePopupLead"("email");
CREATE INDEX "WebsitePopupLead_telefone_idx" ON "WebsitePopupLead"("telefone");
CREATE INDEX "WebsitePopupLead_whatsapp_idx" ON "WebsitePopupLead"("whatsapp");
CREATE INDEX "WebsitePopupLead_status_ultimaCapturaEm_idx" ON "WebsitePopupLead"("status", "ultimaCapturaEm");
CREATE INDEX "WebsitePopupLead_ownerUsuarioId_idx" ON "WebsitePopupLead"("ownerUsuarioId");
CREATE INDEX "WebsitePopupLead_removidoEm_idx" ON "WebsitePopupLead"("removidoEm");

CREATE INDEX "WebsitePopupLeadNote_leadId_criadoEm_idx" ON "WebsitePopupLeadNote"("leadId", "criadoEm");
CREATE INDEX "WebsitePopupLeadNote_autorUsuarioId_idx" ON "WebsitePopupLeadNote"("autorUsuarioId");

CREATE UNIQUE INDEX "WebsitePopupLeadInterest_leadId_label_source_key" ON "WebsitePopupLeadInterest"("leadId", "label", "source");
CREATE INDEX "WebsitePopupLeadInterest_leadId_criadoEm_idx" ON "WebsitePopupLeadInterest"("leadId", "criadoEm");

CREATE INDEX "WebsitePopupLeadOpportunity_leadId_status_idx" ON "WebsitePopupLeadOpportunity"("leadId", "status");
CREATE INDEX "WebsitePopupLeadOpportunity_ownerUsuarioId_idx" ON "WebsitePopupLeadOpportunity"("ownerUsuarioId");

ALTER TABLE "WebsitePopupLead"
  ADD CONSTRAINT "WebsitePopupLead_ownerUsuarioId_fkey"
  FOREIGN KEY ("ownerUsuarioId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsitePopupLead"
  ADD CONSTRAINT "WebsitePopupLead_ultimoPopupId_fkey"
  FOREIGN KEY ("ultimoPopupId") REFERENCES "WebsitePopup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsitePopupLeadNote"
  ADD CONSTRAINT "WebsitePopupLeadNote_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "WebsitePopupLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsitePopupLeadNote"
  ADD CONSTRAINT "WebsitePopupLeadNote_autorUsuarioId_fkey"
  FOREIGN KEY ("autorUsuarioId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsitePopupLeadInterest"
  ADD CONSTRAINT "WebsitePopupLeadInterest_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "WebsitePopupLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsitePopupLeadOpportunity"
  ADD CONSTRAINT "WebsitePopupLeadOpportunity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "WebsitePopupLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsitePopupLeadOpportunity"
  ADD CONSTRAINT "WebsitePopupLeadOpportunity_ownerUsuarioId_fkey"
  FOREIGN KEY ("ownerUsuarioId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "WebsitePopupLead" (
  "id",
  "contactKey",
  "nome",
  "email",
  "telefone",
  "whatsapp",
  "tag",
  "origemPrincipal",
  "ultimoPopupId",
  "ultimoPopupNome",
  "primeiraCapturaEm",
  "ultimaCapturaEm",
  "criadoEm",
  "atualizadoEm"
)
SELECT
  gen_random_uuid(),
  grouped."contactKey",
  grouped."nome",
  grouped."email",
  grouped."telefone",
  grouped."whatsapp",
  grouped."tag",
  grouped."origemPath",
  grouped."popupId",
  grouped."popupNome",
  grouped."primeiraCapturaEm",
  grouped."ultimaCapturaEm",
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT ON (COALESCE(c."contactKey", c."id"))
    COALESCE(c."contactKey", c."id") AS "contactKey",
    FIRST_VALUE(c."nome") OVER w_nonempty_nome AS "nome",
    FIRST_VALUE(c."email") OVER w_nonempty_email AS "email",
    FIRST_VALUE(c."telefone") OVER w_nonempty_telefone AS "telefone",
    FIRST_VALUE(c."whatsapp") OVER w_nonempty_whatsapp AS "whatsapp",
    FIRST_VALUE(c."tag") OVER w_nonempty_tag AS "tag",
    FIRST_VALUE(c."origemPath") OVER w_nonempty_origem AS "origemPath",
    FIRST_VALUE(c."popupId") OVER w_latest AS "popupId",
    FIRST_VALUE(c."popupNome") OVER w_latest AS "popupNome",
    MIN(c."criadoEm") OVER w_group AS "primeiraCapturaEm",
    MAX(c."criadoEm") OVER w_group AS "ultimaCapturaEm"
  FROM "WebsitePopupContato" c
  WHERE c."removidoEm" IS NULL
  WINDOW
    w_group AS (PARTITION BY COALESCE(c."contactKey", c."id")),
    w_latest AS (PARTITION BY COALESCE(c."contactKey", c."id") ORDER BY c."criadoEm" DESC),
    w_nonempty_nome AS (PARTITION BY COALESCE(c."contactKey", c."id") ORDER BY CASE WHEN c."nome" IS NULL OR BTRIM(c."nome") = '' THEN 1 ELSE 0 END, c."criadoEm" DESC),
    w_nonempty_email AS (PARTITION BY COALESCE(c."contactKey", c."id") ORDER BY CASE WHEN c."email" IS NULL OR BTRIM(c."email") = '' THEN 1 ELSE 0 END, c."criadoEm" DESC),
    w_nonempty_telefone AS (PARTITION BY COALESCE(c."contactKey", c."id") ORDER BY CASE WHEN c."telefone" IS NULL OR BTRIM(c."telefone") = '' THEN 1 ELSE 0 END, c."criadoEm" DESC),
    w_nonempty_whatsapp AS (PARTITION BY COALESCE(c."contactKey", c."id") ORDER BY CASE WHEN c."whatsapp" IS NULL OR BTRIM(c."whatsapp") = '' THEN 1 ELSE 0 END, c."criadoEm" DESC),
    w_nonempty_tag AS (PARTITION BY COALESCE(c."contactKey", c."id") ORDER BY CASE WHEN c."tag" IS NULL OR BTRIM(c."tag") = '' THEN 1 ELSE 0 END, c."criadoEm" DESC),
    w_nonempty_origem AS (PARTITION BY COALESCE(c."contactKey", c."id") ORDER BY CASE WHEN c."origemPath" IS NULL OR BTRIM(c."origemPath") = '' THEN 1 ELSE 0 END, c."criadoEm" DESC)
) grouped
ON CONFLICT ("contactKey") DO NOTHING;
