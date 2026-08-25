import { prisma } from '@/config/prisma';
import { Roles, Status } from '@prisma/client';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';

type TurmaInstrutorInfo = {
  instrutorId: string | null;
  CursosTurmasInstrutores?: { instrutorId: string }[];
};

/**
 * Organizador efetivo do item (dono técnico do evento no Google Calendar).
 * Mesma prioridade usada em instrutor-scope.service.ts: instrutor do item (aula/prova/
 * atividade) vence o instrutor da turma.
 */
export function resolveOrganizadorId(
  itemInstrutorId: string | null | undefined,
  turma: TurmaInstrutorInfo,
): string | null {
  return (
    itemInstrutorId ?? turma.instrutorId ?? turma.CursosTurmasInstrutores?.[0]?.instrutorId ?? null
  );
}

/**
 * Conjunto de instrutores a convidar para a sala (item + turma + co-instrutores),
 * sem duplicatas.
 */
export function resolveInstrutorAttendeeIds(
  itemInstrutorId: string | null | undefined,
  turma: TurmaInstrutorInfo,
): string[] {
  const ids = new Set<string>();
  if (itemInstrutorId) ids.add(itemInstrutorId);
  if (turma.instrutorId) ids.add(turma.instrutorId);
  for (const vinculo of turma.CursosTurmasInstrutores ?? []) {
    ids.add(vinculo.instrutorId);
  }
  return [...ids];
}

/**
 * Monta os dois grupos de convidados de uma sala:
 * - `convidados`: alunos + instrutor(es) do escopo — recebem o convite normal do Calendar.
 * - `adicionaisSilenciosos`: ADMIN/MODERADOR/PEDAGOGICO (todos, sem filtro de vínculo) +
 *   e-mails institucionais fixos — adicionados depois via patch com sendUpdates:'none',
 *   para não gerar ruído de convite de calendário numa lista potencialmente grande.
 */
export async function buildAttendeeGroups(params: {
  alunoEmails: string[];
  instrutorIds: string[];
}): Promise<{ convidados: string[]; adicionaisSilenciosos: string[] }> {
  const [instrutores, gestores, institucionais] = await Promise.all([
    params.instrutorIds.length
      ? prisma.usuarios.findMany({
          where: { id: { in: params.instrutorIds } },
          select: { email: true },
        })
      : Promise.resolve([]),
    prisma.usuarios.findMany({
      where: {
        role: { in: [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO] },
        status: Status.ATIVO,
      },
      select: { email: true },
    }),
    runtimeConfigService.getGoogleMeetInstitutionalEmails(),
  ]);

  const convidados = [...new Set([...params.alunoEmails, ...instrutores.map((i) => i.email)])];

  const adicionaisSilenciosos = [
    ...new Set([...gestores.map((g) => g.email), ...institucionais]),
  ].filter((email) => !convidados.includes(email));

  return { convidados, adicionaisSilenciosos };
}
