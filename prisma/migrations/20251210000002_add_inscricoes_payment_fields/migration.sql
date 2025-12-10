-- Migration: Adicionar campos de pagamento e token de acesso no modelo CursosTurmasInscricoes
-- Data: 2025-12-10
-- Descrição: Permite processar pagamentos e gerar tokens únicos de acesso por inscrição

-- Adicionar campos de identificação e pagamento
ALTER TABLE "CursosTurmasInscricoes"
ADD COLUMN "codigo" VARCHAR(20) NULL UNIQUE,
ADD COLUMN "statusPagamento" VARCHAR(50) DEFAULT 'PENDENTE' NOT NULL,
ADD COLUMN "mpPaymentId" VARCHAR(255) NULL,
ADD COLUMN "tokenAcesso" VARCHAR(500) NULL UNIQUE,
ADD COLUMN "tokenAcessoExpiraEm" TIMESTAMP NULL,
ADD COLUMN "valorPago" DECIMAL(10,2) NULL,
ADD COLUMN "metodoPagamento" VARCHAR(50) NULL;

-- Adicionar campos de aceite de termos
ALTER TABLE "CursosTurmasInscricoes"
ADD COLUMN "aceitouTermos" BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN "aceitouTermosIp" VARCHAR(45) NULL,
ADD COLUMN "aceitouTermosUserAgent" VARCHAR(500) NULL,
ADD COLUMN "aceitouTermosEm" TIMESTAMP NULL;

-- Adicionar campos de cupom de desconto
ALTER TABLE "CursosTurmasInscricoes"
ADD COLUMN "cupomDescontoId" VARCHAR(36) NULL,
ADD COLUMN "cupomDescontoCodigo" VARCHAR(40) NULL,
ADD COLUMN "valorOriginal" DECIMAL(10,2) NULL,
ADD COLUMN "valorDesconto" DECIMAL(10,2) NULL,
ADD COLUMN "valorFinal" DECIMAL(10,2) NULL;

-- Criar índices para otimizar buscas
CREATE INDEX "idx_inscricoes_status_pagamento" ON "CursosTurmasInscricoes"("statusPagamento");
CREATE INDEX "idx_inscricoes_mp_payment_id" ON "CursosTurmasInscricoes"("mpPaymentId") WHERE "mpPaymentId" IS NOT NULL;
CREATE INDEX "idx_inscricoes_token_acesso" ON "CursosTurmasInscricoes"("tokenAcesso") WHERE "tokenAcesso" IS NOT NULL;
CREATE INDEX "idx_inscricoes_codigo" ON "CursosTurmasInscricoes"("codigo") WHERE "codigo" IS NOT NULL;

-- Adicionar foreign key para cupom (se aplicável)
-- Note: Descomente se a tabela CuponsDesconto estiver disponível
-- ALTER TABLE "CursosTurmasInscricoes" 
-- ADD CONSTRAINT "fk_inscricoes_cupom" 
-- FOREIGN KEY ("cupomDescontoId") REFERENCES "CuponsDesconto"("id") ON DELETE SET NULL;

-- Comentários para documentação
COMMENT ON COLUMN "CursosTurmasInscricoes"."codigo" IS 'Código único da inscrição (ex: MAT2024001)';
COMMENT ON COLUMN "CursosTurmasInscricoes"."statusPagamento" IS 'Status do pagamento: PENDENTE, APROVADO, RECUSADO, PROCESSANDO, CANCELADO';
COMMENT ON COLUMN "CursosTurmasInscricoes"."mpPaymentId" IS 'ID do pagamento no Mercado Pago (Payment API)';
COMMENT ON COLUMN "CursosTurmasInscricoes"."tokenAcesso" IS 'Token JWT único para acesso ao curso';
COMMENT ON COLUMN "CursosTurmasInscricoes"."tokenAcessoExpiraEm" IS 'Data de expiração do token (ex: 1 ano após emissão)';
COMMENT ON COLUMN "CursosTurmasInscricoes"."valorPago" IS 'Valor efetivamente pago pelo aluno';
COMMENT ON COLUMN "CursosTurmasInscricoes"."metodoPagamento" IS 'PIX, BOLETO, CARTAO_CREDITO';

