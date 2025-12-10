-- Migration: Adicionar campos de aceite de termos, cupom de desconto e sistema de requerimentos
-- Data: 2025-12-03
-- Descrição: 
--   1. Adiciona campos para registrar o aceite de termos de contratação
--   2. Adiciona campos para cupom de desconto aplicado
--   3. Cria sistema de requerimentos (solicitações de usuários)

-- =============================================================================
-- PARTE 1: Aceite de termos de contratação
-- =============================================================================

ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "aceitouTermos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "aceitouTermosEm" TIMESTAMP(3);
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "aceitouTermosIp" VARCHAR(45);
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "aceitouTermosUserAgent" VARCHAR(500);

-- =============================================================================
-- PARTE 2: Cupom de desconto aplicado
-- =============================================================================

ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "cupomDescontoId" TEXT;
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "cupomDescontoCodigo" VARCHAR(40);
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "valorOriginal" DECIMAL(12,2);
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "valorDesconto" DECIMAL(12,2);
ALTER TABLE "EmpresasPlano" ADD COLUMN IF NOT EXISTS "valorFinal" DECIMAL(12,2);

-- Índice para cupom
CREATE INDEX IF NOT EXISTS "EmpresasPlano_cupomDescontoId_idx" ON "EmpresasPlano"("cupomDescontoId");

-- Foreign key para CuponsDesconto
ALTER TABLE "EmpresasPlano" 
ADD CONSTRAINT "EmpresasPlano_cupomDescontoId_fkey" 
FOREIGN KEY ("cupomDescontoId") REFERENCES "CuponsDesconto"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- PARTE 3: Enums para Requerimentos
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE "RequerimentoTipo" AS ENUM (
        'CANCELAMENTO_PLANO',
        'REEMBOLSO',
        'SUPORTE_TECNICO',
        'ALTERACAO_DADOS',
        'DENUNCIA',
        'RECLAMACAO',
        'OUTROS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RequerimentoStatus" AS ENUM (
        'ABERTO',
        'EM_ANALISE',
        'AGUARDANDO_USUARIO',
        'RESOLVIDO',
        'CANCELADO',
        'RECUSADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RequerimentoPrioridade" AS ENUM (
        'BAIXA',
        'MEDIA',
        'ALTA',
        'URGENTE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- PARTE 4: Tabela de Requerimentos
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Requerimentos" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "RequerimentoTipo" NOT NULL,
    "prioridade" "RequerimentoPrioridade" NOT NULL DEFAULT 'MEDIA',
    "status" "RequerimentoStatus" NOT NULL DEFAULT 'ABERTO',
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" TEXT NOT NULL,
    "empresasPlanoId" TEXT,
    "empresasVagaId" TEXT,
    "valorReembolso" DECIMAL(12,2),
    "motivoReembolso" VARCHAR(500),
    "atribuidoParaId" TEXT,
    "respostaAdmin" TEXT,
    "resolvidoEm" TIMESTAMP(3),
    "anexos" JSONB,
    "metadata" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Requerimentos_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "Requerimentos_codigo_key" ON "Requerimentos"("codigo");
CREATE INDEX IF NOT EXISTS "Requerimentos_usuarioId_idx" ON "Requerimentos"("usuarioId");
CREATE INDEX IF NOT EXISTS "Requerimentos_status_idx" ON "Requerimentos"("status");
CREATE INDEX IF NOT EXISTS "Requerimentos_tipo_idx" ON "Requerimentos"("tipo");
CREATE INDEX IF NOT EXISTS "Requerimentos_criadoEm_idx" ON "Requerimentos"("criadoEm");
CREATE INDEX IF NOT EXISTS "Requerimentos_atribuidoParaId_idx" ON "Requerimentos"("atribuidoParaId");
CREATE INDEX IF NOT EXISTS "Requerimentos_empresasPlanoId_idx" ON "Requerimentos"("empresasPlanoId");

-- Foreign keys
ALTER TABLE "Requerimentos" 
ADD CONSTRAINT "Requerimentos_usuarioId_fkey" 
FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Requerimentos" 
ADD CONSTRAINT "Requerimentos_atribuidoParaId_fkey" 
FOREIGN KEY ("atribuidoParaId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Requerimentos" 
ADD CONSTRAINT "Requerimentos_empresasPlanoId_fkey" 
FOREIGN KEY ("empresasPlanoId") REFERENCES "EmpresasPlano"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Requerimentos" 
ADD CONSTRAINT "Requerimentos_empresasVagaId_fkey" 
FOREIGN KEY ("empresasVagaId") REFERENCES "EmpresasVagas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- PARTE 5: Tabela de Histórico de Requerimentos
-- =============================================================================

CREATE TABLE IF NOT EXISTS "RequerimentosHistorico" (
    "id" TEXT NOT NULL,
    "requerimentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "statusAnterior" "RequerimentoStatus",
    "statusNovo" "RequerimentoStatus",
    "acao" VARCHAR(100) NOT NULL,
    "comentario" TEXT,
    "metadata" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequerimentosHistorico_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX IF NOT EXISTS "RequerimentosHistorico_requerimentoId_criadoEm_idx" ON "RequerimentosHistorico"("requerimentoId", "criadoEm");

-- Foreign keys
ALTER TABLE "RequerimentosHistorico" 
ADD CONSTRAINT "RequerimentosHistorico_requerimentoId_fkey" 
FOREIGN KEY ("requerimentoId") REFERENCES "Requerimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequerimentosHistorico" 
ADD CONSTRAINT "RequerimentosHistorico_usuarioId_fkey" 
FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

