-- Add curso-level rich text field used by course edit and certificate prefill flows
ALTER TABLE "Cursos"
ADD COLUMN IF NOT EXISTS "conteudoProgramatico" TEXT;
