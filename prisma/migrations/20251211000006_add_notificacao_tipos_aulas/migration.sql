-- Migration: Adicionar novos tipos de notificação para sistema de aulas
-- Data: 2025-12-11
-- Descrição: Adiciona 13 novos tipos de notificação relacionados a aulas, provas e turmas

-- Adicionar ao enum NotificacaoTipo
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'NOVA_AULA';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'AULA_ATUALIZADA';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'AULA_CANCELADA';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'AULA_EM_2H';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'AULA_INICIADA';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'PROVA_EM_24H';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'PROVA_EM_8H';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'PROVA_EM_2H';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'INSTRUTOR_VINCULADO';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'INSTRUTOR_DESVINCULADO';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'TURMA_INICIOU';
ALTER TYPE "NotificacaoTipo" ADD VALUE IF NOT EXISTS 'TURMA_FINALIZADA';

-- Comentário
COMMENT ON TYPE "NotificacaoTipo" IS 'Tipos de notificação do sistema. Novos tipos de aulas/provas adicionados em 11/12/2025.';

