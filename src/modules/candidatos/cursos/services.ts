/**
 * Service de Cursos para ALUNO_CANDIDATO
 *
 * Retorna:
 * - Próxima aula (se houver)
 * - Lista de cursos com paginação (8 por página)
 * - Filtros por modalidade (Todos, Online, Ao Vivo, Presencial, Semi-presencial)
 */

import { prisma } from '@/config/prisma';
import {
  CursosAulaStatus,
  CursosAvaliacaoTipo,
  CursosMetodos,
  CursosTipoQuestao,
  Prisma,
  StatusInscricao,
} from '@prisma/client';
import { logger } from '@/utils/logger';
import { combinarDataHoraAvaliacao, obterLiberacaoGabarito } from '@/modules/cursos/utils/gabarito';
import { calcularProgressoCurso } from './progresso';

const cursosLogger = logger.child({ module: 'CandidatoCursosService' });

const STATUS_PAGAMENTO_LIBERADO = 'APROVADO';

const STATUS_INSCRICAO_LISTAGEM_LIBERADA: StatusInscricao[] = [
  StatusInscricao.INSCRITO,
  StatusInscricao.EM_ANDAMENTO,
  StatusInscricao.EM_ESTAGIO,
  StatusInscricao.CONCLUIDO,
];

const STATUS_INSCRICAO_PROXIMA_AULA: StatusInscricao[] = [
  StatusInscricao.INSCRITO,
  StatusInscricao.EM_ANDAMENTO,
  StatusInscricao.EM_ESTAGIO,
];

const MAX_ATIVIDADE_EDICOES = 3;
const MAX_ATIVIDADE_ENVIOS = MAX_ATIVIDADE_EDICOES + 1;

type AtividadeRespostaInput = {
  questaoId: string;
  respostaTexto?: string | null;
  alternativaId?: string | null;
  anexoUrl?: string | null;
  anexoNome?: string | null;
};

const resolveAtividadeEdicao = (
  envio?: {
    tentativasEnvio: number;
    bloqueadoEdicaoEm: Date | null;
    nota: Prisma.Decimal | null;
    atualizadoEm?: Date | null;
    CursosTurmasProvasRespostas: { corrigida: boolean }[];
  } | null,
) => {
  const tentativasEnvio = envio?.tentativasEnvio ?? 0;
  const edicoesRealizadas = Math.max(0, tentativasEnvio - 1);
  const corrigida = Boolean(
    envio?.bloqueadoEdicaoEm ||
      (envio?.nota !== null && envio?.nota !== undefined) ||
      envio?.CursosTurmasProvasRespostas.some((resposta) => resposta.corrigida),
  );
  const limiteAtingido = tentativasEnvio >= MAX_ATIVIDADE_ENVIOS;

  return {
    tentativasEnvio,
    tentativasRestantes: Math.max(0, MAX_ATIVIDADE_ENVIOS - tentativasEnvio),
    limiteEnvios: MAX_ATIVIDADE_ENVIOS,
    edicoesRealizadas,
    edicoesRestantes: Math.max(0, MAX_ATIVIDADE_EDICOES - edicoesRealizadas),
    limiteEdicoes: MAX_ATIVIDADE_EDICOES,
    ultimaEdicaoEm: edicoesRealizadas > 0 ? toIso(envio?.atualizadoEm) : null,
    corrigida,
    podeEditar: !corrigida && !limiteAtingido,
    bloqueioMotivo: corrigida ? 'CORRIGIDA' : limiteAtingido ? 'LIMITE_ATINGIDO' : null,
  } as const;
};

