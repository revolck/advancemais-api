-- CreateEnum
CREATE TYPE "public"."WebsiteScriptAplicacao" AS ENUM ('WEBSITE', 'DASHBOARD');

-- AlterTable
ALTER TABLE "public"."WebsiteScript"
  ADD COLUMN "aplicacao" "public"."WebsiteScriptAplicacao" NOT NULL DEFAULT 'WEBSITE';

-- CreateIndex
CREATE INDEX "WebsiteScript_aplicacao_orientacao_status_idx"
  ON "public"."WebsiteScript"("aplicacao", "orientacao", "status");
