import {
  AuditoriaCategoria,
  CursosAulaStatus,
  CursosNotasTipo,
  CursosTipoQuestao,
  Prisma,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { auditoriaService } from '@/modules/auditoria/services/auditoria.service';
import { logger } from '@/utils/logger';

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const questoesLogger = logger.child({ module: 'CursosQuestoesService' });

const ensureProvaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  provaId: string,
  options?: { forEdit?: boolean },
): Promise<void> => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId, CursosTurmas: { cursoId } },
    select: { id: true, status: true, turmaId: true },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada para a turma informada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }

  if (options?.forEdit && prova.turmaId && prova.status === CursosAulaStatus.PUBLICADA) {
    const error = new Error('Não é possível editar prova publicada vinculada a turma');
    (error as any).code = 'PROVA_PUBLICADA_LOCKED';
    throw error;
  }
};

const ensureQuestaoBelongsToProva = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  provaId: string,
  questaoId: string,
  options?: { forEdit?: boolean },
): Promise<void> => {
  await ensureProvaBelongsToTurma(client, cursoId, turmaId, provaId, options);

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

const toDecimalOptional = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  return new Prisma.Decimal(value);
};

const toOneDecimal = (value: number) => Math.round(value * 10) / 10;

const hasQuestaoResposta = (
  questaoTipo: CursosTipoQuestao,
  resposta: {
    alternativaId: string | null;
    respostaTexto: string | null;
    anexoUrl: string | null;
  } | null,
) => {
  if (!resposta) return false;
  if (questaoTipo === CursosTipoQuestao.MULTIPLA_ESCOLHA) {
    return Boolean(resposta.alternativaId);
  }
  if (questaoTipo === CursosTipoQuestao.TEXTO) {
    return Boolean(resposta.respostaTexto?.trim());
  }
  return Boolean(resposta.anexoUrl);
};

