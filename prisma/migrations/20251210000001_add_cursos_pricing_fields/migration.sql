-- Migration: Adicionar campos de precificação no modelo Cursos
-- Data: 2025-12-10
-- Descrição: Apenas o essencial - valor e promoção
-- 
-- NOTAS IMPORTANTES:
-- 1. Métodos de pagamento (PIX, Boleto, Cartão, Parcelas) são gerenciados pelo Mercado Pago
-- 2. Disponibilidade é controlada por statusPadrao (PUBLICADO = disponível, RASCUNHO = indisponível)
-- 3. Desconto percentual é calculado dinamicamente: ((valor - valorPromocional) / valor) * 100

-- Adicionar apenas 3 campos essenciais
ALTER TABLE "Cursos" 
ADD COLUMN "valor" DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
ADD COLUMN "valorPromocional" DECIMAL(10,2) NULL,
ADD COLUMN "gratuito" BOOLEAN DEFAULT false NOT NULL;

-- Criar índices para otimizar buscas
CREATE INDEX "idx_cursos_status_gratuito" ON "Cursos"("statusPadrao", "gratuito");
CREATE INDEX "idx_cursos_gratuito" ON "Cursos"("gratuito") WHERE "gratuito" = true;

-- Comentários para documentação
COMMENT ON COLUMN "Cursos"."valor" IS 'Valor do curso em reais (ex: 299.90). Obrigatório se gratuito = false';
COMMENT ON COLUMN "Cursos"."valorPromocional" IS 'Valor promocional opcional (deve ser menor que valor). Desconto é calculado dinamicamente.';
COMMENT ON COLUMN "Cursos"."gratuito" IS 'Se é um curso gratuito (valor = 0)';
COMMENT ON COLUMN "Cursos"."statusPadrao" IS 'PUBLICADO = disponível para compra, RASCUNHO = indisponível';
COMMENT ON TABLE "Cursos" IS 'Métodos de pagamento e desconto percentual são calculados/gerenciados dinamicamente';

