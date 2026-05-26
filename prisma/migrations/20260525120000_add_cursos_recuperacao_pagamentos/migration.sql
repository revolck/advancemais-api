ALTER TABLE "CursosTurmasInscricoes"
ADD COLUMN "pixQrCode" TEXT,
ADD COLUMN "pixQrCodeBase64" TEXT,
ADD COLUMN "boletoCodigo" TEXT,
ADD COLUMN "boletoUrl" TEXT,
ADD COLUMN "pagamentoExpiraEm" TIMESTAMP(3);

CREATE TABLE "CursosRecuperacaoPagamentos" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "provaId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "statusPagamento" VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
    "metodoPagamento" VARCHAR(50),
    "mpPaymentId" VARCHAR(255),
    "pixQrCode" TEXT,
    "pixQrCodeBase64" TEXT,
    "boletoCodigo" TEXT,
    "boletoUrl" TEXT,
    "expiraEm" TIMESTAMP(3),
    "pagoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosRecuperacaoPagamentos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CursosRecuperacaoPagamentos_mpPaymentId_key" ON "CursosRecuperacaoPagamentos"("mpPaymentId");
CREATE UNIQUE INDEX "CursosRecuperacaoPagamentos_inscricaoId_provaId_key" ON "CursosRecuperacaoPagamentos"("inscricaoId", "provaId");
CREATE INDEX "CursosRecuperacaoPagamentos_alunoId_criadoEm_idx" ON "CursosRecuperacaoPagamentos"("alunoId", "criadoEm");
CREATE INDEX "CursosRecuperacaoPagamentos_alunoId_statusPagamento_idx" ON "CursosRecuperacaoPagamentos"("alunoId", "statusPagamento");
CREATE INDEX "CursosRecuperacaoPagamentos_turmaId_idx" ON "CursosRecuperacaoPagamentos"("turmaId");
CREATE INDEX "CursosRecuperacaoPagamentos_provaId_idx" ON "CursosRecuperacaoPagamentos"("provaId");

ALTER TABLE "CursosRecuperacaoPagamentos" ADD CONSTRAINT "CursosRecuperacaoPagamentos_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CursosRecuperacaoPagamentos" ADD CONSTRAINT "CursosRecuperacaoPagamentos_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CursosRecuperacaoPagamentos" ADD CONSTRAINT "CursosRecuperacaoPagamentos_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CursosRecuperacaoPagamentos" ADD CONSTRAINT "CursosRecuperacaoPagamentos_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "CursosTurmasProvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