const calcularPesosNormalizados = (
  provaPeso: number,
  questoes: { peso: Prisma.Decimal | null }[],
) => {
  const pesosBase = questoes.map((questao) => Number(questao.peso ?? 0));
  const temPesoConfigurado = pesosBase.some((peso) => peso > 0);
  const pesosValidos = temPesoConfigurado ? pesosBase : questoes.map(() => 1);
  const somaPesos = pesosValidos.reduce((acc, peso) => acc + peso, 0);

  if (somaPesos <= 0 || questoes.length === 0) {
    return questoes.map(() => 0);
  }

  const escala = provaPeso > 0 ? provaPeso : somaPesos;
  return pesosValidos.map((peso) => (peso / somaPesos) * escala);
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
      alternativas?: {
        texto: string;
        ordem?: number | null;
        correta?: boolean;
      }[];
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureProvaBelongsToTurma(tx, cursoId, turmaId, provaId, { forEdit: true });

      const ordem =
        data.ordem ?? (await tx.cursosTurmasProvasQuestoes.count({ where: { provaId } })) + 1;

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
      alternativas?: {
        id?: string;
        texto: string;
        ordem?: number | null;
        correta?: boolean;
      }[];
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureQuestaoBelongsToProva(tx, cursoId, turmaId, provaId, questaoId, {
        forEdit: true,
      });

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
      await ensureQuestaoBelongsToProva(tx, cursoId, turmaId, provaId, questaoId, {
        forEdit: true,
      });

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
    contexto?: {
      usuarioId?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    const result = await prisma.$transaction(
      async (tx) => {
        await ensureQuestaoBelongsToProva(tx, cursoId, turmaId, provaId, questaoId);
        await ensureInscricaoBelongsToTurma(tx, turmaId, inscricaoId);
        let auditoriaAutoCorrecao: Parameters<typeof auditoriaService.registrarLog>[0] | null =
          null;

        const [questao, prova] = await Promise.all([
          tx.cursosTurmasProvasQuestoes.findUnique({
            where: { id: questaoId },
            select: { tipo: true },
          }),
          tx.cursosTurmasProvas.findUnique({
            where: { id: provaId },
            select: {
              id: true,
              tipo: true,
              titulo: true,
              descricao: true,
              peso: true,
            },
          }),
        ]);

        if (!prova) {
          const error = new Error('Prova não encontrada para a turma informada');
          (error as any).code = 'PROVA_NOT_FOUND';
          throw error;
        }

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

        // Buscar/criar envio para manter contexto único de submissão por prova+inscrição.
        const envio = await tx.cursosTurmasProvasEnvios.upsert({
          where: {
            provaId_inscricaoId: {
              provaId,
              inscricaoId,
            },
          },
          update: {},
          create: {
            provaId,
            inscricaoId,
            realizadoEm: null,
          },
          select: {
            id: true,
            realizadoEm: true,
          },
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
            envioId: envio.id,
          },
          create: {
            questaoId,
            inscricaoId,
            respostaTexto: data.respostaTexto ?? null,
            alternativaId: data.alternativaId ?? null,
            anexoUrl: data.anexoUrl ?? null,
            anexoNome: data.anexoNome ?? null,
            envioId: envio.id,
          },
        });

        if (prova.tipo === 'PROVA') {
          const questoesDaProva = await tx.cursosTurmasProvasQuestoes.findMany({
            where: { provaId },
            select: {
              id: true,
              tipo: true,
              obrigatoria: true,
              peso: true,
              CursosTurmasProvasQuestoesAlternativas: {
                where: { correta: true },
                select: { id: true },
                take: 1,
              },
            },
            orderBy: { ordem: 'asc' },
          });

          const respostasDaProva = await tx.cursosTurmasProvasRespostas.findMany({
            where: {
              inscricaoId,
              CursosTurmasProvasQuestoes: { provaId },
            },
            select: {
              id: true,
              questaoId: true,
              alternativaId: true,
              respostaTexto: true,
              anexoUrl: true,
            },
          });

          const respostasPorQuestao = new Map(
            respostasDaProva.map((respostaItem) => [respostaItem.questaoId, respostaItem]),
          );
          const pesosNormalizados = calcularPesosNormalizados(
            Number(prova.peso ?? 0),
            questoesDaProva.map((questaoItem) => ({ peso: questaoItem.peso })),
          );

          const updatesRespostas = respostasDaProva.map((respostaItem) => {
            const questaoDaResposta = questoesDaProva.find(
              (questaoItem) => questaoItem.id === respostaItem.questaoId,
            );
            if (!questaoDaResposta) {
              return null;
            }

            const indiceQuestao = questoesDaProva.findIndex(
              (questaoItem) => questaoItem.id === questaoDaResposta.id,
            );
            const pesoQuestao = pesosNormalizados[indiceQuestao] ?? 0;
            const alternativaCorretaId =
              questaoDaResposta.CursosTurmasProvasQuestoesAlternativas[0]?.id ?? null;
            const acertou =
              questaoDaResposta.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA &&
              alternativaCorretaId &&
              respostaItem.alternativaId === alternativaCorretaId;

            const notaItem = acertou ? toOneDecimal(pesoQuestao) : 0;

            return tx.cursosTurmasProvasRespostas.update({
              where: { id: respostaItem.id },
              data: {
                envioId: envio.id,
                corrigida: true,
                nota: toDecimal(notaItem),
              },
            });
          });

          await Promise.all(updatesRespostas.filter(Boolean) as Promise<unknown>[]);

          const todasObrigatoriasRespondidas = questoesDaProva
            .filter((questaoItem) => questaoItem.obrigatoria)
            .every((questaoItem) =>
              hasQuestaoResposta(questaoItem.tipo, respostasPorQuestao.get(questaoItem.id) ?? null),
            );

          if (todasObrigatoriasRespondidas) {
            const notaFinalRaw = questoesDaProva.reduce((acc, questaoItem, index) => {
              const respostaItem = respostasPorQuestao.get(questaoItem.id);
              if (!respostaItem) return acc;

              const alternativaCorretaId =
                questaoItem.CursosTurmasProvasQuestoesAlternativas[0]?.id ?? null;
              const acertou =
                questaoItem.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA &&
                alternativaCorretaId &&
                respostaItem.alternativaId === alternativaCorretaId;

              return acc + (acertou ? (pesosNormalizados[index] ?? 0) : 0);
            }, 0);

            const notaFinal = toOneDecimal(notaFinalRaw);
            const realizadoEm = envio.realizadoEm ?? new Date();

            await tx.cursosTurmasProvasEnvios.update({
              where: { id: envio.id },
              data: {
                nota: toDecimal(notaFinal),
                realizadoEm,
              },
            });

            await tx.cursosNotas.upsert({
              where: {
                inscricaoId_provaId: {
                  inscricaoId,
                  provaId,
                },
              },
              update: {
                nota: toDecimalOptional(notaFinal),
                peso: toDecimalOptional(Number(prova.peso ?? 0)),
                dataReferencia: realizadoEm,
                titulo: prova.titulo,
                descricao: prova.descricao ?? null,
              },
              create: {
                turmaId,
                inscricaoId,
                tipo: CursosNotasTipo.PROVA,
                provaId,
                titulo: prova.titulo,
                descricao: prova.descricao ?? null,
                nota: toDecimal(notaFinal),
                peso: toDecimal(Number(prova.peso ?? 0)),
                valorMaximo: null,
                dataReferencia: realizadoEm,
                observacoes: null,
              },
            });

            if (contexto?.usuarioId) {
              auditoriaAutoCorrecao = {
                categoria: AuditoriaCategoria.CURSO,
                tipo: 'PROVA_CORRECAO',
                acao: 'CORRECAO_AUTOMATICA',
                usuarioId: contexto.usuarioId,
                entidadeId: envio.id,
                entidadeTipo: 'PROVA_RESPOSTA',
                descricao: `Correcao automatica da prova concluida. Nota final: ${notaFinal.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                dadosAnteriores: {
                  avaliacaoId: provaId,
                  inscricaoId,
                },
                dadosNovos: {
                  avaliacaoId: provaId,
                  inscricaoId,
                  statusCorrecao: 'CORRIGIDA',
                  nota: notaFinal,
                  corrigidoPor: 'SISTEMA',
                  corrigidoEm: realizadoEm.toISOString(),
                },
                metadata: {
                  avaliacaoId: provaId,
                  inscricaoId,
                  tipoAvaliacao: 'PROVA',
                  statusCorrecao: 'CORRIGIDA',
                  notaFinal,
                  corrigidoAutomaticamente: true,
                },
                ip: contexto.ip,
                userAgent: contexto.userAgent,
              };
            }
          }
        }

        questoesLogger.info(
          { turmaId, provaId, questaoId, inscricaoId, respostaId: resposta.id },
          'Resposta registrada',
        );

        return {
          auditoriaAutoCorrecao,
          resposta: {
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
          },
        };
      },
      { timeout: 15000, maxWait: 5000 },
    );

    if (result.auditoriaAutoCorrecao) {
      await auditoriaService.registrarLog(result.auditoriaAutoCorrecao);
    }

    return result.resposta;
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

      questoesLogger.info({ turmaId, provaId, questaoId, inscricaoId }, 'Resposta corrigida');

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
