-- Migration: Adicionar campos de gravação para aulas ao vivo
-- Data: 2025-12-11
-- Descrição: Permite configurar e armazenar link de gravação das lives

ALTER TABLE "CursosTurmasAulas"
ADD COLUMN "gravarAula" BOOLEAN DEFAULT true,
ADD COLUMN "linkGravacao" VARCHAR(2048) NULL,
ADD COLUMN "duracaoGravacao" INTEGER NULL,
ADD COLUMN "statusGravacao" VARCHAR(50) NULL;

-- Índice para buscar aulas com gravação disponível
CREATE INDEX "idx_aulas_gravacao" ON "CursosTurmasAulas"("statusGravacao") WHERE "statusGravacao" = 'DISPONIVEL';

-- Comentários
COMMENT ON COLUMN "CursosTurmasAulas"."gravarAula" IS 'Se deve gravar a live (apenas AO_VIVO). Default: true';
COMMENT ON COLUMN "CursosTurmasAulas"."linkGravacao" IS 'URL da gravação no Google Drive (preenchido após live)';
COMMENT ON COLUMN "CursosTurmasAulas"."statusGravacao" IS 'Status: PROCESSANDO, DISPONIVEL, ERRO, NAO_GRAVADO';