const mapAtividadeDetalheAluno = (atividade: any) => {
  const envio = atividade.CursosTurmasProvasEnvios?.[0] ?? null;
  const notaRegistrada = atividade.CursosNotas?.[0] ?? null;
  const isAtividade = atividade.tipo === CursosAvaliacaoTipo.ATIVIDADE;
  const possuiEnvio = Boolean(envio?.realizadoEm);
  const edicaoEnvio = resolveAtividadeEdicao(envio);
  const corrigidaInternamente = Boolean(
    notaRegistrada ||
      (envio?.nota !== null && envio?.nota !== undefined) ||
      envio?.CursosTurmasProvasRespostas?.some((resposta: any) => resposta.corrigida),
  );
  const edicao = isAtividade
    ? notaRegistrada
      ? {
          ...edicaoEnvio,
          corrigida: true,
          podeEditar: false,
          bloqueioMotivo: 'CORRIGIDA' as const,
        }
      : edicaoEnvio
    : {
        tentativasEnvio: envio?.tentativasEnvio ?? 0,
        tentativasRestantes: possuiEnvio ? 0 : 1,
        limiteEnvios: 1,
        edicoesRealizadas: 0,
        edicoesRestantes: 0,
        limiteEdicoes: 0,
        ultimaEdicaoEm: null,
        corrigida: corrigidaInternamente,
        podeEditar: !possuiEnvio && !envio?.bloqueadoEdicaoEm,
        bloqueioMotivo: corrigidaInternamente ? ('CORRIGIDA' as const) : null,
      };
  const respostasPorQuestao = new Map(
    (envio?.CursosTurmasProvasRespostas ?? []).map((resposta: any) => [
      resposta.questaoId,
      resposta,
    ]),
  );
  const objetiva =
    atividade.CursosTurmasProvasQuestoes.length > 0 &&
    atividade.CursosTurmasProvasQuestoes.every(
      (questao: any) => questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA,
    );
  const liberacaoGabarito = obterLiberacaoGabarito(atividade.dataFim, atividade.horaTermino);
  const podeExibirGabarito = objetiva && possuiEnvio && liberacaoGabarito.disponivel;
  const respostas = envio?.CursosTurmasProvasRespostas ?? [];
  const acertos = podeExibirGabarito
    ? respostas.filter((resposta: any) => {
        const questao = atividade.CursosTurmasProvasQuestoes.find(
          (item: any) => item.id === resposta.questaoId,
        );
        return questao?.CursosTurmasProvasQuestoesAlternativas.some(
          (alternativa: any) => alternativa.correta && alternativa.id === resposta.alternativaId,
        );
      }).length
    : 0;
  const notaInterna =
    envio?.nota !== null && envio?.nota !== undefined
      ? Number(envio.nota)
      : notaRegistrada?.nota !== null && notaRegistrada?.nota !== undefined
        ? Number(notaRegistrada.nota)
        : null;
  const notaMaxima = Number(atividade.peso ?? 10) || 10;

  return {
    id: atividade.id,
    tipo: atividade.tipo,
    titulo: atividade.titulo,
    descricao: atividade.descricao ?? null,
    tipoAtividade: atividade.tipoAtividade ?? null,
    dataInicio: toIso(atividade.dataInicio),
    dataFim: toIso(atividade.dataFim),
    horaInicio: atividade.horaInicio ?? null,
    horaFim: atividade.horaTermino ?? null,
    realizadoEm: toIso(envio?.realizadoEm),
    nota: objetiva && !podeExibirGabarito ? null : notaInterna,
    feedback: envio?.observacoes ?? notaRegistrada?.observacoes ?? null,
    bloqueadoEdicaoEm: toIso(
      envio?.bloqueadoEdicaoEm ?? (notaRegistrada ? notaRegistrada.atualizadoEm : null),
    ),
    ...edicao,
    corrigida: objetiva ? podeExibirGabarito : corrigidaInternamente,
    podeEditar: objetiva && possuiEnvio ? false : edicao.podeEditar,
    aguardandoGabarito: objetiva && possuiEnvio && !podeExibirGabarito,
    gabaritoDisponivel: podeExibirGabarito,
    gabaritoDisponivelEm: toIso(liberacaoGabarito.disponivelEm),
    resultado: podeExibirGabarito
      ? {
          totalQuestoes: atividade.CursosTurmasProvasQuestoes.length,
          acertos,
          percentual:
            atividade.CursosTurmasProvasQuestoes.length > 0
              ? (acertos / atividade.CursosTurmasProvasQuestoes.length) * 100
              : 0,
          nota: notaInterna,
          notaMaxima,
        }
      : null,
    questoes: atividade.CursosTurmasProvasQuestoes.map((questao: any) => {
      const resposta = respostasPorQuestao.get(questao.id) as any;
      return {
        id: questao.id,
        enunciado: questao.enunciado,
        tipo: questao.tipo,
        ordem: questao.ordem,
        obrigatoria: questao.obrigatoria,
        alternativas: questao.CursosTurmasProvasQuestoesAlternativas.map((alternativa: any) => ({
          id: alternativa.id,
          texto: alternativa.texto,
          ordem: alternativa.ordem,
          ...(podeExibirGabarito ? { correta: alternativa.correta } : {}),
        })),
        resposta: resposta
          ? {
              respostaTexto: resposta.respostaTexto,
              alternativaId: resposta.alternativaId,
              anexoUrl: resposta.anexoUrl,
              anexoNome: resposta.anexoNome,
              ...(podeExibirGabarito
                ? {
                    acertou: questao.CursosTurmasProvasQuestoesAlternativas.some(
                      (alternativa: any) =>
                        alternativa.correta && alternativa.id === resposta.alternativaId,
                    ),
                    nota:
                      resposta.nota !== null && resposta.nota !== undefined
                        ? Number(resposta.nota)
                        : null,
                  }
                : {}),
            }
          : null,
      };
    }),
  };
};

const toIso = (value?: Date | null) => (value ? value.toISOString() : null);

const sortEstruturaItems = <T extends { ordem?: number | null; type?: string }>(items: T[]) =>
  [...items].sort((a, b) => {
    const diff = (a.ordem ?? 0) - (b.ordem ?? 0);
    return diff !== 0 ? diff : String(a.type ?? '').localeCompare(String(b.type ?? ''));
  });

const mapAulaEstruturaAluno = (
  aula: any,
  progresso?: {
    percentualAssistido: Prisma.Decimal;
    tempoAssistidoSegundos: number;
    concluida: boolean;
    concluidaEm: Date | null;
    atualizadoEm: Date;
  } | null,
  possuiPresenca = false,
) => ({
  id: aula.id,
  title: aula.nome,
  type: 'AULA' as const,
  templateId: null,
  startDate: toIso(aula.dataInicio),
  endDate: toIso(aula.dataFim),
  horaInicio: aula.horaInicio ?? null,
  horaFim: aula.horaFim ?? null,
  aulaId: aula.id,
  instructorId: aula.instrutorId ?? null,
  instructorIds: aula.instrutorId ? [aula.instrutorId] : [],
  obrigatoria: aula.obrigatoria ?? true,
  obrigatorio: aula.obrigatoria ?? true,
  modalidade: aula.modalidade ?? null,
  youtubeUrl: aula.urlVideo ?? null,
  meetUrl: aula.urlMeet ?? null,
  tipoLinkSemiPresencial: aula.tipoLink ?? null,
  ordem: aula.ordem ?? null,
  progresso: {
    status:
      progresso?.concluida || possuiPresenca
        ? ('CONCLUIDO' as const)
        : Number(progresso?.percentualAssistido ?? 0) > 0
          ? ('EM_PROGRESSO' as const)
          : ('NAO_INICIADO' as const),
    percentualConcluido:
      progresso?.concluida || possuiPresenca ? 100 : Number(progresso?.percentualAssistido ?? 0),
    tempoAssistidoSegundos: progresso?.tempoAssistidoSegundos ?? 0,
    dataConclusao: toIso(progresso?.concluidaEm),
    atualizadoEm: toIso(progresso?.atualizadoEm),
  },
});

