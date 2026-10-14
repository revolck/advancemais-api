import { prisma } from '@/config/prisma';

/** Chaves aceitas: maiúsculas, números e "_" (ex.: EMPRESA_PRIMEIRO_ACESSO_V1) */
export const CHAVE_TUTORIAL = /^[A-Z][A-Z0-9_]{2,59}$/;
/** CONCLUIDO/PULADO para tours; OCULTO/VISIVEL para a chave ASSISTENTE (botão do robô) */
export const STATUS_TUTORIAL = ['CONCLUIDO', 'PULADO', 'OCULTO', 'VISIVEL'] as const;
export type StatusTutorial = (typeof STATUS_TUTORIAL)[number];

/** Tutoriais/mensagens do assistente que o usuário já concluiu ou pulou */
export async function listarTutoriais(usuarioId: string) {
  const registros = await prisma.usuariosTutoriais.findMany({
    where: { usuarioId },
    select: { chave: true, status: true, atualizadoEm: true },
  });
  return Object.fromEntries(
    registros.map((r) => [r.chave, { status: r.status, em: r.atualizadoEm.toISOString() }]),
  );
}

export async function registrarTutorial(usuarioId: string, chave: string, status: StatusTutorial) {
  const registro = await prisma.usuariosTutoriais.upsert({
    where: { usuarioId_chave: { usuarioId, chave } },
    create: { usuarioId, chave, status },
    update: { status },
    select: { chave: true, status: true, atualizadoEm: true },
  });
  return {
    chave: registro.chave,
    status: registro.status,
    em: registro.atualizadoEm.toISOString(),
  };
}
