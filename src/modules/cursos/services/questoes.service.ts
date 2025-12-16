import { CursosTipoQuestao, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const questoesLogger = logger.child({ module: 'CursosQuestoesService' });

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
): Promise<void> => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId },
    select: { id: true },
  });

  if (!turma) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

const ensureProvaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  provaId: string,
): Promise<void> => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId, CursosTurmas: { cursoId } },
    select: { id: true },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada para a turma informada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }
};

const ensureQuestaoBelongsToProva = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  provaId: string,
  questaoId: string,
): Promise<void> => {
  await ensureProvaBelongsToTurma(client, cursoId, turmaId, provaId);

  const questao = await client.cursosTurmasProvasQuestoes.findFirst({
    where: { id: questaoId, provaId },
    select: { id: true },
  });

  if (!questao) {
    const error = new Error('Questão não encontrada para a prova informada');
    (error as any).code = 'QUESTAO_NOT_FOUND';
    throw error;
  }
};

const ensureInscricaoBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  inscricaoId: string,
): Promise<void> => {
  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: { id: inscricaoId, turmaId },
    select: { id: true },
  });

  if (!inscricao) {
    const error = new Error('Inscrição não encontrada para a turma informada');
    (error as any).code = 'INSCRICAO_NOT_FOUND';
    throw error;
  }
};

const toDecimal = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }
  return new Prisma.Decimal(value);
};

