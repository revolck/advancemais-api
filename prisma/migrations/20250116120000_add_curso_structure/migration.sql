CREATE TYPE "CursoMetodo" AS ENUM ('ONLINE', 'PRESENCIAL', 'LIVE', 'SEMI_PRESENCIAL');

CREATE TABLE "CursoCategoria" (
    "id" SERIAL PRIMARY KEY,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255)
);

CREATE TABLE "CursoSubcategoria" (
    "id" SERIAL PRIMARY KEY,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255),
    "categoriaId" INTEGER NOT NULL REFERENCES "CursoCategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Curso" (
    "id" SERIAL PRIMARY KEY,
    "categoriaId" INTEGER REFERENCES "CursoCategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "subcategoriaId" INTEGER REFERENCES "CursoSubcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CursoCategoria_nome_key" ON "CursoCategoria"("nome");
CREATE INDEX "CursoCategoria_nome_idx" ON "CursoCategoria"("nome");

CREATE UNIQUE INDEX "CursoSubcategoria_categoriaId_nome_key" ON "CursoSubcategoria"("categoriaId", "nome");
CREATE INDEX "CursoSubcategoria_nome_idx" ON "CursoSubcategoria"("nome");

CREATE INDEX "Curso_categoriaId_idx" ON "Curso"("categoriaId");
CREATE INDEX "Curso_subcategoriaId_idx" ON "Curso"("subcategoriaId");
