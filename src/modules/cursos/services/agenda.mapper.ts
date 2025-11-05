import { Prisma } from '@prisma/client';

export const agendaWithRelations = Prisma.validator<Prisma.CursosTurmasAgendaDefaultArgs>()({
  include: {
    CursosTurmas: {
      select: {
        id: true,
        nome: true,
        codigo: true,
        cursoId: true,
        Cursos: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    },
    CursosTurmasAulas: {
      select: {
        id: true,
        nome: true,
        ordem: true,
        moduloId: true,
      },
    },
    CursosTurmasProvas: {
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
  turma: agenda.CursosTurmas
    ? {
        id: agenda.CursosTurmas.id,
        nome: agenda.CursosTurmas.nome,
        codigo: agenda.CursosTurmas.codigo,
        cursoId: agenda.CursosTurmas.cursoId,
        curso: agenda.CursosTurmas.Cursos
          ? {
              id: agenda.CursosTurmas.Cursos.id,
              nome: agenda.CursosTurmas.Cursos.nome,
            }
          : null,
      }
    : null,
  referencia: agenda.CursosTurmasAulas
    ? {
        tipo: 'AULA' as const,
        id: agenda.CursosTurmasAulas.id,
        nome: agenda.CursosTurmasAulas.nome,
        moduloId: agenda.CursosTurmasAulas.moduloId ?? null,
        ordem: agenda.CursosTurmasAulas.ordem,
      }
    : agenda.CursosTurmasProvas
      ? {
          tipo: 'PROVA' as const,
          id: agenda.CursosTurmasProvas.id,
          titulo: agenda.CursosTurmasProvas.titulo,
          etiqueta: agenda.CursosTurmasProvas.etiqueta,
          moduloId: agenda.CursosTurmasProvas.moduloId ?? null,
        }
      : null,
});
