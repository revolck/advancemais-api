-- CreateTable
CREATE TABLE "SistemaConfiguracoes" (
  "id" TEXT NOT NULL,
  "categoria" VARCHAR(50) NOT NULL,
  "chave" VARCHAR(120) NOT NULL,
  "tipo" VARCHAR(30) NOT NULL,
  "valor" JSONB,
  "valorCriptografado" TEXT,
  "valorHash" VARCHAR(96),
  "ehSecreto" BOOLEAN NOT NULL DEFAULT false,
  "descricao" VARCHAR(300),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "atualizadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SistemaConfiguracoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SistemaConfiguracoes_categoria_chave_key" ON "SistemaConfiguracoes"("categoria", "chave");
CREATE INDEX "SistemaConfiguracoes_ativo_idx" ON "SistemaConfiguracoes"("ativo");
CREATE INDEX "SistemaConfiguracoes_categoria_idx" ON "SistemaConfiguracoes"("categoria");
CREATE INDEX "SistemaConfiguracoes_chave_idx" ON "SistemaConfiguracoes"("chave");
CREATE INDEX "SistemaConfiguracoes_atualizadoPorId_idx" ON "SistemaConfiguracoes"("atualizadoPorId");

-- AddForeignKey
ALTER TABLE "SistemaConfiguracoes"
  ADD CONSTRAINT "SistemaConfiguracoes_atualizadoPorId_fkey"
  FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
