import { Prisma } from '@prisma/client';

export const frequenciaWithRelations = Prisma.validator<Prisma.CursosFrequenciaAlunosDefaultArgs>()(
  {
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
      CursosTurmasAulas: {
        select: {
          id: true,
          nome: true,
          ordem: true,
          moduloId: true,
          CursosTurmasModulos: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      },
    },
  },
);

export type FrequenciaWithRelations = Prisma.CursosFrequenciaAlunosGetPayload<
  typeof frequenciaWithRelations
>;

export const mapFrequencia = (frequencia: FrequenciaWithRelations) => ({
  id: frequencia.id,
  turmaId: frequencia.turmaId,
  inscricaoId: frequencia.inscricaoId,
  aulaId: frequencia.aulaId,
  dataReferencia: frequencia.dataReferencia.toISOString(),
  status: frequencia.status,
  justificativa: frequencia.justificativa ?? null,
  observacoes: frequencia.observacoes ?? null,
  criadoEm: frequencia.criadoEm.toISOString(),
  atualizadoEm: frequencia.atualizadoEm.toISOString(),
  aula: frequencia.CursosTurmasAulas
    ? {
        id: frequencia.CursosTurmasAulas.id,
        nome: frequencia.CursosTurmasAulas.nome,
        ordem: frequencia.CursosTurmasAulas.ordem,
        moduloId: frequencia.CursosTurmasAulas.moduloId,
        modulo: frequencia.CursosTurmasAulas.CursosTurmasModulos
          ? {
              id: frequencia.CursosTurmasAulas.CursosTurmasModulos.id,
              nome: frequencia.CursosTurmasAulas.CursosTurmasModulos.nome,
            }
          : null,
      }
    : null,
  inscricao: frequencia.CursosTurmasInscricoes
    ? {
        id: frequencia.CursosTurmasInscricoes.id,
        alunoId: frequencia.CursosTurmasInscricoes.alunoId,
        aluno: frequencia.CursosTurmasInscricoes.Usuarios
          ? {
              id: frequencia.CursosTurmasInscricoes.Usuarios.id,
              nome: frequencia.CursosTurmasInscricoes.Usuarios.nomeCompleto,
              email: frequencia.CursosTurmasInscricoes.Usuarios.email,
            }
          : null,
      }
    : null,
});
