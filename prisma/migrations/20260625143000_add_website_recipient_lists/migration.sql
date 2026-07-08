CREATE TYPE "WebsiteRecipientListStatus" AS ENUM ('ATIVA', 'ARQUIVADA');
CREATE TYPE "WebsiteRecipientListMembershipMode" AS ENUM ('MANUAL', 'DINAMICA', 'HIBRIDA');
CREATE TYPE "WebsiteRecipientListRecipientKind" AS ENUM ('MARKETING_LEAD', 'USUARIO');
CREATE TYPE "WebsiteRecipientListMemberSource" AS ENUM ('RULE', 'MANUAL_INCLUDE');

CREATE TABLE "WebsiteRecipientListFolder" (
  "id" TEXT NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "criadoPorId" TEXT,
  "atualizadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteRecipientListFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteRecipientList" (
  "id" TEXT NOT NULL,
  "nome" VARCHAR(160) NOT NULL,
  "descricao" VARCHAR(500),
  "folderId" TEXT,
  "status" "WebsiteRecipientListStatus" NOT NULL DEFAULT 'ATIVA',
  "membershipMode" "WebsiteRecipientListMembershipMode" NOT NULL DEFAULT 'DINAMICA',
  "rulesConfig" JSONB,
  "manualIncludes" JSONB,
  "manualExcludes" JSONB,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "lastCalculatedAt" TIMESTAMP(3),
  "criadoPorId" TEXT,
  "atualizadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteRecipientList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteRecipientListMember" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "recipientKind" "WebsiteRecipientListRecipientKind" NOT NULL,
  "recipientId" VARCHAR(191) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "nome" VARCHAR(191) NOT NULL,
  "role" "Roles",
  "source" "WebsiteRecipientListMemberSource" NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteRecipientListMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteRecipientListFolder_nome_idx" ON "WebsiteRecipientListFolder"("nome");
CREATE INDEX "WebsiteRecipientListFolder_ordem_idx" ON "WebsiteRecipientListFolder"("ordem");

CREATE INDEX "WebsiteRecipientList_folderId_idx" ON "WebsiteRecipientList"("folderId");
CREATE INDEX "WebsiteRecipientList_status_idx" ON "WebsiteRecipientList"("status");
CREATE INDEX "WebsiteRecipientList_nome_idx" ON "WebsiteRecipientList"("nome");
CREATE INDEX "WebsiteRecipientList_lastCalculatedAt_idx" ON "WebsiteRecipientList"("lastCalculatedAt");
CREATE INDEX "WebsiteRecipientList_criadoPorId_idx" ON "WebsiteRecipientList"("criadoPorId");
CREATE INDEX "WebsiteRecipientList_atualizadoPorId_idx" ON "WebsiteRecipientList"("atualizadoPorId");

CREATE UNIQUE INDEX "WebsiteRecipientListMember_listId_recipientKind_recipientId_key"
  ON "WebsiteRecipientListMember"("listId", "recipientKind", "recipientId");
CREATE INDEX "WebsiteRecipientListMember_listId_source_idx"
  ON "WebsiteRecipientListMember"("listId", "source");
CREATE INDEX "WebsiteRecipientListMember_email_idx"
  ON "WebsiteRecipientListMember"("email");
CREATE INDEX "WebsiteRecipientListMember_role_idx"
  ON "WebsiteRecipientListMember"("role");

ALTER TABLE "WebsiteRecipientListFolder"
  ADD CONSTRAINT "WebsiteRecipientListFolder_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteRecipientListFolder"
  ADD CONSTRAINT "WebsiteRecipientListFolder_atualizadoPorId_fkey"
  FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteRecipientList"
  ADD CONSTRAINT "WebsiteRecipientList_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "WebsiteRecipientListFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteRecipientList"
  ADD CONSTRAINT "WebsiteRecipientList_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteRecipientList"
  ADD CONSTRAINT "WebsiteRecipientList_atualizadoPorId_fkey"
  FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteRecipientListMember"
  ADD CONSTRAINT "WebsiteRecipientListMember_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "WebsiteRecipientList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
