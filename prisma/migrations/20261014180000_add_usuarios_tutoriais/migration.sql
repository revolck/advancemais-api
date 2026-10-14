-- Tutoriais/mensagens do assistente concluídos ou pulados por usuário
CREATE TABLE IF NOT EXISTS "UsuariosTutoriais" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "chave" VARCHAR(60) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsuariosTutoriais_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UsuariosTutoriais_usuarioId_chave_key" ON "UsuariosTutoriais"("usuarioId", "chave");
ALTER TABLE "UsuariosTutoriais" ADD CONSTRAINT "UsuariosTutoriais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
