-- Migration: Criar tabela NotificacoesEnviadas
-- Data: 2025-12-11
-- Descrição: Deduplicação de notificações (evita enviar a mesma notificação múltiplas vezes)

CREATE TABLE "NotificacoesEnviadas" (
  "id" VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo" VARCHAR(50) NOT NULL,
  "eventoId" VARCHAR(36) NOT NULL,
  "usuarioId" VARCHAR(36) NOT NULL,
  "enviadaEm" TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Foreign key
  CONSTRAINT "fk_notif_enviada_usuario" FOREIGN KEY ("usuarioId") 
    REFERENCES "Usuarios"("id") ON DELETE CASCADE,
  
  -- Unique constraint: 1 notificação por tipo/evento/usuário
  CONSTRAINT "uq_notif_enviada" UNIQUE ("tipo", "eventoId", "usuarioId")
);

-- Índices
CREATE INDEX "idx_notif_enviada_evento" ON "NotificacoesEnviadas"("eventoId");
CREATE INDEX "idx_notif_enviada_tipo" ON "NotificacoesEnviadas"("tipo");
CREATE INDEX "idx_notif_enviada_usuario" ON "NotificacoesEnviadas"("usuarioId");

-- Comentários
COMMENT ON TABLE "NotificacoesEnviadas" IS 'Deduplicação de notificações. Evita que cron jobs enviem a mesma notificação múltiplas vezes.';
COMMENT ON COLUMN "NotificacoesEnviadas"."eventoId" IS 'ID do evento (aulaId, provaId, turmaId, etc)';

