ALTER TABLE "WebsitePopupLead"
ADD COLUMN "dataNascimento" TIMESTAMP(3);

ALTER TABLE "WebsitePopupLead"
ALTER COLUMN "nome" TYPE VARCHAR(250);
