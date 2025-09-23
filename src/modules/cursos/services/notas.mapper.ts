import { Prisma } from '@prisma/client';

export const notaWithRelations = Prisma.validator<Prisma.CursosNotasDefaultArgs>()({
  include: {
    matricula: {
      select: {
        id: true,
        alunoId: true,
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    },
    prova: {
      select: {
        id: true,
        titulo: true,
        etiqueta: true,
      },
    },
  },
});

export type NotaWithRelations = Prisma.CursosNotasGetPayload<typeof notaWithRelations>;

const normalizeDecimal = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

export const mapNota = (nota: NotaWithRelations) => ({
  id: nota.id,
  turmaId: nota.turmaId,
  matriculaId: nota.matriculaId,
  tipo: nota.tipo,
  referenciaExterna: nota.referenciaExterna ?? null,
  titulo: nota.titulo,
  descricao: nota.descricao ?? null,
  nota: normalizeDecimal(nota.nota),
  peso: normalizeDecimal(nota.peso),
  valorMaximo: normalizeDecimal(nota.valorMaximo),
  dataReferencia: nota.dataReferencia?.toISOString() ?? null,
  observacoes: nota.observacoes ?? null,
  criadoEm: nota.criadoEm.toISOString(),
  atualizadoEm: nota.atualizadoEm.toISOString(),
  prova: nota.prova
    ? {
        id: nota.prova.id,
        titulo: nota.prova.titulo,
        etiqueta: nota.prova.etiqueta,
      }
    : null,
  matricula: nota.matricula
    ? {
        id: nota.matricula.id,
        alunoId: nota.matricula.alunoId,
        aluno: nota.matricula.aluno
          ? {
              id: nota.matricula.aluno.id,
              nome: nota.matricula.aluno.nomeCompleto,
              email: nota.matricula.aluno.email,
            }
          : null,
      }
    : null,
});
