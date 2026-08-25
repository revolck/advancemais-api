CREATE TABLE "CursosTurmasProvasComentarios" (
  "id" TEXT NOT NULL,
  "provaId" TEXT NOT NULL,
  "inscricaoId" TEXT NOT NULL,
  "envioId" TEXT,
  "parentId" TEXT,
  "autorId" TEXT NOT NULL,
  "conteudo" TEXT NOT NULL,
  "fixado" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CursosTurmasProvasComentarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CursosTurmasProvasComentarios_provaId_inscricaoId_idx"
  ON "CursosTurmasProvasComentarios"("provaId", "inscricaoId");

CREATE INDEX "CursosTurmasProvasComentarios_envioId_idx"
  ON "CursosTurmasProvasComentarios"("envioId");

CREATE INDEX "CursosTurmasProvasComentarios_parentId_idx"
  ON "CursosTurmasProvasComentarios"("parentId");

CREATE INDEX "CursosTurmasProvasComentarios_autorId_idx"
  ON "CursosTurmasProvasComentarios"("autorId");

CREATE INDEX "CursosTurmasProvasComentarios_fixado_criadoEm_idx"
  ON "CursosTurmasProvasComentarios"("fixado", "criadoEm");

ALTER TABLE "CursosTurmasProvasComentarios"
  ADD CONSTRAINT "CursosTurmasProvasComentarios_provaId_fkey"
  FOREIGN KEY ("provaId") REFERENCES "CursosTurmasProvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CursosTurmasProvasComentarios"
  ADD CONSTRAINT "CursosTurmasProvasComentarios_inscricaoId_fkey"
  FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CursosTurmasProvasComentarios"
  ADD CONSTRAINT "CursosTurmasProvasComentarios_envioId_fkey"
  FOREIGN KEY ("envioId") REFERENCES "CursosTurmasProvasEnvios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CursosTurmasProvasComentarios"
  ADD CONSTRAINT "CursosTurmasProvasComentarios_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "CursosTurmasProvasComentarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CursosTurmasProvasComentarios"
  ADD CONSTRAINT "CursosTurmasProvasComentarios_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
