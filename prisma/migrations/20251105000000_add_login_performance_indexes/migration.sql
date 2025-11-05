-- Índices para otimizar performance de login e busca por documento
-- CPF e CNPJ já têm unique constraint (cria índice automaticamente), mas adicionamos índices compostos para queries com status

-- Índice composto para busca por CPF com filtro de status (otimiza login)
CREATE INDEX IF NOT EXISTS usuarios_cpf_status_idx ON "Usuarios"("cpf", "status") WHERE "cpf" IS NOT NULL;

-- Índice composto para busca por CNPJ com filtro de status (otimiza login)
CREATE INDEX IF NOT EXISTS usuarios_cnpj_status_idx ON "Usuarios"("cnpj", "status") WHERE "cnpj" IS NOT NULL;

-- Índice composto para busca por email com filtro de status (otimiza login)
CREATE INDEX IF NOT EXISTS usuarios_email_status_idx ON "Usuarios"("email", "status");

-- Índice parcial para usuários ativos (otimiza queries que filtram por status=ATIVO)
CREATE INDEX IF NOT EXISTS usuarios_ativo_idx ON "Usuarios"("id", "status", "criadoEm") WHERE "status" = 'ATIVO';


