-- Migration: Remover campo tipoLink redundante
-- Data: 2025-12-12
-- Motivo: Campo pode ser derivado de urlVideo/urlMeet (elimina redundância)

-- Remover campo tipoLink
ALTER TABLE "CursosTurmasAulas"
DROP COLUMN IF EXISTS "tipoLink";

-- Comentário
COMMENT ON COLUMN "CursosTurmasAulas"."urlVideo" IS 'YouTube URL. Se preenchido, tipo = YOUTUBE (derivado)';
COMMENT ON COLUMN "CursosTurmasAulas"."urlMeet" IS 'Google Meet URL. Se preenchido, tipo = MEET (derivado)';


