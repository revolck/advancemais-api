-- CreateEnum
CREATE TYPE "WebsitePopupDispositivo" AS ENUM ('AMBOS', 'MOBILE', 'DESKTOP');

-- CreateEnum
CREATE TYPE "WebsitePopupEscopo" AS ENUM ('WEBSITE', 'DASHBOARD', 'AMBOS');

-- CreateEnum
CREATE TYPE "WebsitePopupPosicao" AS ENUM (
  'CENTRO',
  'ESQUERDA_SUPERIOR',
  'DIREITA_SUPERIOR',
  'ESQUERDA_INFERIOR',
  'DIREITA_INFERIOR'
);

-- CreateEnum
CREATE TYPE "WebsitePopupGatilho" AS ENUM (
  'IMEDIATAMENTE',
  'ATRASO',
  'INATIVIDADE',
  'SCROLL',
  'SAIDA',
  'CLIQUE',
  'HOVER'
);

-- CreateEnum
CREATE TYPE "WebsitePopupCronograma" AS ENUM ('EXIBIR_AGORA', 'PERIODO');

-- CreateEnum
CREATE TYPE "WebsitePopupFrequencia" AS ENUM (
  'SEM_LIMITE',
  'UMA_VEZ_POR_SESSAO',
  'UMA_VEZ_A_CADA_HORA',
  'UMA_VEZ_A_CADA_6_HORAS',
  'UMA_VEZ_A_CADA_24_HORAS'
);

-- CreateTable
CREATE TABLE "WebsitePopup" (
  "id" TEXT NOT NULL,
  "nome" VARCHAR(100) NOT NULL,
  "templateSlug" VARCHAR(80),
  "status" "WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
  "dispositivo" "WebsitePopupDispositivo" NOT NULL DEFAULT 'AMBOS',
  "escopo" "WebsitePopupEscopo" NOT NULL DEFAULT 'WEBSITE',
  "posicaoDesktop" "WebsitePopupPosicao" NOT NULL DEFAULT 'CENTRO',
  "posicaoMobile" "WebsitePopupPosicao" NOT NULL DEFAULT 'CENTRO',
  "gatilho" "WebsitePopupGatilho" NOT NULL DEFAULT 'ATRASO',
  "atrasoSegundos" INTEGER NOT NULL DEFAULT 5,
  "inatividadeSegundos" INTEGER,
  "scrollPercentual" INTEGER,
  "seletorAlvo" VARCHAR(255),
  "cronograma" "WebsitePopupCronograma" NOT NULL DEFAULT 'EXIBIR_AGORA',
  "inicioEm" TIMESTAMP(3),
  "fimEm" TIMESTAMP(3),
  "frequencia" "WebsitePopupFrequencia" NOT NULL DEFAULT 'UMA_VEZ_A_CADA_6_HORAS',
  "tag" VARCHAR(80),
  "redirectUrl" VARCHAR(2048),
  "redirectNovaAba" BOOLEAN NOT NULL DEFAULT false,
  "prioridade" INTEGER NOT NULL DEFAULT 0,
  "contentConfig" JSONB NOT NULL,
  "formFields" JSONB NOT NULL,
  "designConfig" JSONB NOT NULL,
  "subscriptionConfig" JSONB,
  "pageRules" JSONB,
  "criadoPorId" TEXT,
  "atualizadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebsitePopup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsitePopupContato" (
  "id" TEXT NOT NULL,
  "popupId" TEXT NOT NULL,
  "usuarioId" TEXT,
  "nome" VARCHAR(160),
  "email" VARCHAR(255),
  "telefone" VARCHAR(30),
  "whatsapp" VARCHAR(30),
  "tag" VARCHAR(80),
  "payload" JSONB NOT NULL,
  "origemPath" VARCHAR(2048),
  "userAgent" VARCHAR(500),
  "ipHash" VARCHAR(96),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebsitePopupContato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsitePopup_status_escopo_dispositivo_idx" ON "WebsitePopup"("status", "escopo", "dispositivo");
CREATE INDEX "WebsitePopup_cronograma_inicioEm_fimEm_idx" ON "WebsitePopup"("cronograma", "inicioEm", "fimEm");
CREATE INDEX "WebsitePopup_prioridade_idx" ON "WebsitePopup"("prioridade");
CREATE INDEX "WebsitePopup_atualizadoEm_idx" ON "WebsitePopup"("atualizadoEm");
CREATE INDEX "WebsitePopup_criadoPorId_idx" ON "WebsitePopup"("criadoPorId");
CREATE INDEX "WebsitePopup_atualizadoPorId_idx" ON "WebsitePopup"("atualizadoPorId");
CREATE INDEX "WebsitePopupContato_popupId_criadoEm_idx" ON "WebsitePopupContato"("popupId", "criadoEm");
CREATE INDEX "WebsitePopupContato_email_idx" ON "WebsitePopupContato"("email");
CREATE INDEX "WebsitePopupContato_criadoEm_idx" ON "WebsitePopupContato"("criadoEm");
CREATE INDEX "WebsitePopupContato_usuarioId_idx" ON "WebsitePopupContato"("usuarioId");

-- AddForeignKey
ALTER TABLE "WebsitePopup"
  ADD CONSTRAINT "WebsitePopup_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsitePopup"
  ADD CONSTRAINT "WebsitePopup_atualizadoPorId_fkey"
  FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsitePopupContato"
  ADD CONSTRAINT "WebsitePopupContato_popupId_fkey"
  FOREIGN KEY ("popupId") REFERENCES "WebsitePopup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsitePopupContato"
  ADD CONSTRAINT "WebsitePopupContato_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