export const questoesService = {
  async list(cursoId: string, turmaId: string, provaId: string) {
    await ensureProvaBelongsToTurma(prisma, cursoId, turmaId, provaId);

    const questoes = await prisma.cursosTurmasProvasQuestoes.findMany({
      where: { provaId },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      include: {
        CursosTurmasProvasQuestoesAlternativas: {
          orderBy: { ordem: 'asc' },
        },
      },
    });

    return questoes.map((questao) => ({
      id: questao.id,
      provaId: questao.provaId,
      enunciado: questao.enunciado,
      tipo: questao.tipo,
      ordem: questao.ordem,
      peso: questao.peso ? Number(questao.peso) : null,
      obrigatoria: questao.obrigatoria,
      criadoEm: questao.criadoEm.toISOString(),
      atualizadoEm: questao.atualizadoEm.toISOString(),
      alternativas:
        questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA
          ? questao.CursosTurmasProvasQuestoesAlternativas.map((alt) => ({
              id: alt.id,
              questaoId: alt.questaoId,
              texto: alt.texto,
              ordem: alt.ordem,
              correta: alt.correta,
              criadoEm: alt.criadoEm.toISOString(),
              atualizadoEm: alt.atualizadoEm.toISOString(),
            }))
          : undefined,
    }));
  },

  async get(cursoId: string, turmaId: string, provaId: string, questaoId: string) {
    await ensureQuestaoBelongsToProva(prisma, cursoId, turmaId, provaId, questaoId);

    const questao = await prisma.cursosTurmasProvasQuestoes.findUnique({
      where: { id: questaoId },
      include: {
        CursosTurmasProvasQuestoesAlternativas: {
          orderBy: { ordem: 'asc' },
        },
      },
    });

    if (!questao) {
      const error = new Error('Questão não encontrada');
      (error as any).code = 'QUESTAO_NOT_FOUND';
      throw error;
    }

    return {
      id: questao.id,
      provaId: questao.provaId,
      enunciado: questao.enunciado,
      tipo: questao.tipo,
      ordem: questao.ordem,
      peso: questao.peso ? Number(questao.peso) : null,
      obrigatoria: questao.obrigatoria,
      criadoEm: questao.criadoEm.toISOString(),
      atualizadoEm: questao.atualizadoEm.toISOString(),
      alternativas:
        questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA
          ? questao.CursosTurmasProvasQuestoesAlternativas.map((alt) => ({
              id: alt.id,
              questaoId: alt.questaoId,
              texto: alt.texto,
              ordem: alt.ordem,
              correta: alt.correta,
              criadoEm: alt.criadoEm.toISOString(),
              atualizadoEm: alt.atualizadoEm.toISOString(),
            }))
          : undefined,
    };
  },

  async create(
    cursoId: string,
    turmaId: string,
    provaId: string,
    data: {
      enunciado: string;
      tipo: CursosTipoQuestao;
      ordem?: number | null;
      peso?: number | null;
      obrigatoria?: boolean;
      alternativas?: Array<{
        texto: string;
        ordem?: number | null;
        correta?: boolean;
      }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureProvaBelongsToTurma(tx, cursoId, turmaId, provaId);

      const ordem =
        data.ordem ??
        (await tx.cursosTurmasProvasQuestoes.count({ where: { provaId } })) + 1;

      const questao = await tx.cursosTurmasProvasQuestoes.create({
        data: {
          provaId,
          enunciado: data.enunciado,
          tipo: data.tipo,
          ordem,
          peso: toDecimal(data.peso),
          obrigatoria: data.obrigatoria ?? true,
        },
      });

      if (data.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA && data.alternativas) {
        for (let i = 0; i < data.alternativas.length; i += 1) {
          const alt = data.alternativas[i];
          await tx.cursosTurmasProvasQuestoesAlternativas.create({
            data: {
              questaoId: questao.id,
              texto: alt.texto,
              ordem: alt.ordem ?? i + 1,
              correta: alt.correta ?? false,
            },
          });
        }
      }

      questoesLogger.info({ turmaId, provaId, questaoId: questao.id }, 'Questão criada');

      return this.get(cursoId, turmaId, provaId, questao.id);
    });
  },

  async update(
    cursoId: string,
    turmaId: string,
    provaId: string,
    questaoId: string,
    data: {
      enunciado?: string;
      tipo?: CursosTipoQuestao;
      ordem?: number | null;
      peso?: number | null;
      obrigatoria?: boolean;
      alternativas?: Array<{
        id?: string;
        texto: string;
        ordem?: number | null;
        correta?: boolean;
      }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureQuestaoBelongsToProva(tx, cursoId, turmaId, provaId, questaoId);

      const questaoAtual = await tx.cursosTurmasProvasQuestoes.findUnique({
        where: { id: questaoId },
        select: { tipo: true },
      });

      if (!questaoAtual) {
        const error = new Error('Questão não encontrada');
        (error as any).code = 'QUESTAO_NOT_FOUND';
        throw error;
      }

      await tx.cursosTurmasProvasQuestoes.update({
        where: { id: questaoId },
        data: {
          enunciado: data.enunciado ?? undefined,
          tipo: data.tipo ?? undefined,
          ordem: data.ordem ?? undefined,
          peso: data.peso !== undefined ? toDecimal(data.peso) : undefined,
          obrigatoria: data.obrigatoria ?? undefined,
        },
      });

      if (data.alternativas !== undefined) {
        const tipoFinal = data.tipo ?? questaoAtual.tipo;

        if (tipoFinal === CursosTipoQuestao.MULTIPLA_ESCOLHA) {
          // Remover alternativas existentes que não estão na lista
          const idsManter = data.alternativas
            .map((alt) => alt.id)
            .filter((id): id is string => id !== undefined);

          await tx.cursosTurmasProvasQuestoesAlternativas.deleteMany({
            where: {
              questaoId,
              id: { notIn: idsManter.length > 0 ? idsManter : [] },
            },
          });

          // Criar ou atualizar alternativas
          for (let i = 0; i < data.alternativas.length; i += 1) {
            const alt = data.alternativas[i];
            const ordemAlt = alt.ordem ?? i + 1;

            if (alt.id) {
              await tx.cursosTurmasProvasQuestoesAlternativas.update({
                where: { id: alt.id },
                data: {
                  texto: alt.texto,
                  ordem: ordemAlt,
                  correta: alt.correta ?? false,
                },
              });
            } else {
              await tx.cursosTurmasProvasQuestoesAlternativas.create({
                data: {
                  questaoId,
                  texto: alt.texto,
                  ordem: ordemAlt,
                  correta: alt.correta ?? false,
                },
              });
            }
          }
        } else {
          // Se mudou para outro tipo, remover todas as alternativas
          await tx.cursosTurmasProvasQuestoesAlternativas.deleteMany({
            where: { questaoId },
          });
        }
      }

      questoesLogger.info({ turmaId, provaId, questaoId }, 'Questão atualizada');

      return this.get(cursoId, turmaId, provaId, questaoId);
    });
  },

  async remove(cursoId: string, turmaId: string, provaId: string, questaoId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureQuestaoBelongsToProva(tx, cursoId, turmaId, provaId, questaoId);

      await tx.cursosTurmasProvasQuestoes.delete({ where: { id: questaoId } });

      questoesLogger.info({ turmaId, provaId, questaoId }, 'Questão removida');

      return { success: true } as const;
    });
  },

  async responder(
    cursoId: string,
    turmaId: string,
    provaId: string,
    questaoId: string,
    inscricaoId: string,
    data: {
      respostaTexto?: string | null;
      alternativaId?: string | null;
      anexoUrl?: string | null;
      anexoNome?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureQuestaoBelongsToProva(tx, cursoId, turmaId, provaId, questaoId);
      await ensureInscricaoBelongsToTurma(tx, turmaId, inscricaoId);

      const questao = await tx.cursosTurmasProvasQuestoes.findUnique({
        where: { id: questaoId },
        select: { tipo: true },
      });

      if (!questao) {
        const error = new Error('Questão não encontrada');
        (error as any).code = 'QUESTAO_NOT_FOUND';
        throw error;
      }

      // Validar tipo de resposta
      if (questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA && !data.alternativaId) {
        const error = new Error('Questão de múltipla escolha requer alternativaId');
        (error as any).code = 'VALIDATION_ERROR';
        throw error;
      }

      if (questao.tipo === CursosTipoQuestao.TEXTO && !data.respostaTexto) {
        const error = new Error('Questão de texto requer respostaTexto');
        (error as any).code = 'VALIDATION_ERROR';
        throw error;
      }

      if (questao.tipo === CursosTipoQuestao.ANEXO && !data.anexoUrl) {
        const error = new Error('Questão de anexo requer anexoUrl');
        (error as any).code = 'VALIDATION_ERROR';
        throw error;
      }

      // Buscar envio se existir
      const envio = await tx.cursosTurmasProvasEnvios.findUnique({
        where: {
          provaId_inscricaoId: {
            provaId,
            inscricaoId,
          },
        },
        select: { id: true },
      });

      const resposta = await tx.cursosTurmasProvasRespostas.upsert({
        where: {
          questaoId_inscricaoId: {
            questaoId,
            inscricaoId,
          },
        },
        update: {
          respostaTexto: data.respostaTexto ?? undefined,
          alternativaId: data.alternativaId ?? undefined,
          anexoUrl: data.anexoUrl ?? undefined,
          anexoNome: data.anexoNome ?? undefined,
          envioId: envio?.id ?? undefined,
        },
        create: {
          questaoId,
          inscricaoId,
          respostaTexto: data.respostaTexto ?? null,
          alternativaId: data.alternativaId ?? null,
          anexoUrl: data.anexoUrl ?? null,
          anexoNome: data.anexoNome ?? null,
          envioId: envio?.id ?? null,
        },
      });

      questoesLogger.info(
        { turmaId, provaId, questaoId, inscricaoId, respostaId: resposta.id },
        'Resposta registrada',
      );

      return {
        id: resposta.id,
        questaoId: resposta.questaoId,
        inscricaoId: resposta.inscricaoId,
        respostaTexto: resposta.respostaTexto,
        alternativaId: resposta.alternativaId,
        anexoUrl: resposta.anexoUrl,
        anexoNome: resposta.anexoNome,
        corrigida: resposta.corrigida,
        nota: resposta.nota ? Number(resposta.nota) : null,
        observacoes: resposta.observacoes,
        criadoEm: resposta.criadoEm.toISOString(),
        atualizadoEm: resposta.atualizadoEm.toISOString(),
      };
    });
  },

  async corrigir(
    cursoId: string,
    turmaId: string,
    provaId: string,
    questaoId: string,
    inscricaoId: string,
    data: {
      nota?: number | null;
      observacoes?: string | null;
      corrigida?: boolean;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureQuestaoBelongsToProva(tx, cursoId, turmaId, provaId, questaoId);
      await ensureInscricaoBelongsToTurma(tx, turmaId, inscricaoId);

      const resposta = await tx.cursosTurmasProvasRespostas.findUnique({
        where: {
          questaoId_inscricaoId: {
            questaoId,
            inscricaoId,
          },
        },
      });

      if (!resposta) {
        const error = new Error('Resposta não encontrada');
        (error as any).code = 'RESPOSTA_NOT_FOUND';
        throw error;
      }

      const respostaAtualizada = await tx.cursosTurmasProvasRespostas.update({
        where: { id: resposta.id },
        data: {
          nota: data.nota !== undefined ? toDecimal(data.nota) : undefined,
          observacoes: data.observacoes ?? undefined,
          corrigida: data.corrigida ?? true,
        },
      });

      questoesLogger.info(
        { turmaId, provaId, questaoId, inscricaoId },
        'Resposta corrigida',
      );

      return {
        id: respostaAtualizada.id,
        questaoId: respostaAtualizada.questaoId,
        inscricaoId: respostaAtualizada.inscricaoId,
        respostaTexto: respostaAtualizada.respostaTexto,
        alternativaId: respostaAtualizada.alternativaId,
        anexoUrl: respostaAtualizada.anexoUrl,
        anexoNome: respostaAtualizada.anexoNome,
        corrigida: respostaAtualizada.corrigida,
        nota: respostaAtualizada.nota ? Number(respostaAtualizada.nota) : null,
        observacoes: respostaAtualizada.observacoes,
        criadoEm: respostaAtualizada.criadoEm.toISOString(),
        atualizadoEm: respostaAtualizada.atualizadoEm.toISOString(),
      };
    });
  },

  async listarRespostas(
    cursoId: string,
    turmaId: string,
    provaId: string,
    questaoId?: string,
    inscricaoId?: string,
  ) {
    await ensureProvaBelongsToTurma(prisma, cursoId, turmaId, provaId);

    const respostas = await prisma.cursosTurmasProvasRespostas.findMany({
      where: {
        CursosTurmasProvasQuestoes: {
          provaId,
          ...(questaoId ? { id: questaoId } : {}),
        },
        ...(inscricaoId ? { inscricaoId } : {}),
      },
      include: {
        CursosTurmasProvasQuestoes: {
          select: {
            id: true,
            enunciado: true,
            tipo: true,
          },
        },
        CursosTurmasProvasQuestoesAlternativas: {
          select: {
            id: true,
            texto: true,
            correta: true,
          },
        },
      },
      orderBy: [{ criadoEm: 'desc' }],
    });

    return respostas.map((resposta) => ({
      id: resposta.id,
      questaoId: resposta.questaoId,
      questao: {
        id: resposta.CursosTurmasProvasQuestoes.id,
        enunciado: resposta.CursosTurmasProvasQuestoes.enunciado,
        tipo: resposta.CursosTurmasProvasQuestoes.tipo,
      },
      inscricaoId: resposta.inscricaoId,
      respostaTexto: resposta.respostaTexto,
      alternativa: resposta.CursosTurmasProvasQuestoesAlternativas
        ? {
            id: resposta.CursosTurmasProvasQuestoesAlternativas.id,
            texto: resposta.CursosTurmasProvasQuestoesAlternativas.texto,
            correta: resposta.CursosTurmasProvasQuestoesAlternativas.correta,
          }
        : null,
      anexoUrl: resposta.anexoUrl,
      anexoNome: resposta.anexoNome,
      corrigida: resposta.corrigida,
      nota: resposta.nota ? Number(resposta.nota) : null,
      observacoes: resposta.observacoes,
      criadoEm: resposta.criadoEm.toISOString(),
      atualizadoEm: resposta.atualizadoEm.toISOString(),
    }));
  },
};

