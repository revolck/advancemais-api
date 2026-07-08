-- AlterTable
ALTER TABLE "EmpresasRecursosPremiumVagas" ALTER COLUMN "atualizadoEm" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WebsitePopupContato" ADD COLUMN     "contactKey" VARCHAR(255),
ADD COLUMN     "removidoEm" TIMESTAMP(3);

UPDATE "WebsitePopupContato"
SET "contactKey" = CASE
  WHEN NULLIF(BTRIM(LOWER("email")), '') IS NOT NULL THEN CONCAT('email:', BTRIM(LOWER("email")))
  WHEN NULLIF(REGEXP_REPLACE(COALESCE("telefone", ''), '\D', '', 'g'), '') IS NOT NULL THEN CONCAT('telefone:', REGEXP_REPLACE(COALESCE("telefone", ''), '\D', '', 'g'))
  WHEN NULLIF(REGEXP_REPLACE(COALESCE("whatsapp", ''), '\D', '', 'g'), '') IS NOT NULL THEN CONCAT('whatsapp:', REGEXP_REPLACE(COALESCE("whatsapp", ''), '\D', '', 'g'))
  ELSE CONCAT('anon:', "id")
END
WHERE "contactKey" IS NULL;

-- CreateIndex
CREATE INDEX "WebsitePopupContato_contactKey_criadoEm_idx" ON "WebsitePopupContato"("contactKey", "criadoEm");

-- CreateIndex
CREATE INDEX "WebsitePopupContato_removidoEm_idx" ON "WebsitePopupContato"("removidoEm");
