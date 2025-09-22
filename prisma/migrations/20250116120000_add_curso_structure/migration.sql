CREATE TYPE "CursosMetodo" AS ENUM ('ONLINE', 'PRESENCIAL', 'LIVE', 'SEMI_PRESENCIAL');

CREATE TABLE "CursosCategorias" (
    "id" SERIAL PRIMARY KEY,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255)
);

CREATE TABLE "CursosSubcategorias" (
    "id" SERIAL PRIMARY KEY,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255),
    "categoriaId" INTEGER NOT NULL REFERENCES "CursosCategorias"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Cursos" (
    "id" SERIAL PRIMARY KEY,
    "categoriaId" INTEGER REFERENCES "CursosCategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "subcategoriaId" INTEGER REFERENCES "CursosSubcategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CursosCategorias_nome_key" ON "CursosCategorias"("nome");
CREATE INDEX "CursosCategorias_nome_idx" ON "CursosCategorias"("nome");

CREATE UNIQUE INDEX "CursosSubcategorias_categoriaId_nome_key" ON "CursosSubcategorias"("categoriaId", "nome");
CREATE INDEX "CursosSubcategorias_nome_idx" ON "CursosSubcategorias"("nome");

CREATE INDEX "Cursos_categoriaId_idx" ON "Cursos"("categoriaId");
CREATE INDEX "Cursos_subcategoriaId_idx" ON "Cursos"("subcategoriaId");
