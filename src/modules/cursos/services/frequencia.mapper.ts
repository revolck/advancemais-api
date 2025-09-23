import { Prisma } from '@prisma/client';

export const frequenciaWithRelations = Prisma.validator<Prisma.CursosFrequenciaAlunosDefaultArgs>()({
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
});

export type FrequenciaWithRelations = Prisma.CursosFrequenciaAlunosGetPayload<typeof frequenciaWithRelations>;

export const mapFrequencia = (frequencia: FrequenciaWithRelations) => ({
  id: frequencia.id,
  turmaId: frequencia.turmaId,
  matriculaId: frequencia.matriculaId,
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
  matricula: frequencia.matricula
    ? {
        id: frequencia.matricula.id,
        alunoId: frequencia.matricula.alunoId,
        aluno: frequencia.matricula.aluno
          ? {
              id: frequencia.matricula.aluno.id,
              nome: frequencia.matricula.aluno.nomeCompleto,
              email: frequencia.matricula.aluno.email,
            }
          : null,
      }
    : null,
});
