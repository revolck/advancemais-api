-- Add administrative entitlement for unlimited company vacancies/highlights.
ALTER TYPE "EmpresasAuditoriaAcao" ADD VALUE IF NOT EXISTS 'RECURSOS_PREMIUM_VAGAS_APLICADOS';
ALTER TYPE "EmpresasAuditoriaAcao" ADD VALUE IF NOT EXISTS 'RECURSOS_PREMIUM_VAGAS_REMOVIDOS';

CREATE TABLE "EmpresasRecursosPremiumVagas" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "vagasIlimitadas" BOOLEAN NOT NULL DEFAULT true,
  "destaquesIlimitados" BOOLEAN NOT NULL DEFAULT true,
  "aplicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "aplicadoPorId" TEXT NOT NULL,
  "motivo" VARCHAR(500),
  "removidoEm" TIMESTAMP(3),
  "removidoPorId" TEXT,
  "motivoRemocao" VARCHAR(500),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmpresasRecursosPremiumVagas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmpresasRecursosPremiumVagas_empresaId_key" ON "EmpresasRecursosPremiumVagas"("empresaId");
CREATE INDEX "EmpresasRecursosPremiumVagas_ativo_idx" ON "EmpresasRecursosPremiumVagas"("ativo");
CREATE INDEX "EmpresasRecursosPremiumVagas_aplicadoPorId_idx" ON "EmpresasRecursosPremiumVagas"("aplicadoPorId");
CREATE INDEX "EmpresasRecursosPremiumVagas_removidoPorId_idx" ON "EmpresasRecursosPremiumVagas"("removidoPorId");

ALTER TABLE "EmpresasRecursosPremiumVagas"
  ADD CONSTRAINT "EmpresasRecursosPremiumVagas_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmpresasRecursosPremiumVagas"
  ADD CONSTRAINT "EmpresasRecursosPremiumVagas_aplicadoPorId_fkey"
  FOREIGN KEY ("aplicadoPorId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmpresasRecursosPremiumVagas"
  ADD CONSTRAINT "EmpresasRecursosPremiumVagas_removidoPorId_fkey"
  FOREIGN KEY ("removidoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
