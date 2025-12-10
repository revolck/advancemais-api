-- Migration: Adicionar campos adicionais para sistema de cartões
-- Data: 10/12/2025
-- Descrição: Adiciona campos de controle de falhas, tipo de cartão e validação

-- 1. Adicionar campos na tabela EmpresasCartoes
ALTER TABLE "EmpresasCartoes"
ADD COLUMN IF NOT EXISTS "tipo" VARCHAR(10) DEFAULT 'credito' CHECK ("tipo" IN ('credito', 'debito')),
ADD COLUMN IF NOT EXISTS "falhasConsecutivas" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "validadoEm" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "ultimaFalhaEm" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "paymentMethodId" VARCHAR(100);

-- 2. Criar índice para buscar cartões com falhas
CREATE INDEX IF NOT EXISTS "idx_empresas_cartoes_falhas" 
ON "EmpresasCartoes"("usuarioId", "falhasConsecutivas") 
WHERE ativo = TRUE;

-- 3. Atualizar trigger para desabilitar cartões com muitas falhas
CREATE OR REPLACE FUNCTION fn_desabilitar_cartao_falhas()
RETURNS TRIGGER AS $$
BEGIN
  -- Desabilitar cartão após 3 falhas consecutivas
  IF NEW."falhasConsecutivas" >= 3 AND OLD."falhasConsecutivas" < 3 THEN
    NEW.ativo = FALSE;
    NEW."atualizadoEm" = CURRENT_TIMESTAMP;
    
    -- Log para auditoria
    RAISE NOTICE 'Cartão % desabilitado após 3 falhas consecutivas', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_desabilitar_cartao_falhas ON "EmpresasCartoes";
CREATE TRIGGER trg_desabilitar_cartao_falhas
  BEFORE UPDATE ON "EmpresasCartoes"
  FOR EACH ROW
  WHEN (NEW."falhasConsecutivas" IS DISTINCT FROM OLD."falhasConsecutivas")
  EXECUTE FUNCTION fn_desabilitar_cartao_falhas();

-- 4. Comentários nos novos campos
COMMENT ON COLUMN "EmpresasCartoes"."tipo" IS 'Tipo do cartão: credito ou debito';
COMMENT ON COLUMN "EmpresasCartoes"."falhasConsecutivas" IS 'Número de falhas consecutivas na cobrança. Resetado após sucesso. Desabilita após 3 falhas.';
COMMENT ON COLUMN "EmpresasCartoes"."validadoEm" IS 'Data da última validação do cartão (transação zero)';
COMMENT ON COLUMN "EmpresasCartoes"."ultimaFalhaEm" IS 'Data da última falha de cobrança';
COMMENT ON COLUMN "EmpresasCartoes"."paymentMethodId" IS 'ID do método de pagamento no Mercado Pago (visa, master, etc)';


