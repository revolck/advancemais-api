-- Script para verificar índices criados
-- Execute: psql $DATABASE_URL -f scripts/verify-indexes.sql

-- Ver índices em Usuarios
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Usuarios' 
  AND schemaname = 'public'
ORDER BY indexname;

-- Ver índices em UsuariosEnderecos
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'UsuariosEnderecos' 
  AND schemaname = 'public'
ORDER BY indexname;

-- Verificar uso de índices em uma query de exemplo
EXPLAIN ANALYZE
SELECT * FROM "Usuarios" 
WHERE role = 'INSTRUTOR' 
ORDER BY "criadoEm" DESC 
LIMIT 10;

-- Verificar uso de índices em filtro por cidade
EXPLAIN ANALYZE
SELECT u.* FROM "Usuarios" u
INNER JOIN "UsuariosEnderecos" e ON e."usuarioId" = u.id
WHERE e.cidade ILIKE '%São Paulo%'
LIMIT 10;

