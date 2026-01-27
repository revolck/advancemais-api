-- Expand enunciado length to support larger questions (up to 5000 chars)
ALTER TABLE "CursosTurmasProvasQuestoes"
ALTER COLUMN "enunciado" TYPE VARCHAR(5000);

