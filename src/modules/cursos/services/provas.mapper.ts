import { Prisma } from '@prisma/client';

export const provaDefaultInclude = Prisma.validator<Prisma.CursosTurmasProvasDefaultArgs>()({
  include: {
    modulo: {
      select: {
        id: true,
        nome: true,
      },
    },
  },
});

export const provaWithEnviosInclude = Prisma.validator<Prisma.CursosTurmasProvasDefaultArgs>()({
  include: {
    modulo: {
      select: {
        id: true,
        nome: true,
      },
    },
    envios: {
      include: {
        matricula: {
          select: {
            id: true,
            alunoId: true,
          },
        },
      },
      orderBy: [{ criadoEm: 'desc' }],
    },
  },
});

export type ProvaWithModulo = Prisma.CursosTurmasProvasGetPayload<typeof provaDefaultInclude>;
export type ProvaWithEnvios = Prisma.CursosTurmasProvasGetPayload<typeof provaWithEnviosInclude>;

const normalizeDecimal = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

export const mapProva = (prova: ProvaWithModulo | ProvaWithEnvios) => ({
  id: prova.id,
  turmaId: prova.turmaId,
  moduloId: prova.moduloId ?? null,
  titulo: prova.titulo,
  etiqueta: prova.etiqueta,
  descricao: prova.descricao ?? null,
  peso: normalizeDecimal(prova.peso) ?? 0,
  ativo: prova.ativo,
  localizacao: prova.localizacao,
  ordem: prova.ordem,
  criadoEm: prova.criadoEm.toISOString(),
  atualizadoEm: prova.atualizadoEm.toISOString(),
  modulo: prova.modulo
    ? {
        id: prova.modulo.id,
        nome: prova.modulo.nome,
      }
    : null,
  envios: 'envios' in prova && Array.isArray(prova.envios)
    ? prova.envios.map((envio) => ({
        id: envio.id,
        provaId: envio.provaId,
        matriculaId: envio.matriculaId,
        alunoId: envio.matricula.alunoId,
        nota: normalizeDecimal(envio.nota),
        pesoTotal: normalizeDecimal(envio.pesoTotal),
        realizadoEm: envio.realizadoEm?.toISOString() ?? null,
        observacoes: envio.observacoes ?? null,
        criadoEm: envio.criadoEm.toISOString(),
        atualizadoEm: envio.atualizadoEm.toISOString(),
      }))
    : undefined,
});
