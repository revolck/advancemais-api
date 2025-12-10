-- Migration: Adicionar status AGUARDANDO_PAGAMENTO ao enum StatusInscricao
-- Data: 2025-12-10
-- Descrição: Permite que inscrições fiquem pendentes aguardando confirmação de pagamento

-- Adicionar novo valor ao enum
ALTER TYPE "StatusInscricao" ADD VALUE IF NOT EXISTS 'AGUARDANDO_PAGAMENTO';

-- Comentário
COMMENT ON TYPE "StatusInscricao" IS 'Status da inscrição: AGUARDANDO_PAGAMENTO (pendente), INSCRITO (ativo), EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO';

