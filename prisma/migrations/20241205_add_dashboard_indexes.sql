-- Migração para adicionar índices de performance para o dashboard
-- Data: 2024-12-05
-- Objetivo: Otimizar queries do endpoint de métricas

-- Índices para EmpresasCandidatos
CREATE INDEX IF NOT EXISTS "EmpresasCandidatos_empresaUsuarioId_idx" 
ON "EmpresasCandidatos"("empresaUsuarioId");

CREATE INDEX IF NOT EXISTS "EmpresasCandidatos_vagaId_candidatoId_idx" 
ON "EmpresasCandidatos"("vagaId", "candidatoId");

CREATE INDEX IF NOT EXISTS "EmpresasCandidatos_aplicadaEm_idx" 
ON "EmpresasCandidatos"("aplicadaEm");

CREATE INDEX IF NOT EXISTS "EmpresasCandidatos_empresaUsuarioId_aplicadaEm_idx" 
ON "EmpresasCandidatos"("empresaUsuarioId", "aplicadaEm");

-- Índices para EmpresasVagas  
CREATE INDEX IF NOT EXISTS "EmpresasVagas_status_idx" 
ON "EmpresasVagas"("status");

CREATE INDEX IF NOT EXISTS "EmpresasVagas_usuarioId_status_idx" 
ON "EmpresasVagas"("usuarioId", "status");

-- Comentários
COMMENT ON INDEX "EmpresasCandidatos_empresaUsuarioId_idx" IS 'Índice para filtrar candidaturas por empresa';
COMMENT ON INDEX "EmpresasCandidatos_aplicadaEm_idx" IS 'Índice para filtrar candidaturas por data';
COMMENT ON INDEX "EmpresasVagas_status_idx" IS 'Índice para filtrar vagas por status';






