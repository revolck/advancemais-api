BEGIN;

-- Renomeia tabelas principais para o padrão pluralizado
ALTER TABLE "Usuario" RENAME TO "Usuarios";
ALTER TABLE "Vaga" RENAME TO "Vagas";
ALTER TABLE "Endereco" RENAME TO "Enderecos";

-- Remove colunas de cidade e estado da tabela de usuários (dados agora centralizados em Enderecos)
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "cidade";
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "estado";

-- Permite valores nulos nos campos de endereço para suportar preenchimento progressivo
ALTER TABLE "Enderecos" ALTER COLUMN "logradouro" DROP NOT NULL;
ALTER TABLE "Enderecos" ALTER COLUMN "numero" DROP NOT NULL;
ALTER TABLE "Enderecos" ALTER COLUMN "bairro" DROP NOT NULL;
ALTER TABLE "Enderecos" ALTER COLUMN "cidade" DROP NOT NULL;
ALTER TABLE "Enderecos" ALTER COLUMN "estado" DROP NOT NULL;
ALTER TABLE "Enderecos" ALTER COLUMN "cep" DROP NOT NULL;

COMMIT;