const mapAvaliacaoEstruturaAluno = (avaliacao: any) => {
  const isAtividade = avaliacao.tipo === 'ATIVIDADE';
  const envio = avaliacao.CursosTurmasProvasEnvios?.[0] ?? null;
  const respondida = Boolean(envio?.realizadoEm || (envio?.tentativasEnvio ?? 0) > 0);
  const corrigida = Boolean(
    envio?.bloqueadoEdicaoEm ||
      (envio?.nota !== null && envio?.nota !== undefined) ||
      envio?.CursosTurmasProvasRespostas?.some((resposta: any) => resposta.corrigida),
  );
  const objetiva =
    avaliacao.CursosTurmasProvasQuestoes?.length > 0 &&
    avaliacao.CursosTurmasProvasQuestoes.every(
      (questao: any) => questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA,
    );
  const gabarito = obterLiberacaoGabarito(avaliacao.dataFim, avaliacao.horaTermino);

  return {
    id: avaliacao.id,
    title: avaliacao.titulo,
    type: isAtividade ? ('ATIVIDADE' as const) : ('PROVA' as const),
    descricao: avaliacao.descricao ?? null,
    templateId: null,
    startDate: toIso(avaliacao.dataInicio),
    endDate: toIso(avaliacao.dataFim),
    horaInicio: avaliacao.horaInicio ?? null,
    horaFim: avaliacao.horaTermino ?? null,
    instructorId: avaliacao.instrutorId ?? null,
    instructorIds: avaliacao.instrutorId ? [avaliacao.instrutorId] : [],
    obrigatoria: avaliacao.obrigatoria ?? true,
    obrigatorio: avaliacao.obrigatoria ?? true,
    recuperacaoFinal: avaliacao.recuperacaoFinal ?? false,
    activityType: isAtividade ? 'PLATAFORMA' : null,
    platformActivityId: isAtividade ? avaliacao.id : null,
    modalidade: avaliacao.modalidade ?? null,
    tipoAtividade: avaliacao.tipoAtividade ?? null,
    situacaoAluno: respondida
      ? objetiva && !gabarito.disponivel
        ? 'AGUARDANDO_GABARITO'
        : corrigida
          ? 'CORRIGIDA'
          : 'AGUARDANDO_CORRECAO'
      : null,
    respondidaEm: respondida ? toIso(envio?.realizadoEm) : null,
    progresso: {
      status: respondida ? ('CONCLUIDO' as const) : ('NAO_INICIADO' as const),
      percentualConcluido: respondida ? 100 : 0,
      tentativas: envio?.tentativasEnvio ?? 0,
      dataConclusao: respondida ? toIso(envio?.realizadoEm) : null,
    },
    ordem: avaliacao.ordem ?? null,
  };
};

const mapModalidadeAulaAluno = (modalidade?: string | null) => {
  if (!modalidade) return null;
  return modalidade === 'LIVE' ? 'AO_VIVO' : modalidade;
};

const mapAulaDetalheAluno = (aula: any) => {
  const modalidadeTurma = mapModalidadeAulaAluno(aula.CursosTurmas?.metodo);
  const modalidadeAula = mapModalidadeAulaAluno(aula.modalidade);

  return {
    id: aula.id,
    codigo: aula.codigo,
    cursoId: aula.CursosTurmas?.Cursos?.id || aula.Cursos?.id || null,
    titulo: aula.nome,
    descricao: aula.descricao || null,
    duracaoMinutos: aula.duracaoMinutos || null,
    modalidade: modalidadeTurma || modalidadeAula,
    youtubeUrl: aula.urlVideo || null,
    meetUrl: aula.urlMeet || null,
    tipoLink: aula.urlVideo ? 'YOUTUBE' : aula.urlMeet ? 'MEET' : null,
    sala: aula.sala || null,
    status: aula.status,
    obrigatoria: aula.obrigatoria,
    ordem: aula.ordem,
    dataInicio: toIso(aula.dataInicio),
    dataFim: toIso(aula.dataFim),
    horaInicio: aula.horaInicio || null,
    horaFim: aula.horaFim || null,
    gravarAula: aula.gravarAula || null,
    linkGravacao: aula.linkGravacao || null,
    statusGravacao: aula.statusGravacao || null,
    meetEventId: aula.meetEventId || null,
    turmaId: aula.turmaId || null,
    materiais:
      aula.CursosTurmasAulasMateriais?.map((material: any) => ({
        id: material.id,
        titulo: material.titulo,
        url: material.url,
        ordem: material.ordem,
        tipo: material.tipo,
      })) ?? [],
    turma: aula.CursosTurmas
      ? {
          id: aula.CursosTurmas.id,
          codigo: aula.CursosTurmas.codigo,
          nome: aula.CursosTurmas.nome,
          turno: aula.CursosTurmas.turno,
          metodo: mapModalidadeAulaAluno(aula.CursosTurmas.metodo),
          curso: aula.CursosTurmas.Cursos
            ? {
                id: aula.CursosTurmas.Cursos.id,
                codigo: aula.CursosTurmas.Cursos.codigo,
                nome: aula.CursosTurmas.Cursos.nome,
              }
            : null,
        }
      : null,
    modulo: aula.CursosTurmasModulos
      ? {
          id: aula.CursosTurmasModulos.id,
          nome: aula.CursosTurmasModulos.nome,
        }
      : null,
    instrutor: aula.instrutor
      ? {
          id: aula.instrutor.id,
          codigo: aula.instrutor.codUsuario,
          nome: aula.instrutor.nomeCompleto,
          email: aula.instrutor.email,
          cpf: aula.instrutor.cpf,
          avatarUrl: aula.instrutor.UsuariosInformation?.avatarUrl || null,
        }
      : null,
    criadoPor: aula.criadoPor
      ? {
          id: aula.criadoPor.id,
          nome: aula.criadoPor.nomeCompleto,
          cpf: aula.criadoPor.cpf,
        }
      : null,
    criadoEm: aula.criadoEm.toISOString(),
    atualizadoEm: aula.atualizadoEm.toISOString(),
  };
};

