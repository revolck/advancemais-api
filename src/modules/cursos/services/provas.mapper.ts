import { Prisma } from '@prisma/client';

export const provaDefaultInclude = Prisma.validator<Prisma.CursosTurmasProvasDefaultArgs>()({
  include: {},
});

export const provaWithEnviosInclude = Prisma.validator<Prisma.CursosTurmasProvasDefaultArgs>()({
  include: {
    CursosTurmasProvasEnvios: {
      include: {
        CursosTurmasInscricoes: {
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

export type ProvaWithRelations = Prisma.CursosTurmasProvasGetPayload<typeof provaDefaultInclude>;
export type ProvaWithEnvios = Prisma.CursosTurmasProvasGetPayload<typeof provaWithEnviosInclude>;

const normalizeDecimal = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

export const mapProva = (prova: ProvaWithRelations | ProvaWithEnvios) => ({
  id: prova.id,
  turmaId: prova.turmaId,
  moduloId: prova.moduloId ?? null,
  titulo: prova.titulo,
  etiqueta: prova.etiqueta,
  descricao: prova.descricao ?? null,
  peso: normalizeDecimal(prova.peso) ?? 0,
  valePonto: prova.valePonto ?? true,
  ativo: prova.ativo,
  localizacao: prova.localizacao,
  ordem: prova.ordem,
  criadoEm: prova.criadoEm.toISOString(),
  atualizadoEm: prova.atualizadoEm.toISOString(),
  envios:
    'CursosTurmasProvasEnvios' in prova && Array.isArray(prova.CursosTurmasProvasEnvios)
      ? prova.CursosTurmasProvasEnvios.map((envio) => ({
          id: envio.id,
          provaId: envio.provaId,
          inscricaoId: envio.inscricaoId,
          alunoId: envio.CursosTurmasInscricoes.alunoId,
          nota: normalizeDecimal(envio.nota),
          pesoTotal: normalizeDecimal(envio.pesoTotal),
          realizadoEm: envio.realizadoEm?.toISOString() ?? null,
          observacoes: envio.observacoes ?? null,
          criadoEm: envio.criadoEm.toISOString(),
          atualizadoEm: envio.atualizadoEm.toISOString(),
        }))
      : undefined,
});
