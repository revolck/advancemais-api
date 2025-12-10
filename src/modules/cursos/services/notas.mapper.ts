import { Prisma } from '@prisma/client';

export const notaWithRelations = Prisma.validator<Prisma.CursosNotasDefaultArgs>()({
  include: {
    CursosTurmasInscricoes: {
      select: {
        id: true,
        alunoId: true,
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    },
    CursosTurmasProvas: {
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
  inscricaoId: nota.inscricaoId,
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
  prova: nota.CursosTurmasProvas
    ? {
        id: nota.CursosTurmasProvas.id,
        titulo: nota.CursosTurmasProvas.titulo,
        etiqueta: nota.CursosTurmasProvas.etiqueta,
      }
    : null,
  inscricao: nota.CursosTurmasInscricoes
    ? {
        id: nota.CursosTurmasInscricoes.id,
        alunoId: nota.CursosTurmasInscricoes.alunoId,
        aluno: nota.CursosTurmasInscricoes.Usuarios
          ? {
              id: nota.CursosTurmasInscricoes.Usuarios.id,
              nome: nota.CursosTurmasInscricoes.Usuarios.nomeCompleto,
              email: nota.CursosTurmasInscricoes.Usuarios.email,
            }
          : null,
      }
    : null,
});
