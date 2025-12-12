-- Migration: Criar tabela CursosAulasProgresso
-- Data: 2025-12-11
-- Descrição: Tracking de progresso do aluno em cada aula (YouTube e Meet)

CREATE TABLE "CursosAulasProgresso" (
  "id" VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "aulaId" VARCHAR(36) NOT NULL,
  "turmaId" VARCHAR(36) NOT NULL,
  "inscricaoId" VARCHAR(36) NOT NULL,
  "alunoId" VARCHAR(36) NOT NULL,
  
  -- Progresso
  "percentualAssistido" DECIMAL(5,2) DEFAULT 0 NOT NULL,
  "tempoAssistidoSegundos" INTEGER DEFAULT 0 NOT NULL,
  "concluida" BOOLEAN DEFAULT false NOT NULL,
  "concluidaEm" TIMESTAMP NULL,
  
  -- Para YouTube (última posição do vídeo)
  "ultimaPosicao" INTEGER DEFAULT 0 NOT NULL,
  
  -- Timestamps
  "iniciadoEm" TIMESTAMP NULL,
  "atualizadoEm" TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Foreign keys
  CONSTRAINT "fk_prog_aula" FOREIGN KEY ("aulaId") 
    REFERENCES "CursosTurmasAulas"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_prog_turma" FOREIGN KEY ("turmaId") 
    REFERENCES "CursosTurmas"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_prog_inscricao" FOREIGN KEY ("inscricaoId") 
    REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_prog_aluno" FOREIGN KEY ("alunoId") 
    REFERENCES "Usuarios"("id") ON DELETE CASCADE,
    
  -- Unique constraint: 1 progresso por aluno por aula
  CONSTRAINT "uq_progresso_aula_inscricao" UNIQUE ("aulaId", "inscricaoId")
);

-- Índices para otimizar queries
CREATE INDEX "idx_prog_aluno" ON "CursosAulasProgresso"("alunoId");
CREATE INDEX "idx_prog_inscricao" ON "CursosAulasProgresso"("inscricaoId");
CREATE INDEX "idx_prog_turma_aluno" ON "CursosAulasProgresso"("turmaId", "alunoId");
CREATE INDEX "idx_prog_concluida" ON "CursosAulasProgresso"("concluida");
CREATE INDEX "idx_prog_aula" ON "CursosAulasProgresso"("aulaId");

-- Comentários
COMMENT ON TABLE "CursosAulasProgresso" IS 'Tracking de progresso do aluno em cada aula. Atualizado a cada 30s no YouTube, entrada/saída no Meet.';
COMMENT ON COLUMN "CursosAulasProgresso"."percentualAssistido" IS 'Percentual assistido (0-100). Ao atingir 90%, marca como concluída automaticamente.';
COMMENT ON COLUMN "CursosAulasProgresso"."ultimaPosicao" IS 'Última posição no vídeo YouTube (em segundos). Para retomar de onde parou.';

