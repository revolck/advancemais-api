ALTER TABLE "WebsitePopupContato"
  ADD COLUMN "popupNome" VARCHAR(100);

UPDATE "WebsitePopupContato" contato
SET "popupNome" = popup."nome"
FROM "WebsitePopup" popup
WHERE contato."popupId" = popup."id"
  AND contato."popupNome" IS NULL;

ALTER TABLE "WebsitePopupContato"
  DROP CONSTRAINT "WebsitePopupContato_popupId_fkey";

ALTER TABLE "WebsitePopupContato"
  ALTER COLUMN "popupId" DROP NOT NULL;

ALTER TABLE "WebsitePopupContato"
  ADD CONSTRAINT "WebsitePopupContato_popupId_fkey"
  FOREIGN KEY ("popupId") REFERENCES "WebsitePopup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
