CREATE TYPE "WebsiteRecipientListRecalculationStatus" AS ENUM ('IDLE', 'PROCESSING', 'FAILED');

ALTER TABLE "WebsiteRecipientList"
  ADD COLUMN "recalculationStatus" "WebsiteRecipientListRecalculationStatus" NOT NULL DEFAULT 'IDLE',
  ADD COLUMN "recalculationStartedAt" TIMESTAMP(3),
  ADD COLUMN "recalculationFinishedAt" TIMESTAMP(3),
  ADD COLUMN "recalculationError" VARCHAR(500);

CREATE INDEX "WebsiteRecipientList_recalculationStatus_idx"
  ON "WebsiteRecipientList"("recalculationStatus");
