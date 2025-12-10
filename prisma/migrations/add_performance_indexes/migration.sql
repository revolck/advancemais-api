-- Otimizações de Performance: Índices para Queries de Listagem
-- Este arquivo adiciona índices estratégicos para melhorar performance de queries frequentes

-- ============================================
-- ÍNDICES PARA USUARIOS_ENDERECOS
-- ============================================

-- Índice para busca por cidade (usado em filtros de listagem)
CREATE INDEX IF NOT EXISTS usuarios_enderecos_cidade_idx 
ON "UsuariosEnderecos" (cidade) 
WHERE cidade IS NOT NULL;

-- Índice para busca por estado (usado em filtros de listagem)
CREATE INDEX IF NOT EXISTS usuarios_enderecos_estado_idx 
ON "UsuariosEnderecos" (estado) 
WHERE estado IS NOT NULL;

-- Índice composto para cidade + estado (otimiza filtros combinados)
CREATE INDEX IF NOT EXISTS usuarios_enderecos_cidade_estado_idx 
ON "UsuariosEnderecos" (cidade, estado) 
WHERE cidade IS NOT NULL AND estado IS NOT NULL;

-- Índice para buscar endereço mais recente por usuário (usado em listagens)
-- Este índice otimiza a query: ORDER BY criadoEm DESC LIMIT 1
CREATE INDEX IF NOT EXISTS usuarios_enderecos_usuario_criadoem_idx 
ON "UsuariosEnderecos" ("usuarioId", "criadoEm" DESC);

-- ============================================
-- ÍNDICES PARA BUSCA DE USUÁRIOS
-- ============================================

-- Índice para busca por nome (case-insensitive não é suportado diretamente no PostgreSQL)
-- Mas podemos criar um índice para busca por prefixo (LIKE 'termo%')
CREATE INDEX IF NOT EXISTS usuarios_nome_completo_idx 
ON "Usuarios" (LOWER("nomeCompleto"));

-- Índice para busca por email (case-insensitive)
CREATE INDEX IF NOT EXISTS usuarios_email_lower_idx 
ON "Usuarios" (LOWER(email));

-- Índice para busca por CPF (já existe unique, mas podemos adicionar índice para busca parcial)
-- Nota: CPF unique já cria índice automaticamente, mas podemos adicionar índice funcional se necessário

-- ============================================
-- ÍNDICES COMPOSTOS ADICIONAIS
-- ============================================

-- Índice composto para role + status + criadoEm (já existe, mas verificando)
-- Este índice já existe: usuarios_role_status_criadoem_idx

-- Índice para busca de instrutores (role = INSTRUTOR + status)
CREATE INDEX IF NOT EXISTS usuarios_instrutor_status_idx 
ON "Usuarios" (role, status, "criadoEm" DESC) 
WHERE role = 'INSTRUTOR';

-- Índice para busca de alunos/candidatos (role = ALUNO_CANDIDATO + status)
CREATE INDEX IF NOT EXISTS usuarios_aluno_status_idx 
ON "Usuarios" (role, status, "criadoEm" DESC) 
WHERE role = 'ALUNO_CANDIDATO';

-- ============================================
-- ANÁLISE DE PERFORMANCE
-- ============================================

-- Executar ANALYZE para atualizar estatísticas do PostgreSQL
ANALYZE "Usuarios";
ANALYZE "UsuariosEnderecos";
ANALYZE "UsuariosInformation";
ANALYZE "UsuariosRedesSociais";

