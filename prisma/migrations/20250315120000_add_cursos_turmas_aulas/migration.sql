-- Create enums for aulas and materiais
CREATE TYPE "CursosMateriais" AS ENUM (
  'APOSTILA',
  'SLIDE',
  'VIDEOAULA',
  'AUDIOAULA',
  'ARTIGO',
  'EXERCICIO',
  'SIMULADO',
  'LIVRO',
  'CERTIFICADO',
  'OUTRO'
);

CREATE TYPE "TiposDeArquivos" AS ENUM (
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'imagem',
  'video',
  'audio',
  'zip',
  'link',
  'outro'
);

-- Create table for aulas vinculadas às turmas
CREATE TABLE "CursosTurmasAulas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "turmaId" UUID NOT NULL,
  "nome" VARCHAR(255) NOT NULL,
  "descricao" TEXT,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CursosTurmasAulas_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CursosTurmasAulas"
  ADD CONSTRAINT "CursosTurmasAulas_turmaId_fkey"
  FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CursosTurmasAulas_turmaId_idx" ON "CursosTurmasAulas"("turmaId");
CREATE INDEX "CursosTurmasAulas_turmaId_ordem_idx" ON "CursosTurmasAulas"("turmaId", "ordem");

-- Create table for materiais vinculados às aulas
CREATE TABLE "CursosTurmasAulasMateriais" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "aulaId" UUID NOT NULL,
  "titulo" VARCHAR(255) NOT NULL,
  "descricao" VARCHAR(2000),
  "tipo" "CursosMateriais" NOT NULL,
  "tipoArquivo" "TiposDeArquivos",
  "url" VARCHAR(2048),
  "duracaoEmSegundos" INTEGER,
  "tamanhoEmBytes" INTEGER,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CursosTurmasAulasMateriais_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CursosTurmasAulasMateriais"
  ADD CONSTRAINT "CursosTurmasAulasMateriais_aulaId_fkey"
  FOREIGN KEY ("aulaId") REFERENCES "CursosTurmasAulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CursosTurmasAulasMateriais_aulaId_idx" ON "CursosTurmasAulasMateriais"("aulaId");
CREATE INDEX "CursosTurmasAulasMateriais_tipo_idx" ON "CursosTurmasAulasMateriais"("tipo");
