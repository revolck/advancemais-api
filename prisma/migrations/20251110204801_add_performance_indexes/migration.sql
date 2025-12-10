-- CreateIndex
CREATE INDEX IF NOT EXISTS "usuarios_role_status_criadoem_desc_idx" ON "Usuarios"("role", "status", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UsuariosEnderecos_cidade_idx" ON "UsuariosEnderecos"("cidade");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UsuariosEnderecos_estado_idx" ON "UsuariosEnderecos"("estado");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UsuariosEnderecos_cidade_estado_idx" ON "UsuariosEnderecos"("cidade", "estado");

-- CreateIndex (índice para endereço mais recente por usuário)
CREATE INDEX IF NOT EXISTS "UsuariosEnderecos_usuarioId_criadoEm_idx" ON "UsuariosEnderecos"("usuarioId", "criadoEm" DESC);

-- ============================================
-- ÍNDICES PARCIAIS (WHERE clause)
-- ============================================

-- Índice parcial para instrutores (otimiza queries específicas de instrutores)
CREATE INDEX IF NOT EXISTS "usuarios_instrutor_status_idx" 
ON "Usuarios" (role, status, "criadoEm" DESC) 
WHERE role = 'INSTRUTOR';

-- Índice parcial para alunos/candidatos (otimiza queries específicas de alunos)
CREATE INDEX IF NOT EXISTS "usuarios_aluno_status_idx" 
ON "Usuarios" (role, status, "criadoEm" DESC) 
WHERE role = 'ALUNO_CANDIDATO';

-- Índices parciais para endereços (apenas registros com cidade/estado não nulos)
CREATE INDEX IF NOT EXISTS "usuarios_enderecos_cidade_partial_idx" 
ON "UsuariosEnderecos" (cidade) 
WHERE cidade IS NOT NULL;

CREATE INDEX IF NOT EXISTS "usuarios_enderecos_estado_partial_idx" 
ON "UsuariosEnderecos" (estado) 
WHERE estado IS NOT NULL;

CREATE INDEX IF NOT EXISTS "usuarios_enderecos_cidade_estado_partial_idx" 
ON "UsuariosEnderecos" (cidade, estado) 
WHERE cidade IS NOT NULL AND estado IS NOT NULL;

-- ============================================
-- ÍNDICES FUNCIONAIS (para busca case-insensitive)
-- ============================================

-- Índice funcional para busca por nome (case-insensitive)
CREATE INDEX IF NOT EXISTS "usuarios_nome_completo_lower_idx" 
ON "Usuarios" (LOWER("nomeCompleto"));

-- Índice funcional para busca por email (case-insensitive)
CREATE INDEX IF NOT EXISTS "usuarios_email_lower_idx" 
ON "Usuarios" (LOWER(email));

-- ============================================
-- ANÁLISE DE PERFORMANCE
-- ============================================

-- Executar ANALYZE para atualizar estatísticas do PostgreSQL
ANALYZE "Usuarios";
ANALYZE "UsuariosEnderecos";
ANALYZE "UsuariosInformation";
ANALYZE "UsuariosRedesSociais";
