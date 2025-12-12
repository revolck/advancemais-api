-- Migration: Expandir CursosTurmasAulas com sistema completo de gestão de aulas
-- Data: 2025-12-11
-- Descrição: Adiciona modalidade, status, Google Meet, auditoria e soft delete

-- 1. Criar novos enums
CREATE TYPE "CursosTipoLink" AS ENUM ('YOUTUBE', 'MEET');
CREATE TYPE "CursosAulaStatus" AS ENUM ('RASCUNHO', 'PUBLICADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');
CREATE TYPE "CursosAcaoHistorico" AS ENUM ('CRIADA', 'EDITADA', 'VINCULADA_TURMA', 'DESVINCULADA_TURMA', 'STATUS_ALTERADO', 'CANCELADA', 'RESTAURADA');

-- 2. Adicionar novos campos em CursosTurmasAulas
ALTER TABLE "CursosTurmasAulas"
-- Modalidade e tipo de link
ADD COLUMN "modalidade" "CursosMetodos" DEFAULT 'ONLINE' NOT NULL,
ADD COLUMN "tipoLink" "CursosTipoLink" NULL,

-- Controle de obrigatoriedade e duração
ADD COLUMN "obrigatoria" BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN "duracaoMinutos" INTEGER NULL,

-- Status da aula
ADD COLUMN "status" "CursosAulaStatus" DEFAULT 'PUBLICADA' NOT NULL,

-- Google Meet integração
ADD COLUMN "meetEventId" VARCHAR(255) NULL,

-- Controle de inserção posterior
ADD COLUMN "adicionadaAposCriacao" BOOLEAN DEFAULT false NOT NULL,

-- Período específico
ADD COLUMN "dataInicio" TIMESTAMP NULL,
ADD COLUMN "dataFim" TIMESTAMP NULL,
ADD COLUMN "horaInicio" VARCHAR(5) NULL,
ADD COLUMN "horaFim" VARCHAR(5) NULL,

-- Auditoria e soft delete
ADD COLUMN "criadoPorId" VARCHAR(36) NULL,
ADD COLUMN "deletedAt" TIMESTAMP NULL,
ADD COLUMN "deletedBy" VARCHAR(36) NULL;

-- 3. Criar índices para otimizar buscas
CREATE INDEX "idx_aulas_status" ON "CursosTurmasAulas"("status");
CREATE INDEX "idx_aulas_modalidade" ON "CursosTurmasAulas"("modalidade");
CREATE INDEX "idx_aulas_criador" ON "CursosTurmasAulas"("criadoPorId");
CREATE INDEX "idx_aulas_periodo" ON "CursosTurmasAulas"("dataInicio", "dataFim");
CREATE INDEX "idx_aulas_deleted" ON "CursosTurmasAulas"("deletedAt");
CREATE INDEX "idx_aulas_meet_event" ON "CursosTurmasAulas"("meetEventId") WHERE "meetEventId" IS NOT NULL;

-- 4. Adicionar foreign key para criador
ALTER TABLE "CursosTurmasAulas"
ADD CONSTRAINT "fk_aulas_criador" 
FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL;

-- 5. Comentários para documentação
COMMENT ON COLUMN "CursosTurmasAulas"."modalidade" IS 'Tipo da aula: ONLINE (YouTube), PRESENCIAL, LIVE (Google Meet), SEMIPRESENCIAL (YouTube ou Meet)';
COMMENT ON COLUMN "CursosTurmasAulas"."status" IS 'RASCUNHO (não visível), PUBLICADA (visível), EM_ANDAMENTO (ao vivo agora), CONCLUIDA, CANCELADA (soft delete)';
COMMENT ON COLUMN "CursosTurmasAulas"."adicionadaAposCriacao" IS 'true se foi adicionada após turma iniciar (vai após última aula realizada)';
COMMENT ON COLUMN "CursosTurmasAulas"."deletedAt" IS 'Soft delete - mantém histórico e progresso dos alunos';
COMMENT ON COLUMN "CursosTurmasAulas"."meetEventId" IS 'ID do evento no Google Calendar (para aulas ao vivo)';

