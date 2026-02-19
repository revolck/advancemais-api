import { Prisma } from '@prisma/client';

export const provaDefaultInclude = Prisma.validator<Prisma.CursosTurmasProvasDefaultArgs>()({
  include: {
    Cursos: {
      select: {
        id: true,
        nome: true,
      },
    },
    Usuarios: {
      select: {
        id: true,
        nomeCompleto: true,
      },
    },
  },
});

export const provaWithEnviosInclude = Prisma.validator<Prisma.CursosTurmasProvasDefaultArgs>()({
  include: {
    Cursos: {
      select: {
        id: true,
        nome: true,
      },
    },
    Usuarios: {
      select: {
        id: true,
        nomeCompleto: true,
      },
    },
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

export const provaWithEnviosAndQuestoesInclude =
  Prisma.validator<Prisma.CursosTurmasProvasDefaultArgs>()({
    include: {
      Cursos: {
        select: {
          id: true,
          nome: true,
        },
      },
      Usuarios: {
        select: {
          id: true,
          nomeCompleto: true,
        },
      },
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
      CursosTurmasProvasQuestoes: {
        orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
        include: {
          CursosTurmasProvasQuestoesAlternativas: {
            orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
          },
        },
      },
    },
  });

export type ProvaWithRelations = Prisma.CursosTurmasProvasGetPayload<typeof provaDefaultInclude>;
export type ProvaWithEnvios = Prisma.CursosTurmasProvasGetPayload<typeof provaWithEnviosInclude>;
export type ProvaWithEnviosAndQuestoes = Prisma.CursosTurmasProvasGetPayload<
  typeof provaWithEnviosAndQuestoesInclude
>;

const normalizeDecimal = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

export const mapProva = (
  prova: ProvaWithRelations | ProvaWithEnvios | ProvaWithEnviosAndQuestoes,
  criadoPor?: {
    nome: string | null;
    avatarUrl: string | null;
    cpf: string | null;
  } | null,
) => {
  const questoes =
    'CursosTurmasProvasQuestoes' in prova && Array.isArray(prova.CursosTurmasProvasQuestoes)
      ? prova.CursosTurmasProvasQuestoes.map((questao) => {
          const alternativasOrdenadas = [...questao.CursosTurmasProvasQuestoesAlternativas].sort(
            (a, b) => a.ordem - b.ordem,
          );

          const alternativasNormalizadas =
            questao.tipo === 'MULTIPLA_ESCOLHA'
              ? (() => {
                  let corretaIndex = alternativasOrdenadas.findIndex((alt) => alt.correta);
                  if (corretaIndex < 0 && alternativasOrdenadas.length > 0) {
                    corretaIndex = 0;
                  }

                  return alternativasOrdenadas.map((alt, index) => ({
                    id: alt.id,
                    questaoId: alt.questaoId,
                    texto: alt.texto,
                    ordem: alt.ordem,
                    correta: index === corretaIndex,
                  }));
                })()
              : [];

          return {
            id: questao.id,
            provaId: questao.provaId,
            enunciado: questao.enunciado,
            tipo: questao.tipo,
            ordem: questao.ordem,
            peso: normalizeDecimal(questao.peso),
            obrigatoria: questao.obrigatoria,
            alternativas: alternativasNormalizadas,
          };
        })
      : [];

  return {
    id: prova.id,
    cursoId: (prova as any).cursoId ?? null,
    turmaId: prova.turmaId,
    moduloId: prova.moduloId ?? null,
    tipo: (prova as any).tipo ?? 'PROVA',
    recuperacaoFinal: (prova as any).recuperacaoFinal ?? false,
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
    // Campos para visão geral
    nome: prova.titulo,
    curso: prova.Cursos?.nome ?? null,
    status: prova.ativo ? 'ATIVO' : 'INATIVO',
    data: prova.criadoEm.toISOString(),
    pesoNota: normalizeDecimal(prova.peso) ?? 0,
    criadoPor: criadoPor
      ? {
          nome: criadoPor.nome ?? null,
          avatarUrl: criadoPor.avatarUrl ?? null,
          cpf: criadoPor.cpf ?? null,
        }
      : null,
    questoes,
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
  };
};
