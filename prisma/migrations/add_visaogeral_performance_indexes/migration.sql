-- Otimizações de índices para o endpoint /api/cursos/visaogeral
-- Estes índices melhoram significativamente a performance das queries de visão geral

-- Índice composto para buscar turmas por data de início e status
-- Usado em: buscarCursosProximosInicio
CREATE INDEX IF NOT EXISTS "cursos_turmas_data_inicio_status_idx" 
ON "CursosTurmas" ("dataInicio", "status") 
WHERE "dataInicio" IS NOT NULL;

-- Índice composto para contar inscrições por turma e status
-- Usado em: buscarCursosProximosInicio, buscarPerformanceCursos
CREATE INDEX IF NOT EXISTS "cursos_turmas_inscricoes_turma_status_idx" 
ON "CursosTurmasInscricoes" ("turmaId", "status");

-- Índice composto para buscar transações por tipo, status e data
-- Usado em: buscarFaturamentoCursos
CREATE INDEX IF NOT EXISTS "auditoria_transacoes_tipo_status_data_idx" 
ON "AuditoriaTransacoes" ("tipo", "status", "criadoEm");

-- Índice para buscar transações por status e data (para filtros)
CREATE INDEX IF NOT EXISTS "auditoria_transacoes_status_data_idx" 
ON "AuditoriaTransacoes" ("status", "criadoEm");

-- Índice para buscar cursos por status padrão (usado em métricas gerais)
CREATE INDEX IF NOT EXISTS "cursos_status_padrao_idx" 
ON "Cursos" ("statusPadrao");

-- Índice composto para buscar turmas por curso e status
-- Usado em: buscarPerformanceCursos (agregações)
CREATE INDEX IF NOT EXISTS "cursos_turmas_curso_status_idx" 
ON "CursosTurmas" ("cursoId", "status");

