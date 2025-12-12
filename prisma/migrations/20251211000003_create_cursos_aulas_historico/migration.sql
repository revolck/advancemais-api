-- Migration: Criar tabela CursosAulasHistorico
-- Data: 2025-12-11
-- Descrição: Auditoria completa de todas alterações em aulas

CREATE TABLE "CursosAulasHistorico" (
  "id" VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "aulaId" VARCHAR(36) NOT NULL,
  "usuarioId" VARCHAR(36) NOT NULL,
  "acao" "CursosAcaoHistorico" NOT NULL,
  "camposAlterados" JSONB NULL,
  "turmaId" VARCHAR(36) NULL,
  "ip" VARCHAR(45) NULL,
  "userAgent" VARCHAR(500) NULL,
  "criadoEm" TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Foreign keys
  CONSTRAINT "fk_hist_aula" FOREIGN KEY ("aulaId") 
    REFERENCES "CursosTurmasAulas"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_hist_usuario" FOREIGN KEY ("usuarioId") 
    REFERENCES "Usuarios"("id") ON DELETE CASCADE
);

-- Índices
CREATE INDEX "idx_hist_aula" ON "CursosAulasHistorico"("aulaId");
CREATE INDEX "idx_hist_usuario" ON "CursosAulasHistorico"("usuarioId");
CREATE INDEX "idx_hist_criado" ON "CursosAulasHistorico"("criadoEm");
CREATE INDEX "idx_hist_acao" ON "CursosAulasHistorico"("acao");

-- Comentários
COMMENT ON TABLE "CursosAulasHistorico" IS 'Auditoria de alterações em aulas. Registra quem, quando, o que mudou e de onde (IP/UserAgent).';
COMMENT ON COLUMN "CursosAulasHistorico"."camposAlterados" IS 'JSON com diff dos campos: {campo: {de: "valor1", para: "valor2"}}';

