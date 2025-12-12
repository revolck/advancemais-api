-- Migration: Adicionar campo instrutorId e tornar turmaId nullable
-- Data: 2025-12-11
-- Descrição: Permite aulas sem turma e vinculação de instrutor

-- 1. Tornar turmaId nullable (aulas podem ficar sem turma)
ALTER TABLE "CursosTurmasAulas"
ALTER COLUMN "turmaId" DROP NOT NULL;

-- 2. Adicionar campo instrutorId
ALTER TABLE "CursosTurmasAulas"
ADD COLUMN "instrutorId" VARCHAR(36) NULL;

-- 3. Criar foreign key para instrutor
ALTER TABLE "CursosTurmasAulas"
ADD CONSTRAINT "fk_aulas_instrutor" 
FOREIGN KEY ("instrutorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL;

-- 4. Criar índice
CREATE INDEX "idx_aulas_instrutor" ON "CursosTurmasAulas"("instrutorId");

-- 5. Criar tabela de histórico de instrutores
CREATE TABLE "AulaInstrutorHistorico" (
  "id" VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "aulaId" VARCHAR(36) NOT NULL,
  "instrutorId" VARCHAR(36) NOT NULL,
  "vinculadoEm" TIMESTAMP NOT NULL,
  "removidoEm" TIMESTAMP DEFAULT NOW() NOT NULL,
  "removidoPorId" VARCHAR(36) NOT NULL,
  "aulaJaAconteceu" BOOLEAN DEFAULT false NOT NULL,
  
  CONSTRAINT "fk_hist_instr_aula" FOREIGN KEY ("aulaId") 
    REFERENCES "CursosTurmasAulas"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_hist_instr_instrutor" FOREIGN KEY ("instrutorId") 
    REFERENCES "Usuarios"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_hist_instr_removido" FOREIGN KEY ("removidoPorId") 
    REFERENCES "Usuarios"("id") ON DELETE CASCADE
);

-- Índices para histórico
CREATE INDEX "idx_hist_instr_aula" ON "AulaInstrutorHistorico"("aulaId");
CREATE INDEX "idx_hist_instr_instrutor" ON "AulaInstrutorHistorico"("instrutorId");
CREATE INDEX "idx_hist_instr_removido" ON "AulaInstrutorHistorico"("removidoEm");

-- Comentários
COMMENT ON COLUMN "CursosTurmasAulas"."turmaId" IS 'Turma vinculada (nullable - aula pode ficar sem turma)';
COMMENT ON COLUMN "CursosTurmasAulas"."instrutorId" IS 'Instrutor responsável pela aula (nullable - 1 instrutor por aula)';
COMMENT ON TABLE "AulaInstrutorHistorico" IS 'Histórico de instrutores removidos das aulas. Mantém registro de quem foi instrutor e quando.';

