-- Adiciona índice único parcial para garantir que apenas 1 currículo por usuário pode ser principal
-- Isso previne race conditions e garante consistência mesmo em requisições concorrentes
CREATE UNIQUE INDEX "UsuariosCurriculos_usuarioId_principal_unique" 
ON "UsuariosCurriculos" ("usuarioId") 
WHERE "principal" = true;
