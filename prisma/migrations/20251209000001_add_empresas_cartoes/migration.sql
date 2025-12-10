-- Migration: Adicionar sistema de gerenciamento de cartões para empresas
-- Data: 09/12/2025
-- Descrição: Permite empresas salvarem cartões para cobranças automáticas

-- 1. Adicionar campo mpCustomerId na tabela Usuarios
ALTER TABLE "Usuarios" 
ADD COLUMN IF NOT EXISTS "mpCustomerId" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_usuarios_mp_customer" ON "Usuarios"("mpCustomerId");

-- 2. Criar tabela EmpresasCartoes
CREATE TABLE IF NOT EXISTS "EmpresasCartoes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "usuarioId" TEXT NOT NULL REFERENCES "Usuarios"("id") ON DELETE CASCADE,
  "mpCustomerId" VARCHAR(255) NOT NULL, -- ID do customer no Mercado Pago
  "mpCardId" VARCHAR(255) NOT NULL, -- ID do cartão no Mercado Pago
  "ultimos4Digitos" VARCHAR(4) NOT NULL,
  "bandeira" VARCHAR(50) NOT NULL, -- Visa, Mastercard, Amex, Elo, etc
  "nomeNoCartao" VARCHAR(255) NOT NULL,
  "mesExpiracao" VARCHAR(2) NOT NULL,
  "anoExpiracao" VARCHAR(4) NOT NULL,
  "isPadrao" BOOLEAN DEFAULT FALSE,
  "ativo" BOOLEAN DEFAULT TRUE,
  "criadoEm" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS "idx_empresas_cartoes_usuario" ON "EmpresasCartoes"("usuarioId");
CREATE INDEX IF NOT EXISTS "idx_empresas_cartoes_padrao" ON "EmpresasCartoes"("usuarioId", "isPadrao") WHERE "isPadrao" = TRUE AND "ativo" = TRUE;
CREATE INDEX IF NOT EXISTS "idx_empresas_cartoes_mp_customer" ON "EmpresasCartoes"("mpCustomerId");
CREATE INDEX IF NOT EXISTS "idx_empresas_cartoes_ativo" ON "EmpresasCartoes"("usuarioId", "ativo") WHERE "ativo" = TRUE;

-- 4. Garantir que apenas um cartão seja padrão por empresa
-- Trigger para manter apenas um cartão padrão
CREATE OR REPLACE FUNCTION fn_empresas_cartoes_padrao_unico()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o novo cartão for definido como padrão
  IF NEW."isPadrao" = TRUE THEN
    -- Remove o padrão de todos os outros cartões da mesma empresa
    UPDATE "EmpresasCartoes"
    SET "isPadrao" = FALSE
    WHERE "usuarioId" = NEW."usuarioId"
      AND "id" != NEW."id"
      AND "isPadrao" = TRUE
      AND "ativo" = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_empresas_cartoes_padrao_unico ON "EmpresasCartoes";
CREATE TRIGGER trg_empresas_cartoes_padrao_unico
  BEFORE INSERT OR UPDATE ON "EmpresasCartoes"
  FOR EACH ROW
  EXECUTE FUNCTION fn_empresas_cartoes_padrao_unico();

-- 5. Comentários na tabela
COMMENT ON TABLE "EmpresasCartoes" IS 'Cartões de crédito salvos das empresas para cobranças automáticas';
COMMENT ON COLUMN "EmpresasCartoes"."mpCustomerId" IS 'ID do customer no Mercado Pago';
COMMENT ON COLUMN "EmpresasCartoes"."mpCardId" IS 'ID do cartão no Mercado Pago';
COMMENT ON COLUMN "EmpresasCartoes"."isPadrao" IS 'Indica se é o cartão padrão para cobranças automáticas';
COMMENT ON COLUMN "EmpresasCartoes"."ativo" IS 'Soft delete - indica se o cartão está ativo';

