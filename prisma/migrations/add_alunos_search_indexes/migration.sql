-- Otimizações de índices para busca de alunos
-- Estes índices melhoram significativamente a performance da busca de alunos com inscrições

-- ============================================
-- ÍNDICES PARA CursosTurmasInscricoes
-- ============================================

-- Índice composto para buscar inscrições por turma, status e data (usado na ordenação)
-- Usado em: listAlunosComInscricoes (ordenar por status e criadoEm)
CREATE INDEX IF NOT EXISTS "cursos_turmas_inscricoes_turma_status_criadoem_idx" 
ON "CursosTurmasInscricoes" ("turmaId", "status", "criadoEm" DESC);

-- Índice composto para buscar inscrições por aluno e status (para filtrar alunos ativos)
-- Usado em: listAlunosComInscricoes (filtrar alunos com inscrições ativas)
CREATE INDEX IF NOT EXISTS "cursos_turmas_inscricoes_aluno_status_idx" 
ON "CursosTurmasInscricoes" ("alunoId", "status");

-- Índice composto para buscar inscrições por status e data (para ordenação)
-- Usado em: listAlunosComInscricoes (ordenar inscrições por prioridade)
CREATE INDEX IF NOT EXISTS "cursos_turmas_inscricoes_status_criadoem_idx" 
ON "CursosTurmasInscricoes" ("status", "criadoEm" DESC);

-- ============================================
-- ÍNDICES PARA CursosTurmas
-- ============================================

-- Índice composto para buscar turmas por curso e status (já existe, mas verificando)
-- CREATE INDEX IF NOT EXISTS "cursos_turmas_curso_status_idx" 
-- ON "CursosTurmas" ("cursoId", "status");

-- ============================================
-- ÍNDICES FUNCIONAIS PARA BUSCA (case-insensitive)
-- ============================================

-- Índice funcional para busca case-insensitive por nome completo
-- Usado em: listAlunosComInscricoes (busca por nome)
CREATE INDEX IF NOT EXISTS "usuarios_nome_completo_search_idx" 
ON "Usuarios" (LOWER("nomeCompleto"))
WHERE "role" = 'ALUNO_CANDIDATO';

-- Índice funcional para busca case-insensitive por email
-- Usado em: listAlunosComInscricoes (busca por email)
CREATE INDEX IF NOT EXISTS "usuarios_email_search_idx" 
ON "Usuarios" (LOWER("email"))
WHERE "role" = 'ALUNO_CANDIDATO';

-- Índice para busca por código de usuário
-- Usado em: listAlunosComInscricoes (busca por código)
CREATE INDEX IF NOT EXISTS "usuarios_cod_usuario_search_idx" 
ON "Usuarios" ("codUsuario")
WHERE "role" = 'ALUNO_CANDIDATO';

-- ============================================
-- ANÁLISE DE PERFORMANCE
-- ============================================

-- Executar ANALYZE para atualizar estatísticas do PostgreSQL
ANALYZE "CursosTurmasInscricoes";
ANALYZE "CursosTurmas";
ANALYZE "Usuarios";

