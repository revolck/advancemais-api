-- Migration: Adicionar sistema de questões para provas
-- Data: 2025-12-16
-- Motivo: Implementar sistema completo de questões e respostas para provas

-- 1. Adicionar campo valePonto em CursosTurmasProvas
ALTER TABLE "CursosTurmasProvas"
ADD COLUMN IF NOT EXISTS "valePonto" BOOLEAN NOT NULL DEFAULT true;

-- 2. Criar enum CursosTipoQuestao
DO $$ BEGIN
  CREATE TYPE "CursosTipoQuestao" AS ENUM ('TEXTO', 'MULTIPLA_ESCOLHA', 'ANEXO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Criar tabela CursosTurmasProvasQuestoes
CREATE TABLE IF NOT EXISTS "CursosTurmasProvasQuestoes" (
  "id" TEXT NOT NULL,
  "provaId" TEXT NOT NULL,
  "enunciado" VARCHAR(2000) NOT NULL,
  "tipo" "CursosTipoQuestao" NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "peso" DECIMAL(5, 2),
  "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CursosTurmasProvasQuestoes_pkey" PRIMARY KEY ("id")
);

-- 4. Criar tabela CursosTurmasProvasQuestoesAlternativas
CREATE TABLE IF NOT EXISTS "CursosTurmasProvasQuestoesAlternativas" (
  "id" TEXT NOT NULL,
  "questaoId" TEXT NOT NULL,
  "texto" VARCHAR(1000) NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "correta" BOOLEAN NOT NULL DEFAULT false,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CursosTurmasProvasQuestoesAlternativas_pkey" PRIMARY KEY ("id")
);

-- 5. Criar tabela CursosTurmasProvasRespostas
CREATE TABLE IF NOT EXISTS "CursosTurmasProvasRespostas" (
  "id" TEXT NOT NULL,
  "questaoId" TEXT NOT NULL,
  "inscricaoId" TEXT NOT NULL,
  "envioId" TEXT,
  "respostaTexto" TEXT,
  "alternativaId" TEXT,
  "anexoUrl" VARCHAR(500),
  "anexoNome" VARCHAR(255),
  "corrigida" BOOLEAN NOT NULL DEFAULT false,
  "nota" DECIMAL(4, 1),
  "observacoes" VARCHAR(1000),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CursosTurmasProvasRespostas_pkey" PRIMARY KEY ("id")
);

-- 6. Adicionar foreign keys (com verificação de existência)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CursosTurmasProvasQuestoes_provaId_fkey'
  ) THEN
    ALTER TABLE "CursosTurmasProvasQuestoes"
    ADD CONSTRAINT "CursosTurmasProvasQuestoes_provaId_fkey"
    FOREIGN KEY ("provaId") REFERENCES "CursosTurmasProvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CursosTurmasProvasQuestoesAlternativas_questaoId_fkey'
  ) THEN
    ALTER TABLE "CursosTurmasProvasQuestoesAlternativas"
    ADD CONSTRAINT "CursosTurmasProvasQuestoesAlternativas_questaoId_fkey"
    FOREIGN KEY ("questaoId") REFERENCES "CursosTurmasProvasQuestoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CursosTurmasProvasRespostas_questaoId_fkey'
  ) THEN
    ALTER TABLE "CursosTurmasProvasRespostas"
    ADD CONSTRAINT "CursosTurmasProvasRespostas_questaoId_fkey"
    FOREIGN KEY ("questaoId") REFERENCES "CursosTurmasProvasQuestoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CursosTurmasProvasRespostas_alternativaId_fkey'
  ) THEN
    ALTER TABLE "CursosTurmasProvasRespostas"
    ADD CONSTRAINT "CursosTurmasProvasRespostas_alternativaId_fkey"
    FOREIGN KEY ("alternativaId") REFERENCES "CursosTurmasProvasQuestoesAlternativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CursosTurmasProvasRespostas_inscricaoId_fkey'
  ) THEN
    ALTER TABLE "CursosTurmasProvasRespostas"
    ADD CONSTRAINT "CursosTurmasProvasRespostas_inscricaoId_fkey"
    FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CursosTurmasProvasRespostas_envioId_fkey'
  ) THEN
    ALTER TABLE "CursosTurmasProvasRespostas"
    ADD CONSTRAINT "CursosTurmasProvasRespostas_envioId_fkey"
    FOREIGN KEY ("envioId") REFERENCES "CursosTurmasProvasEnvios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 7. Criar índices
CREATE INDEX IF NOT EXISTS "CursosTurmasProvasQuestoes_provaId_idx" ON "CursosTurmasProvasQuestoes"("provaId");
CREATE INDEX IF NOT EXISTS "CursosTurmasProvasQuestoes_provaId_ordem_idx" ON "CursosTurmasProvasQuestoes"("provaId", "ordem");

CREATE INDEX IF NOT EXISTS "CursosTurmasProvasQuestoesAlternativas_questaoId_idx" ON "CursosTurmasProvasQuestoesAlternativas"("questaoId");
CREATE INDEX IF NOT EXISTS "CursosTurmasProvasQuestoesAlternativas_questaoId_ordem_idx" ON "CursosTurmasProvasQuestoesAlternativas"("questaoId", "ordem");

-- Criar constraint única para questaoId + inscricaoId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CursosTurmasProvasRespostas_questaoId_inscricaoId_key'
  ) THEN
    ALTER TABLE "CursosTurmasProvasRespostas"
    ADD CONSTRAINT "CursosTurmasProvasRespostas_questaoId_inscricaoId_key"
    UNIQUE ("questaoId", "inscricaoId");
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "CursosTurmasProvasRespostas_inscricaoId_idx" ON "CursosTurmasProvasRespostas"("inscricaoId");
CREATE INDEX IF NOT EXISTS "CursosTurmasProvasRespostas_questaoId_idx" ON "CursosTurmasProvasRespostas"("questaoId");
CREATE INDEX IF NOT EXISTS "CursosTurmasProvasRespostas_envioId_idx" ON "CursosTurmasProvasRespostas"("envioId");

-- 8. Comentários
COMMENT ON COLUMN "CursosTurmasProvas"."valePonto" IS 'Indica se a prova vale ponto (usa peso no cálculo da média)';
COMMENT ON COLUMN "CursosTurmasProvasQuestoes"."tipo" IS 'Tipo da questão: TEXTO (resposta livre), MULTIPLA_ESCOLHA (com alternativas), ANEXO (upload de arquivo)';
COMMENT ON COLUMN "CursosTurmasProvasQuestoesAlternativas"."correta" IS 'Indica se esta é a alternativa correta (deve haver exatamente 1 alternativa correta por questão)';
COMMENT ON COLUMN "CursosTurmasProvasRespostas"."respostaTexto" IS 'Resposta para questões do tipo TEXTO';
COMMENT ON COLUMN "CursosTurmasProvasRespostas"."alternativaId" IS 'Alternativa selecionada para questões do tipo MULTIPLA_ESCOLHA';
COMMENT ON COLUMN "CursosTurmasProvasRespostas"."anexoUrl" IS 'URL do anexo para questões do tipo ANEXO';

