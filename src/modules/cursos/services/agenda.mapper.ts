import { Prisma } from '@prisma/client';

export const agendaWithRelations = Prisma.validator<Prisma.CursosTurmasAgendaDefaultArgs>()({
  include: {
    turma: {
      select: {
        id: true,
        nome: true,
        codigo: true,
        cursoId: true,
        curso: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    },
    aula: {
      select: {
        id: true,
        nome: true,
        ordem: true,
        moduloId: true,
      },
    },
    prova: {
      select: {
        id: true,
        titulo: true,
        etiqueta: true,
        moduloId: true,
      },
    },
  },
});

export type AgendaWithRelations = Prisma.CursosTurmasAgendaGetPayload<typeof agendaWithRelations>;

export const mapAgendaItem = (agenda: AgendaWithRelations) => ({
  id: agenda.id,
  turmaId: agenda.turmaId,
  tipo: agenda.tipo,
  titulo: agenda.titulo,
  descricao: agenda.descricao ?? null,
  inicio: agenda.inicio.toISOString(),
  fim: agenda.fim?.toISOString() ?? null,
  criadoEm: agenda.criadoEm.toISOString(),
  atualizadoEm: agenda.atualizadoEm.toISOString(),
  turma: agenda.turma
    ? {
        id: agenda.turma.id,
        nome: agenda.turma.nome,
        codigo: agenda.turma.codigo,
        cursoId: agenda.turma.cursoId,
        curso: agenda.turma.curso
          ? {
              id: agenda.turma.curso.id,
              nome: agenda.turma.curso.nome,
            }
          : null,
      }
    : null,
  referencia: agenda.aula
    ? {
        tipo: 'AULA' as const,
        id: agenda.aula.id,
        nome: agenda.aula.nome,
        moduloId: agenda.aula.moduloId ?? null,
        ordem: agenda.aula.ordem,
      }
    : agenda.prova
      ? {
          tipo: 'PROVA' as const,
          id: agenda.prova.id,
          titulo: agenda.prova.titulo,
          etiqueta: agenda.prova.etiqueta,
          moduloId: agenda.prova.moduloId ?? null,
        }
      : null,
});
