-- Create new enums for banimentos
CREATE TYPE "TiposDeBanimentos" AS ENUM ('TEMPORARIO', 'PERMANENTE', 'RESTRICAO_DE_RECURSO');
CREATE TYPE "StatusDeBanimentos" AS ENUM ('ATIVO', 'EM_REVISAO', 'REVOGADO', 'EXPIRADO');
CREATE TYPE "MotivosDeBanimentos" AS ENUM ('SPAM', 'VIOLACAO_POLITICAS', 'FRAUDE', 'ABUSO_DE_RECURSOS', 'OUTROS');
CREATE TYPE "AcoesDeLogDeBanimento" AS ENUM ('CRIACAO', 'ATUALIZACAO', 'REVOGACAO', 'REAVALIACAO');

-- Ajusta tabela antiga de banimentos de empresas para o novo modelo centralizado
ALTER TABLE "EmpresasEmBanimentos" DROP CONSTRAINT "EmpresasEmBanimentos_usuarioId_fkey";
ALTER TABLE "EmpresasEmBanimentos" DROP CONSTRAINT "EmpresasEmBanimentos_criadoPorId_fkey";

ALTER TABLE "EmpresasEmBanimentos" RENAME TO "UsuariosEmBanimentos";
ALTER INDEX "EmpresasEmBanimentos_usuarioId_idx" RENAME TO "UsuariosEmBanimentos_usuarioId_idx";
ALTER INDEX "EmpresasEmBanimentos_fim_idx" RENAME TO "UsuariosEmBanimentos_fim_idx";

ALTER TABLE "UsuariosEmBanimentos" RENAME COLUMN "criadoPorId" TO "aplicadoPorId";
ALTER TABLE "UsuariosEmBanimentos" RENAME COLUMN "motivo" TO "observacoes";

ALTER TABLE "UsuariosEmBanimentos" ADD COLUMN     "tipo" "TiposDeBanimentos" NOT NULL DEFAULT 'TEMPORARIO';
ALTER TABLE "UsuariosEmBanimentos" ADD COLUMN     "motivo" "MotivosDeBanimentos" NOT NULL DEFAULT 'OUTROS';
ALTER TABLE "UsuariosEmBanimentos" ADD COLUMN     "status" "StatusDeBanimentos" NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "UsuariosEmBanimentos" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UsuariosEmBanimentos" ALTER COLUMN "fim" DROP NOT NULL;
ALTER TABLE "UsuariosEmBanimentos" DROP COLUMN  "dias";

-- Atualiza dados existentes para refletir o novo modelo
UPDATE "UsuariosEmBanimentos"
SET
  "tipo" = CASE
    WHEN "fim" IS NULL THEN 'PERMANENTE'::"TiposDeBanimentos"
    ELSE 'TEMPORARIO'::"TiposDeBanimentos"
  END,
  "motivo" = 'OUTROS',
  "status" = 'ATIVO';

-- Recria vínculos com usuários
ALTER TABLE "UsuariosEmBanimentos"
  ADD CONSTRAINT "UsuariosEmBanimentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsuariosEmBanimentos"
  ADD CONSTRAINT "UsuariosEmBanimentos_aplicadoPorId_fkey" FOREIGN KEY ("aplicadoPorId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índices adicionais para status
CREATE INDEX "UsuariosEmBanimentos_status_idx" ON "UsuariosEmBanimentos"("status");

-- Cria tabela de logs de banimentos
CREATE TABLE "UsuariosEmBanimentosLogs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "banimentoId" TEXT NOT NULL,
    "acao" "AcoesDeLogDeBanimento" NOT NULL,
    "descricao" VARCHAR(500),
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsuariosEmBanimentosLogs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UsuariosEmBanimentosLogs"
  ADD CONSTRAINT "UsuariosEmBanimentosLogs_banimentoId_fkey" FOREIGN KEY ("banimentoId") REFERENCES "UsuariosEmBanimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsuariosEmBanimentosLogs"
  ADD CONSTRAINT "UsuariosEmBanimentosLogs_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "UsuariosEmBanimentosLogs_banimentoId_idx" ON "UsuariosEmBanimentosLogs"("banimentoId");
CREATE INDEX "UsuariosEmBanimentosLogs_criadoPorId_idx" ON "UsuariosEmBanimentosLogs"("criadoPorId");
CREATE INDEX "UsuariosEmBanimentosLogs_criadoEm_idx" ON "UsuariosEmBanimentosLogs"("criadoEm");

-- Atualiza nome dos índices conforme convenção atual
ALTER TABLE "UsuariosEmBanimentos" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "UsuariosEmBanimentos" ALTER COLUMN "motivo" DROP DEFAULT;
ALTER TABLE "UsuariosEmBanimentos" ALTER COLUMN "status" DROP DEFAULT;
