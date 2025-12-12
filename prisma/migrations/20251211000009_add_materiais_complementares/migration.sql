-- Migration: Criar sistema de materiais complementares para aulas
-- Data: 2025-12-11
-- Descrição: Permite anexar arquivos, links e conteúdo texto às aulas

-- 1. Criar enum TipoMaterial
CREATE TYPE "CursosTipoMaterial" AS ENUM ('ARQUIVO', 'LINK', 'TEXTO');

-- 2. Adicionar campo na aula
ALTER TABLE "CursosTurmasAulas"
ADD COLUMN "apenasMateriaisComplementares" BOOLEAN DEFAULT false NOT NULL;

-- 3. Criar tabela de materiais
CREATE TABLE "CursosAulasMateriais" (
  "id" VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "aulaId" VARCHAR(36) NOT NULL,
  "tipo" "CursosTipoMaterial" NOT NULL,
  "titulo" VARCHAR(255) NOT NULL,
  "descricao" VARCHAR(500) NULL,
  "obrigatorio" BOOLEAN DEFAULT false NOT NULL,
  "ordem" INTEGER DEFAULT 0 NOT NULL,
  -- Para tipo ARQUIVO
  "arquivoUrl" VARCHAR(2048) NULL,
  "arquivoNome" VARCHAR(255) NULL,
  "arquivoTamanho" INTEGER NULL,
  "arquivoMimeType" VARCHAR(100) NULL,
  "arquivoToken" VARCHAR(500) NULL,
  -- Para tipo LINK
  "linkUrl" VARCHAR(2048) NULL,
  -- Para tipo TEXTO
  "conteudoHtml" TEXT NULL,
  -- Auditoria
  "criadoEm" TIMESTAMP DEFAULT NOW() NOT NULL,
  "atualizadoEm" TIMESTAMP DEFAULT NOW() NOT NULL,
  "criadoPorId" VARCHAR(36) NOT NULL,
  
  CONSTRAINT "fk_materiais_aula" FOREIGN KEY ("aulaId") 
    REFERENCES "CursosTurmasAulas"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_materiais_criador" FOREIGN KEY ("criadoPorId") 
    REFERENCES "Usuarios"("id") ON DELETE CASCADE
);

-- Índices
CREATE INDEX "idx_materiais_aula" ON "CursosAulasMateriais"("aulaId");
CREATE INDEX "idx_materiais_tipo" ON "CursosAulasMateriais"("tipo");
CREATE INDEX "idx_materiais_token" ON "CursosAulasMateriais"("arquivoToken") WHERE "arquivoToken" IS NOT NULL;
CREATE INDEX "idx_materiais_ordem" ON "CursosAulasMateriais"("aulaId", "ordem");

-- Comentários
COMMENT ON TABLE "CursosAulasMateriais" IS 'Materiais complementares (arquivos, links, textos) das aulas. Máximo 3 por aula.';
COMMENT ON COLUMN "CursosAulasMateriais"."tipo" IS 'ARQUIVO (upload), LINK (externo), TEXTO (rich text HTML)';
COMMENT ON COLUMN "CursosAulasMateriais"."arquivoToken" IS 'Token único para download seguro (expira em 1h)';
COMMENT ON COLUMN "CursosAulasMateriais"."conteudoHtml" IS 'HTML rico para materiais do tipo TEXTO';
COMMENT ON COLUMN "CursosTurmasAulas"."apenasMateriaisComplementares" IS 'true se aula ONLINE sem YouTube (apenas materiais TEXTO)';

