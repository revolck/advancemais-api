-- Migration: Adicionar campos de Google OAuth em Usuarios
-- Data: 2025-12-11
-- Descrição: Integração com Google Calendar e Google Meet para aulas ao vivo

ALTER TABLE "Usuarios"
ADD COLUMN "googleAccessToken" TEXT NULL,
ADD COLUMN "googleRefreshToken" TEXT NULL,
ADD COLUMN "googleCalendarId" VARCHAR(255) NULL,
ADD COLUMN "googleTokenExpiraEm" TIMESTAMP NULL;

-- Índice para buscar usuários com Google conectado
CREATE INDEX "idx_usuarios_google" ON "Usuarios"("googleCalendarId") WHERE "googleCalendarId" IS NOT NULL;

-- Comentários
COMMENT ON COLUMN "Usuarios"."googleAccessToken" IS 'Token de acesso Google OAuth (deve ser criptografado)';
COMMENT ON COLUMN "Usuarios"."googleRefreshToken" IS 'Refresh token Google OAuth (deve ser criptografado)';
COMMENT ON COLUMN "Usuarios"."googleCalendarId" IS 'ID do calendário principal do usuário no Google';
COMMENT ON COLUMN "Usuarios"."googleTokenExpiraEm" IS 'Data de expiração do access token (renovar automaticamente)';