/**
 * Formata o status da inscrição para exibição
 */
const formatarStatusInscricao = (status: StatusInscricao): string => {
  const statusMap: Record<StatusInscricao, string> = {
    [StatusInscricao.INSCRITO]: 'Não iniciado',
    [StatusInscricao.EM_ANDAMENTO]: 'Em Andamento',
    [StatusInscricao.CONCLUIDO]: 'Concluído',
    [StatusInscricao.REPROVADO]: 'Reprovado',
    [StatusInscricao.EM_ESTAGIO]: 'Em Estágio',
    [StatusInscricao.CANCELADO]: 'Cancelado',
    [StatusInscricao.TRANCADO]: 'Trancado',
    [StatusInscricao.AGUARDANDO_PAGAMENTO]: 'Aguardando Pagamento',
  };
  return statusMap[status] || status;
};

/**
 * Busca a próxima aula agendada para o candidato
 */
const buscarProximaAula = async (usuarioId: string) => {
  try {
    const agora = new Date();

    // Buscar a próxima aula ao vivo, online ou presencial
    const proximaAula = await prisma.cursosTurmasAulas.findFirst({
      where: {
        dataInicio: {
          gte: agora,
        },
        status: {
          in: ['PUBLICADA', 'EM_ANDAMENTO'],
        },
        modalidade: {
          in: ['LIVE', 'ONLINE', 'PRESENCIAL', 'SEMIPRESENCIAL'],
        },
        CursosTurmas: {
          CursosTurmasInscricoes: {
            some: {
              alunoId: usuarioId,
              statusPagamento: STATUS_PAGAMENTO_LIBERADO,
              status: {
                in: STATUS_INSCRICAO_PROXIMA_AULA,
              },
            },
          },
        },
      },
      include: {
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            Cursos: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
      },
      orderBy: {
        dataInicio: 'asc',
      },
    });

    if (!proximaAula) {
      return null;
    }

    if (!proximaAula.CursosTurmas) {
      return null;
    }

    return {
      id: proximaAula.id,
      titulo: proximaAula.nome,
      descricao: proximaAula.descricao || null,
      dataInicio: proximaAula.dataInicio,
      dataFim: proximaAula.dataFim,
      modalidade: proximaAula.modalidade,
      urlMeet: proximaAula.urlMeet || null,
      urlVideo: proximaAula.urlVideo || null,
      turma: {
        id: proximaAula.CursosTurmas.id,
        nome: proximaAula.CursosTurmas.nome,
        curso: {
          id: proximaAula.CursosTurmas.Cursos.id,
          nome: proximaAula.CursosTurmas.Cursos.nome,
        },
      },
    };
  } catch (error) {
    cursosLogger.error(
      {
        usuarioId,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      'Erro ao buscar próxima aula',
    );
    return null;
  }
};

// Função removida - agora usa _count do Prisma diretamente

export const candidatoCursosService = {
  async listCursos(
    usuarioId: string,
    options: {
      modalidade?: string;
      page?: number;
      limit?: number;
    },
  ) {
    cursosLogger.info({ usuarioId, options }, 'Buscando cursos do candidato');

    const { modalidade = 'TODOS', page = 1, limit = 8 } = options;
    const skip = (page - 1) * limit;

    // Construir filtro de modalidade
    // Mapear valores do frontend para valores do banco
    let modalidadeFilter: CursosMetodos[] | undefined = undefined;

    if (modalidade !== 'TODOS') {
      const modalidadeUpper = modalidade.toUpperCase();
      if (modalidadeUpper === 'AO_VIVO') {
        modalidadeFilter = ['LIVE'];
      } else {
        // Validar se é um valor válido do enum
        const validModalidades: CursosMetodos[] = [
          'ONLINE',
          'PRESENCIAL',
          'LIVE',
          'SEMIPRESENCIAL',
        ];
        if (validModalidades.includes(modalidadeUpper as CursosMetodos)) {
          modalidadeFilter = [modalidadeUpper as CursosMetodos];
        }
      }
    }

    // Buscar inscrições do candidato
    const where: any = {
      alunoId: usuarioId,
      statusPagamento: STATUS_PAGAMENTO_LIBERADO,
      status: {
        in: STATUS_INSCRICAO_LISTAGEM_LIBERADA,
      },
      CursosTurmas: {
        ...(modalidadeFilter && {
          metodo: {
            in: modalidadeFilter,
          },
        }),
      },
    };

    // Buscar total de registros
    const total = await prisma.cursosTurmasInscricoes.count({ where });

    // Buscar inscrições e os dados necessários ao cálculo do progresso.
    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        criadoEm: 'desc',
      },
      select: {
        id: true,
        status: true,
        turmaId: true,
        criadoEm: true,
        CursosAulasProgresso: {
          where: { concluida: true },
          select: { aulaId: true },
        },
        CursosFrequenciaAlunos: {
          where: { status: 'PRESENTE', aulaId: { not: null } },
          select: { aulaId: true },
        },
        CursosTurmasProvasEnvios: {
          where: { realizadoEm: { not: null } },
          select: { provaId: true },
        },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            metodo: true,
            dataInicio: true,
            dataFim: true,
            CursosTurmasAulas: {
              where: { deletedAt: null },
              select: { id: true },
            },
            CursosTurmasProvas: {
              where: { ativo: true, status: CursosAulaStatus.PUBLICADA },
              select: { id: true },
            },
            Cursos: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                imagemUrl: true,
                cargaHoraria: true,
              },
            },
          },
        },
        CursosNotas: {
          where: {
            nota: { not: null },
          },
          select: {
            nota: true,
            peso: true,
          },
        },
      },
    });

    // Processar cada inscrição para adicionar dados calculados (SEM queries adicionais)
    const cursos = inscricoes.map((inscricao) => {
      // Calcular progresso usando dados já carregados
      const progressoCurso = calcularProgressoCurso({
        aulaIds: inscricao.CursosTurmas.CursosTurmasAulas.map((aula) => aula.id),
        avaliacaoIds: inscricao.CursosTurmas.CursosTurmasProvas.map((prova) => prova.id),
        aulaProgressoIds: inscricao.CursosAulasProgresso.map((item) => item.aulaId),
        aulaPresencaIds: inscricao.CursosFrequenciaAlunos.flatMap((item) =>
          item.aulaId ? [item.aulaId] : [],
        ),
        avaliacaoRespondidaIds: inscricao.CursosTurmasProvasEnvios.map((envio) => envio.provaId),
      });
      const totalAulas = inscricao.CursosTurmas.CursosTurmasAulas.length;
      const totalProvas = inscricao.CursosTurmas.CursosTurmasProvas.length;

      let progresso = progressoCurso.percentual;
      if (totalAulas === 0 && totalProvas === 0) {
        // Calcular por tempo se não houver aulas/provas
        if (inscricao.CursosTurmas.dataInicio && inscricao.CursosTurmas.dataFim) {
          const agora = new Date();
          const inicio = new Date(inscricao.CursosTurmas.dataInicio).getTime();
          const fim = new Date(inscricao.CursosTurmas.dataFim).getTime();
          const atual = agora.getTime();
          if (fim > inicio) {
            progresso = Math.round(
              Math.min(100, Math.max(0, ((atual - inicio) / (fim - inicio)) * 100)),
            );
          }
        }
      }

      // Calcular nota média usando dados já carregados
      let notaMedia: number | null = null;
      if (inscricao.CursosNotas && inscricao.CursosNotas.length > 0) {
        let somaPonderada = 0;
        let somaPesos = 0;
        for (const nota of inscricao.CursosNotas) {
          if (nota.nota && nota.peso) {
            somaPonderada += Number(nota.nota) * Number(nota.peso);
            somaPesos += Number(nota.peso);
          }
        }
        if (somaPesos > 0) {
          notaMedia = Math.round((somaPonderada / somaPesos) * 10) / 10;
        }
      }

      return {
        id: inscricao.id,
        cursoId: inscricao.CursosTurmas.Cursos.id,
        turmaId: inscricao.CursosTurmas.id,
        foto: inscricao.CursosTurmas.Cursos.imagemUrl,
        status: formatarStatusInscricao(inscricao.status),
        statusRaw: inscricao.status,
        nome: inscricao.CursosTurmas.Cursos.nome,
        descricao: inscricao.CursosTurmas.Cursos.descricao,
        progresso,
        iniciadoEm: inscricao.criadoEm,
        quantidadeAulas: totalAulas + totalProvas,
        notaMedia,
        modalidade: inscricao.CursosTurmas.metodo,
        dataInicio: inscricao.CursosTurmas.dataInicio,
        cargaHoraria: inscricao.CursosTurmas.Cursos.cargaHoraria,
      };
    });

    // Buscar próxima aula
    const proximaAula = await buscarProximaAula(usuarioId);

    return {
      proximaAula,
      cursos,
      paginacao: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },

  async getTurmaEstrutura(usuarioId: string, cursoId: string, turmaId: string) {
    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: {
        alunoId: usuarioId,
        turmaId,
        statusPagamento: STATUS_PAGAMENTO_LIBERADO,
        status: {
          in: STATUS_INSCRICAO_LISTAGEM_LIBERADA,
        },
        CursosTurmas: {
          id: turmaId,
          cursoId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        CursosAulasProgresso: {
          select: {
            aulaId: true,
            percentualAssistido: true,
            tempoAssistidoSegundos: true,
            concluida: true,
            concluidaEm: true,
            atualizadoEm: true,
          },
        },
        CursosFrequenciaAlunos: {
          where: { status: 'PRESENTE', aulaId: { not: null } },
          select: { aulaId: true },
        },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            metodo: true,
            estruturaTipo: true,
            dataInicio: true,
            dataFim: true,
            Cursos: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                cargaHoraria: true,
              },
            },
            CursosTurmasModulos: {
              orderBy: { ordem: 'asc' },
              select: {
                id: true,
                nome: true,
                ordem: true,
                CursosTurmasAulas: {
                  where: { deletedAt: null },
                  orderBy: { ordem: 'asc' },
                },
                CursosTurmasProvas: {
                  where: { ativo: true, status: CursosAulaStatus.PUBLICADA },
                  orderBy: { ordem: 'asc' },
                  include: {
                    CursosTurmasProvasQuestoes: {
                      select: { tipo: true },
                    },
                    CursosTurmasProvasEnvios: {
                      where: {
                        CursosTurmasInscricoes: { alunoId: usuarioId },
                      },
                      take: 1,
                      select: {
                        tentativasEnvio: true,
                        realizadoEm: true,
                        nota: true,
                        bloqueadoEdicaoEm: true,
                        CursosTurmasProvasRespostas: {
                          select: { corrigida: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            CursosTurmasAulas: {
              where: {
                moduloId: null,
                deletedAt: null,
              },
              orderBy: { ordem: 'asc' },
            },
            CursosTurmasProvas: {
              where: {
                moduloId: null,
                ativo: true,
                status: CursosAulaStatus.PUBLICADA,
              },
              orderBy: { ordem: 'asc' },
              include: {
                CursosTurmasProvasQuestoes: {
                  select: { tipo: true },
                },
                CursosTurmasProvasEnvios: {
                  where: {
                    CursosTurmasInscricoes: { alunoId: usuarioId },
                  },
                  take: 1,
                  select: {
                    tentativasEnvio: true,
                    realizadoEm: true,
                    nota: true,
                    bloqueadoEdicaoEm: true,
                    CursosTurmasProvasRespostas: {
                      select: { corrigida: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!inscricao?.CursosTurmas) {
      return null;
    }

    const turma = inscricao.CursosTurmas;
    const progressoAulas = new Map(
      inscricao.CursosAulasProgresso.map((progresso) => [progresso.aulaId, progresso]),
    );
    const aulasComPresenca = new Set(
      inscricao.CursosFrequenciaAlunos.flatMap((frequencia) =>
        frequencia.aulaId ? [frequencia.aulaId] : [],
      ),
    );
    const mapAula = (aula: any) =>
      mapAulaEstruturaAluno(aula, progressoAulas.get(aula.id), aulasComPresenca.has(aula.id));
    const modules = turma.CursosTurmasModulos.map((modulo) => ({
      id: modulo.id,
      title: modulo.nome,
      items: sortEstruturaItems([
        ...modulo.CursosTurmasAulas.map(mapAula),
        ...modulo.CursosTurmasProvas.map(mapAvaliacaoEstruturaAluno),
      ]),
    }));
    const standaloneItems = sortEstruturaItems([
      ...turma.CursosTurmasAulas.map(mapAula),
      ...turma.CursosTurmasProvas.map(mapAvaliacaoEstruturaAluno),
    ]);

    return {
      inscricaoId: inscricao.id,
      cursoId: turma.Cursos.id,
      turmaId: turma.id,
      curso: {
        id: turma.Cursos.id,
        nome: turma.Cursos.nome,
        descricao: turma.Cursos.descricao,
        cargaHoraria: turma.Cursos.cargaHoraria,
      },
      turma: {
        id: turma.id,
        nome: turma.nome,
        metodo: turma.metodo,
        estruturaTipo: turma.estruturaTipo,
        dataInicio: toIso(turma.dataInicio),
        dataFim: toIso(turma.dataFim),
      },
      estrutura: {
        modules,
        standaloneItems,
      },
    };
  },

  async getAtividadeDetalhe(
    usuarioId: string,
    cursoId: string,
    turmaId: string,
    atividadeId: string,
  ) {
    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: {
        alunoId: usuarioId,
        turmaId,
        statusPagamento: STATUS_PAGAMENTO_LIBERADO,
        status: { in: STATUS_INSCRICAO_LISTAGEM_LIBERADA },
        CursosTurmas: { id: turmaId, cursoId, deletedAt: null },
      },
      select: { id: true },
    });

    if (!inscricao) return null;

    const atividade = await prisma.cursosTurmasProvas.findFirst({
      where: {
        id: atividadeId,
        cursoId,
        turmaId,
        ativo: true,
        status: CursosAulaStatus.PUBLICADA,
      },
      include: {
        CursosTurmasProvasQuestoes: {
          orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
          include: {
            CursosTurmasProvasQuestoesAlternativas: {
              orderBy: { ordem: 'asc' },
              select: { id: true, texto: true, ordem: true, correta: true },
            },
          },
        },
        CursosTurmasProvasEnvios: {
          where: { inscricaoId: inscricao.id },
          take: 1,
          select: {
            id: true,
            tentativasEnvio: true,
            bloqueadoEdicaoEm: true,
            nota: true,
            observacoes: true,
            realizadoEm: true,
            atualizadoEm: true,
            CursosTurmasProvasRespostas: {
              select: {
                questaoId: true,
                respostaTexto: true,
                alternativaId: true,
                anexoUrl: true,
                anexoNome: true,
                corrigida: true,
                nota: true,
              },
            },
          },
        },
        CursosNotas: {
          where: { inscricaoId: inscricao.id },
          take: 1,
          select: {
            id: true,
            nota: true,
            observacoes: true,
            atualizadoEm: true,
          },
        },
      },
    });

    return atividade ? mapAtividadeDetalheAluno(atividade) : null;
  },

  async enviarAtividadeResposta(
    usuarioId: string,
    cursoId: string,
    turmaId: string,
    atividadeId: string,
    respostas: AtividadeRespostaInput[],
  ) {
    return prisma.$transaction(
      async (tx) => {
        const inscricao = await tx.cursosTurmasInscricoes.findFirst({
          where: {
            alunoId: usuarioId,
            turmaId,
            statusPagamento: STATUS_PAGAMENTO_LIBERADO,
            status: { in: STATUS_INSCRICAO_LISTAGEM_LIBERADA },
            CursosTurmas: { id: turmaId, cursoId, deletedAt: null },
          },
          select: { id: true },
        });

        if (!inscricao) {
          const error = new Error('Atividade não encontrada para este aluno');
          (error as any).code = 'ATIVIDADE_NOT_FOUND';
          throw error;
        }

        const atividade = await tx.cursosTurmasProvas.findFirst({
          where: {
            id: atividadeId,
            cursoId,
            turmaId,
            ativo: true,
            status: CursosAulaStatus.PUBLICADA,
          },
          select: {
            id: true,
            tipo: true,
            titulo: true,
            descricao: true,
            tipoAtividade: true,
            peso: true,
            dataInicio: true,
            dataFim: true,
            horaInicio: true,
            horaTermino: true,
            CursosTurmasProvasQuestoes: {
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
              select: {
                id: true,
                tipo: true,
                peso: true,
                obrigatoria: true,
                CursosTurmasProvasQuestoesAlternativas: {
                  select: { id: true, correta: true },
                },
              },
            },
          },
        });

        if (!atividade) {
          const error = new Error('Atividade não encontrada para este aluno');
          (error as any).code = 'ATIVIDADE_NOT_FOUND';
          throw error;
        }

        const isAtividade = atividade.tipo === CursosAvaliacaoTipo.ATIVIDADE;
        const atividadeObjetiva =
          atividade.CursosTurmasProvasQuestoes.length > 0 &&
          atividade.CursosTurmasProvasQuestoes.every(
            (questao) => questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA,
          );

        const agora = new Date();
        const inicio = combinarDataHoraAvaliacao(atividade.dataInicio, atividade.horaInicio);
        const fim = combinarDataHoraAvaliacao(atividade.dataFim, atividade.horaTermino);

        if (inicio && agora < inicio) {
          const error = new Error('O período desta atividade ainda não começou');
          (error as any).code = 'ATIVIDADE_FORA_DO_PERIODO';
          throw error;
        }
        if (fim && agora > fim) {
          const error = new Error('O período desta atividade foi encerrado');
          (error as any).code = 'ATIVIDADE_FORA_DO_PERIODO';
          throw error;
        }

        const respostasPorQuestao = new Map(
          respostas.map((resposta) => [resposta.questaoId, resposta]),
        );
        if (respostasPorQuestao.size !== respostas.length) {
          const error = new Error('Cada questão deve possuir apenas uma resposta');
          (error as any).code = 'VALIDATION_ERROR';
          throw error;
        }

        for (const resposta of respostas) {
          const questao = atividade.CursosTurmasProvasQuestoes.find(
            (item) => item.id === resposta.questaoId,
          );
          if (!questao) {
            const error = new Error('Uma das questões não pertence a esta atividade');
            (error as any).code = 'VALIDATION_ERROR';
            throw error;
          }

          const respostaTexto = resposta.respostaTexto?.trim();
          if (questao.tipo === CursosTipoQuestao.TEXTO && !respostaTexto) {
            const error = new Error('Preencha a resposta da atividade');
            (error as any).code = 'VALIDATION_ERROR';
            throw error;
          }
          if (
            questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA &&
            (!resposta.alternativaId ||
              !questao.CursosTurmasProvasQuestoesAlternativas.some(
                (alternativa) => alternativa.id === resposta.alternativaId,
              ))
          ) {
            const error = new Error('Selecione uma alternativa válida');
            (error as any).code = 'VALIDATION_ERROR';
            throw error;
          }
          if (questao.tipo === CursosTipoQuestao.ANEXO && !resposta.anexoUrl) {
            const error = new Error('Envie o material solicitado');
            (error as any).code = 'VALIDATION_ERROR';
            throw error;
          }
        }

        const obrigatoriasPendentes = atividade.CursosTurmasProvasQuestoes.filter(
          (questao) => questao.obrigatoria && !respostasPorQuestao.has(questao.id),
        );
        if (obrigatoriasPendentes.length > 0) {
          const error = new Error('Responda todas as questões obrigatórias');
          (error as any).code = 'VALIDATION_ERROR';
          throw error;
        }

        const envio = await tx.cursosTurmasProvasEnvios.upsert({
          where: {
            provaId_inscricaoId: { provaId: atividadeId, inscricaoId: inscricao.id },
          },
          update: {},
          create: { provaId: atividadeId, inscricaoId: inscricao.id },
          select: {
            id: true,
            tentativasEnvio: true,
            bloqueadoEdicaoEm: true,
            nota: true,
            realizadoEm: true,
            atualizadoEm: true,
            CursosTurmasProvasRespostas: { select: { corrigida: true } },
          },
        });
        const notaRegistrada = await tx.cursosNotas.findUnique({
          where: {
            inscricaoId_provaId: { inscricaoId: inscricao.id, provaId: atividadeId },
          },
          select: { id: true },
        });
        const edicao = resolveAtividadeEdicao(envio);

        if (!isAtividade && (envio.realizadoEm || envio.bloqueadoEdicaoEm)) {
          const error = new Error('Esta prova já foi enviada e não pode mais ser alterada');
          (error as any).code = 'AVALIACAO_JA_ENVIADA';
          throw error;
        }

        if (isAtividade && (edicao.corrigida || notaRegistrada)) {
          const error = new Error('Esta atividade já foi corrigida e não pode mais ser editada');
          (error as any).code = 'ATIVIDADE_CORRIGIDA';
          throw error;
        }
        if (isAtividade && !edicao.podeEditar) {
          const error = new Error('O limite de três edições desta atividade foi atingido');
          (error as any).code = 'ATIVIDADE_LIMITE_ENVIOS';
          throw error;
        }

        const tentativaRegistrada = await tx.cursosTurmasProvasEnvios.updateMany({
          where: {
            id: envio.id,
            tentativasEnvio: { lt: isAtividade ? MAX_ATIVIDADE_ENVIOS : 1 },
            bloqueadoEdicaoEm: null,
            nota: null,
            ...(!isAtividade ? { realizadoEm: null } : {}),
          },
          data: {
            tentativasEnvio: { increment: 1 },
            realizadoEm: agora,
            atualizadoEm: agora,
          },
        });

        if (tentativaRegistrada.count !== 1) {
          const error = new Error(
            isAtividade
              ? 'Esta atividade não está mais disponível para edição'
              : 'Esta prova já foi enviada e não pode mais ser alterada',
          );
          (error as any).code = isAtividade ? 'ATIVIDADE_EDICAO_BLOQUEADA' : 'AVALIACAO_JA_ENVIADA';
          throw error;
        }

        const pesosInformados = atividade.CursosTurmasProvasQuestoes.map((questao) =>
          Number(questao.peso ?? 0),
        );
        const somaPesos = pesosInformados.reduce((total, peso) => total + Math.max(0, peso), 0);
        const notaMaxima = Number(atividade.peso ?? 10) || 10;
        const pesosQuestoes = atividade.CursosTurmasProvasQuestoes.map((_, index) =>
          somaPesos > 0
            ? (Math.max(0, pesosInformados[index] ?? 0) / somaPesos) * notaMaxima
            : notaMaxima / atividade.CursosTurmasProvasQuestoes.length,
        );
        const notaPorQuestao = new Map<string, number>();

        await Promise.all(
          respostas.map((resposta) => {
            const indiceQuestao = atividade.CursosTurmasProvasQuestoes.findIndex(
              (questao) => questao.id === resposta.questaoId,
            );
            const questao = atividade.CursosTurmasProvasQuestoes[indiceQuestao];
            const acertou = Boolean(
              atividadeObjetiva &&
                questao?.CursosTurmasProvasQuestoesAlternativas.some(
                  (alternativa) => alternativa.correta && alternativa.id === resposta.alternativaId,
                ),
            );
            const notaQuestao = acertou
              ? Number((pesosQuestoes[indiceQuestao] ?? 0).toFixed(1))
              : 0;
            notaPorQuestao.set(resposta.questaoId, notaQuestao);

            return tx.cursosTurmasProvasRespostas.upsert({
              where: {
                questaoId_inscricaoId: {
                  questaoId: resposta.questaoId,
                  inscricaoId: inscricao.id,
                },
              },
              update: {
                envioId: envio.id,
                respostaTexto: resposta.respostaTexto?.trim() || null,
                alternativaId: resposta.alternativaId ?? null,
                anexoUrl: resposta.anexoUrl ?? null,
                anexoNome: resposta.anexoNome ?? null,
                corrigida: atividadeObjetiva,
                nota: atividadeObjetiva ? new Prisma.Decimal(notaQuestao) : undefined,
                atualizadoEm: agora,
              },
              create: {
                questaoId: resposta.questaoId,
                inscricaoId: inscricao.id,
                envioId: envio.id,
                respostaTexto: resposta.respostaTexto?.trim() || null,
                alternativaId: resposta.alternativaId ?? null,
                anexoUrl: resposta.anexoUrl ?? null,
                anexoNome: resposta.anexoNome ?? null,
                corrigida: atividadeObjetiva,
                nota: atividadeObjetiva ? new Prisma.Decimal(notaQuestao) : null,
              },
            });
          }),
        );

        if (atividadeObjetiva) {
          const notaFinal = Number(
            Array.from(notaPorQuestao.values())
              .reduce((total, nota) => total + nota, 0)
              .toFixed(1),
          );

          await tx.cursosTurmasProvasEnvios.update({
            where: { id: envio.id },
            data: {
              nota: new Prisma.Decimal(notaFinal),
              pesoTotal: new Prisma.Decimal(notaMaxima),
              bloqueadoEdicaoEm: agora,
            },
          });
        } else if (!isAtividade) {
          await tx.cursosTurmasProvasEnvios.update({
            where: { id: envio.id },
            data: { bloqueadoEdicaoEm: agora },
          });
        }

        const detalhe = await tx.cursosTurmasProvas.findUnique({
          where: { id: atividadeId },
          include: {
            CursosTurmasProvasQuestoes: {
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
              include: {
                CursosTurmasProvasQuestoesAlternativas: {
                  orderBy: { ordem: 'asc' },
                  select: { id: true, texto: true, ordem: true, correta: true },
                },
              },
            },
            CursosTurmasProvasEnvios: {
              where: { inscricaoId: inscricao.id },
              take: 1,
              select: {
                id: true,
                tentativasEnvio: true,
                bloqueadoEdicaoEm: true,
                nota: true,
                observacoes: true,
                realizadoEm: true,
                atualizadoEm: true,
                CursosTurmasProvasRespostas: {
                  select: {
                    questaoId: true,
                    respostaTexto: true,
                    alternativaId: true,
                    anexoUrl: true,
                    anexoNome: true,
                    corrigida: true,
                    nota: true,
                  },
                },
              },
            },
            CursosNotas: {
              where: { inscricaoId: inscricao.id },
              take: 1,
              select: {
                id: true,
                nota: true,
                observacoes: true,
                atualizadoEm: true,
              },
            },
          },
        });

        if (!detalhe) {
          const error = new Error('Atividade não encontrada para este aluno');
          (error as any).code = 'ATIVIDADE_NOT_FOUND';
          throw error;
        }

        return mapAtividadeDetalheAluno(detalhe);
      },
      { timeout: 15000, maxWait: 5000 },
    );
  },

  async getAulaDetalhe(usuarioId: string, cursoId: string, turmaId: string, aulaId: string) {
    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: {
        alunoId: usuarioId,
        turmaId,
        statusPagamento: STATUS_PAGAMENTO_LIBERADO,
        status: {
          in: STATUS_INSCRICAO_LISTAGEM_LIBERADA,
        },
        CursosTurmas: {
          id: turmaId,
          cursoId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!inscricao) {
      return null;
    }

    const aula = await prisma.cursosTurmasAulas.findFirst({
      where: {
        id: aulaId,
        turmaId,
        deletedAt: null,
        CursosTurmas: {
          id: turmaId,
          cursoId,
          deletedAt: null,
        },
      },
      include: {
        Cursos: {
          select: {
            id: true,
            codigo: true,
            nome: true,
          },
        },
        CursosTurmas: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            turno: true,
            metodo: true,
            Cursos: {
              select: {
                id: true,
                codigo: true,
                nome: true,
              },
            },
          },
        },
        CursosTurmasModulos: {
          select: { id: true, nome: true },
        },
        criadoPor: {
          select: { id: true, nomeCompleto: true, cpf: true },
        },
        instrutor: {
          select: {
            id: true,
            codUsuario: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            UsuariosInformation: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        CursosTurmasAulasMateriais: {
          select: { id: true, titulo: true, url: true, ordem: true, tipo: true },
          orderBy: { ordem: 'asc' },
        },
      },
    });

    if (!aula) {
      return null;
    }

    return mapAulaDetalheAluno(aula);
  },
};
