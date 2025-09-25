import { Prisma } from '@prisma/client';

export const frequenciaWithRelations = Prisma.validator<Prisma.CursosFrequenciaAlunosDefaultArgs>()(
  {
    include: {
      inscricao: {
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
      aula: {
        select: {
          id: true,
          nome: true,
          ordem: true,
          moduloId: true,
          modulo: {
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
  aula: frequencia.aula
    ? {
        id: frequencia.aula.id,
        nome: frequencia.aula.nome,
        ordem: frequencia.aula.ordem,
        moduloId: frequencia.aula.moduloId,
        modulo: frequencia.aula.modulo
          ? {
              id: frequencia.aula.modulo.id,
              nome: frequencia.aula.modulo.nome,
            }
          : null,
      }
    : null,
  inscricao: frequencia.inscricao
    ? {
        id: frequencia.inscricao.id,
        alunoId: frequencia.inscricao.alunoId,
        aluno: frequencia.inscricao.aluno
          ? {
              id: frequencia.inscricao.aluno.id,
              nome: frequencia.inscricao.aluno.nomeCompleto,
              email: frequencia.inscricao.aluno.email,
            }
          : null,
      }
    : null,
});
