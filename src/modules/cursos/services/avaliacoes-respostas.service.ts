import { AuditoriaCategoria, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { auditoriaService } from '@/modules/auditoria/services/auditoria.service';

import { avaliacoesService } from './avaliacoes.service';
import { provasService } from './provas.service';

type UsuarioLogado = {
  id?: string;
  role?: string;
};

type StatusCorrecao = 'PENDENTE' | 'CORRIGIDA';
type CorrecaoHistoricoAcao =
  | 'CORRECAO_MANUAL'
  | 'NOTA_REGISTRADA'
  | 'NOTA_EDITADA'
  | 'CORRECAO_AUTOMATICA';
type HistoricoTipo = 'RESPOSTA' | 'CORRECAO';

const CORRECAO_HISTORICO_ACOES: CorrecaoHistoricoAcao[] = [
  'CORRECAO_MANUAL',
  'NOTA_REGISTRADA',
  'NOTA_EDITADA',
  'CORRECAO_AUTOMATICA',
];

const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

const toIso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

const formatNotaBr = (value: number | null) => {
  if (value === null) return null;
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

const resolveStatusCorrecao = (
  envioNota: Prisma.Decimal | number | null | undefined,
  respostasCorrigidas: boolean[],
): StatusCorrecao => {
  if (envioNota !== null && envioNota !== undefined) return 'CORRIGIDA';
  if (respostasCorrigidas.length > 0 && respostasCorrigidas.every(Boolean)) return 'CORRIGIDA';
  return 'PENDENTE';
};

const getConcluidoEm = (
  realizadoEm: Date | null | undefined,
  respostaDatas: (Date | null | undefined)[],
): Date | null => {
  if (realizadoEm) return realizadoEm;
  const validDates = respostaDatas.filter((date): date is Date => Boolean(date));
  if (validDates.length === 0) return null;
  return new Date(Math.max(...validDates.map((date) => date.getTime())));
};

const getResumo = (
  respostas: {
    alternativaCorreta: boolean | null;
    temConteudo: boolean;
  }[],
  questoesTotal: number,
) => {
  const questoesRespondidas = respostas.filter((item) => item.temConteudo).length;
  const questoesCorretas = respostas.filter((item) => item.alternativaCorreta === true).length;
  return { questoesTotal, questoesRespondidas, questoesCorretas };
};

const mapIpPorEntidade = (
  logs: { entidadeId: string | null; ip: string | null; acao: string | null }[],
) => {
  const porEnvio = new Map<string, string>();

  for (const log of logs) {
    if (!log.entidadeId || !log.ip) continue;
    // IP de envio não pode ser sobrescrito por logs de correção manual.
    if (log.acao && CORRECAO_HISTORICO_ACOES.includes(log.acao as CorrecaoHistoricoAcao)) continue;
    if (!porEnvio.has(log.entidadeId)) porEnvio.set(log.entidadeId, log.ip);
  }

  return porEnvio;
};

const buildDescricaoCorrecao = (
  notaAnterior: number | null,
  notaNova: number | null,
  tipoAvaliacao: 'PROVA' | 'ATIVIDADE',
): { acao: CorrecaoHistoricoAcao; descricao: string } => {
  const alvo = tipoAvaliacao === 'ATIVIDADE' ? 'atividade' : 'prova';
  const notaAnteriorFmt = formatNotaBr(notaAnterior);
  const notaNovaFmt = formatNotaBr(notaNova);

  if (notaAnterior === null && notaNova !== null) {
    return {
      acao: 'NOTA_REGISTRADA',
      descricao: `Correcao da ${alvo}: nota registrada ${notaNovaFmt}`,
    };
  }

  if (notaAnterior !== null && notaNova !== null && notaAnterior !== notaNova) {
    return {
      acao: 'NOTA_EDITADA',
      descricao: `Correcao da ${alvo}: nota antiga ${notaAnteriorFmt}, nota nova ${notaNovaFmt}`,
    };
  }

  if (notaAnterior !== null && notaNova === null) {
    return {
      acao: 'CORRECAO_MANUAL',
      descricao: `Correcao da ${alvo}: nota removida (de ${notaAnteriorFmt} para sem nota)`,
    };
  }

  return {
    acao: 'CORRECAO_MANUAL',
    descricao: `Correcao da ${alvo} atualizada (sem alteracao de nota)`,
  };
};

const parseNotaHistorico = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const mapHistoricoAcao = (acao: string) => {
  switch (acao) {
    case 'RESPOSTA_REGISTRADA':
      return { acaoLabel: 'Resposta enviada', tipo: 'RESPOSTA' as HistoricoTipo };
    case 'NOTA_REGISTRADA':
      return { acaoLabel: 'Nota registrada', tipo: 'CORRECAO' as HistoricoTipo };
    case 'NOTA_EDITADA':
      return { acaoLabel: 'Nota editada', tipo: 'CORRECAO' as HistoricoTipo };
    case 'CORRECAO_MANUAL':
      return { acaoLabel: 'Correção atualizada', tipo: 'CORRECAO' as HistoricoTipo };
    case 'CORRECAO_AUTOMATICA':
      return { acaoLabel: 'Correção automática', tipo: 'CORRECAO' as HistoricoTipo };
    default:
      return {
        acaoLabel: acao.replace(/_/g, ' ').toLowerCase(),
        tipo: 'RESPOSTA' as HistoricoTipo,
      };
  }
};

const getAvaliacao = async (avaliacaoId: string, usuarioLogado: UsuarioLogado) => {
  const avaliacao = await avaliacoesService.get(avaliacaoId, usuarioLogado);
  return avaliacao as {
    id: string;
    cursoId: string | null;
    turmaId: string | null;
    titulo: string;
    tipo: 'PROVA' | 'ATIVIDADE';
    tipoAtividade: 'QUESTOES' | 'PERGUNTA_RESPOSTA' | null;
    peso: number;
    valePonto: boolean;
    questoes?: {
      id: string;
      ordem: number;
      enunciado: string;
      tipo: string;
      peso: number | null;
      alternativas?: { id: string; texto: string; correta: boolean }[];
    }[];
  };
};

const resolveSubmissionContext = async (
  avaliacaoId: string,
  turmaId: string,
  respostaId: string,
) => {
  const envio = await prisma.cursosTurmasProvasEnvios.findFirst({
    where: { id: respostaId, provaId: avaliacaoId },
    select: { id: true, inscricaoId: true },
  });
  if (envio) {
    return { groupId: envio.id, inscricaoId: envio.inscricaoId };
  }

  const resposta = await prisma.cursosTurmasProvasRespostas.findFirst({
    where: {
      id: respostaId,
      CursosTurmasProvasQuestoes: { provaId: avaliacaoId },
      CursosTurmasInscricoes: { turmaId },
    },
    select: { inscricaoId: true },
  });
  if (resposta) {
    return { groupId: resposta.inscricaoId, inscricaoId: resposta.inscricaoId };
  }

  const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
    where: {
      id: respostaId,
      turmaId,
      OR: [
        { CursosTurmasProvasEnvios: { some: { provaId: avaliacaoId } } },
        {
          CursosTurmasProvasRespostas: {
            some: { CursosTurmasProvasQuestoes: { provaId: avaliacaoId } },
          },
        },
      ],
    },
    select: { id: true },
  });

  if (inscricao) {
    return { groupId: inscricao.id, inscricaoId: inscricao.id };
  }

  const error = new Error('Resposta não encontrada para a avaliação informada');
  (error as any).code = 'RESPOSTA_NOT_FOUND';
  throw error;
};

export const avaliacoesRespostasService = {
  async listHistorico(
    query: {
      avaliacaoId: string;
      page: number;
      pageSize: number;
      tipo?: string;
      acao?: string;
      alteradoPor?: string;
      startDate?: Date;
      endDate?: Date;
    },
    usuarioLogado: UsuarioLogado,
  ) {
    const avaliacao = await getAvaliacao(query.avaliacaoId, usuarioLogado);

    const envios = await prisma.cursosTurmasProvasEnvios.findMany({
      where: { provaId: query.avaliacaoId },
      select: {
        id: true,
        CursosTurmasInscricoes: {
          select: { codigo: true },
        },
      },
    });
    const envioIds = envios.map((envio) => envio.id);
    const codigoInscricaoPorEntidade = new Map(
      envios.map((envio) => [envio.id, envio.CursosTurmasInscricoes.codigo ?? null]),
    );

    const where: Prisma.AuditoriaLogsWhereInput = {
      entidadeTipo: 'PROVA_RESPOSTA',
      ...(query.alteradoPor ? { usuarioId: query.alteradoPor } : {}),
      ...(query.acao ? { acao: query.acao } : {}),
      ...(query.tipo === 'CORRECAO'
        ? { acao: { in: CORRECAO_HISTORICO_ACOES } }
        : query.tipo === 'RESPOSTA'
          ? { acao: { notIn: CORRECAO_HISTORICO_ACOES } }
          : {}),
      ...(query.startDate || query.endDate
        ? {
            criadoEm: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
      OR: [
        { metadata: { path: ['avaliacaoId'], equals: query.avaliacaoId } },
        { dadosNovos: { path: ['avaliacaoId'], equals: query.avaliacaoId } },
        { dadosAnteriores: { path: ['avaliacaoId'], equals: query.avaliacaoId } },
        ...(envioIds.length > 0 ? [{ entidadeId: { in: envioIds } }] : []),
      ],
    };

    const [logs, total] = await Promise.all([
      prisma.auditoriaLogs.findMany({
        where,
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              role: true,
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditoriaLogs.count({ where }),
    ]);

    const dataMapped = logs.map((log) => {
      const { acaoLabel, tipo } = mapHistoricoAcao(log.acao);
      let descricao = log.descricao ?? '';
      const metadata = (log.metadata as Record<string, unknown> | null) ?? {};
      const dadosAnteriores = (log.dadosAnteriores as Record<string, unknown> | null) ?? {};
      const dadosNovos = (log.dadosNovos as Record<string, unknown> | null) ?? {};
      const codigoInscricaoEntidade = log.entidadeId
        ? codigoInscricaoPorEntidade.get(log.entidadeId)
        : null;
      const codigoInscricao =
        (metadata.codigoInscricao as string | undefined) ??
        (dadosNovos.codigoInscricao as string | undefined) ??
        (dadosAnteriores.codigoInscricao as string | undefined) ??
        codigoInscricaoEntidade ??
        null;

      if (
        (log.acao === 'CORRECAO_MANUAL' ||
          log.acao === 'NOTA_REGISTRADA' ||
          log.acao === 'NOTA_EDITADA') &&
        /corre[cç][aã]o manual da avalia[cç][aã]o/i.test(descricao)
      ) {
        const notaAnterior =
          parseNotaHistorico(metadata.notaAnterior) ?? parseNotaHistorico(dadosAnteriores.nota);
        const notaNova =
          parseNotaHistorico(metadata.notaNova) ?? parseNotaHistorico(dadosNovos.nota);
        descricao = buildDescricaoCorrecao(notaAnterior, notaNova, avaliacao.tipo).descricao;
      }

      if (log.acao === 'RESPOSTA_REGISTRADA') {
        const hasUuidInDescricao =
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(descricao);
        const hasLegacyRespostaDescricao =
          /envio de resposta na avalia[cç][aã]o/i.test(descricao) ||
          /resposta enviada/i.test(descricao);

        if (hasUuidInDescricao || hasLegacyRespostaDescricao || descricao.trim().length === 0) {
          const alvo = avaliacao.tipo === 'PROVA' ? 'prova' : 'atividade';
          descricao = codigoInscricao
            ? `Submissão ${codigoInscricao} registrada`
            : `Submissão da ${alvo} registrada`;
        }
      }

      return {
        id: log.id,
        tipo,
        tipoLabel: tipo === 'CORRECAO' ? 'Correção' : 'Resposta',
        tipoAvaliacao: avaliacao.tipo,
        tipoAvaliacaoLabel: avaliacao.tipo === 'PROVA' ? 'Prova' : 'Atividade',
        acao: log.acao,
        acaoLabel,
        descricao,
        alteradoPor: log.Usuarios
          ? {
              id: log.Usuarios.id,
              nome: log.Usuarios.nomeCompleto,
              role: log.Usuarios.role,
            }
          : null,
        ator: log.Usuarios
          ? {
              id: log.Usuarios.id,
              nome: log.Usuarios.nomeCompleto,
              role: log.Usuarios.role,
            }
          : null,
        ocorridoEm: log.criadoEm.toISOString(),
        criadoEm: log.criadoEm.toISOString(),
        metadata: log.metadata,
        dadosAnteriores: log.dadosAnteriores,
        dadosNovos: log.dadosNovos,
      };
    });

    return {
      success: true,
      data: dataMapped,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  },

  async list(
    avaliacaoId: string,
    query: {
      page: number;
      pageSize: number;
      search?: string;
      statusCorrecao?: StatusCorrecao;
      orderBy?: 'concluidoEm' | 'alunoNome' | 'nota';
      order?: 'asc' | 'desc';
    },
    usuarioLogado: UsuarioLogado,
  ) {
    const avaliacao = await getAvaliacao(avaliacaoId, usuarioLogado);
    if (!avaliacao.turmaId) {
      return {
        success: true,
        data: [],
        pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 },
      };
    }

    const questoesTotal = avaliacao.questoes?.length ?? 0;
    const search = query.search?.trim();
    const andFilters: Prisma.CursosTurmasInscricoesWhereInput[] = [];

    if (search) {
      andFilters.push({
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { Usuarios: { nomeCompleto: { contains: search, mode: 'insensitive' } } },
          { Usuarios: { cpf: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.CursosTurmasInscricoesWhereInput = {
      turmaId: avaliacao.turmaId,
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            cpf: true,
            email: true,
            UsuariosInformation: { select: { avatarUrl: true } },
          },
        },
        CursosTurmasProvasEnvios: {
          where: { provaId: avaliacaoId },
          select: { id: true, nota: true, realizadoEm: true, criadoEm: true },
          take: 1,
          orderBy: { criadoEm: 'desc' },
        },
        CursosTurmasProvasRespostas: {
          where: { CursosTurmasProvasQuestoes: { provaId: avaliacaoId } },
          select: {
            id: true,
            corrigida: true,
            nota: true,
            criadoEm: true,
            respostaTexto: true,
            alternativaId: true,
            anexoUrl: true,
            CursosTurmasProvasQuestoesAlternativas: { select: { correta: true } },
          },
        },
      },
    });

    const dataBase = inscricoes.map((inscricao) => {
      const envio = inscricao.CursosTurmasProvasEnvios[0] ?? null;
      const respostas = inscricao.CursosTurmasProvasRespostas;
      const concluidoEm = getConcluidoEm(
        envio?.realizadoEm,
        respostas.map((resposta) => resposta.criadoEm),
      );

      const resumo = getResumo(
        respostas.map((resposta) => ({
          alternativaCorreta: resposta.CursosTurmasProvasQuestoesAlternativas?.correta ?? null,
          temConteudo: Boolean(
            resposta.respostaTexto || resposta.alternativaId || resposta.anexoUrl,
          ),
        })),
        questoesTotal,
      );

      const statusCorrecao = resolveStatusCorrecao(
        envio?.nota ?? null,
        respostas.map((resposta) => resposta.corrigida),
      );

      const nota =
        toNumber(envio?.nota) ??
        (respostas.some((resposta) => resposta.nota !== null)
          ? toNumber(
              respostas.reduce<Prisma.Decimal | number>(
                (acc, resposta) => Number(acc) + Number(resposta.nota ?? 0),
                0,
              ),
            )
          : null);

      return {
        id: envio?.id ?? inscricao.id,
        avaliacaoId,
        inscricaoId: inscricao.id,
        codigoInscricao: inscricao.codigo,
        aluno: {
          id: inscricao.Usuarios.id,
          nomeCompleto: inscricao.Usuarios.nomeCompleto,
          cpf: inscricao.Usuarios.cpf,
          email: inscricao.Usuarios.email,
          avatarUrl: inscricao.Usuarios.UsuariosInformation?.avatarUrl ?? null,
        },
        tipoAvaliacao: avaliacao.tipo,
        tipoAtividade: avaliacao.tipoAtividade,
        statusCorrecao,
        nota,
        notaMaxima: 10,
        peso: avaliacao.peso ?? 0,
        valeNota: avaliacao.valePonto ?? true,
        valePonto: avaliacao.valePonto ?? true,
        concluidoEm: toIso(concluidoEm),
        ipEnvio: null as string | null,
        resumo,
      };
    });

    const entidadesIds = dataBase.map((item) => item.id);
    const logsIp =
      entidadesIds.length > 0
        ? await prisma.auditoriaLogs.findMany({
            where: {
              entidadeTipo: 'PROVA_RESPOSTA',
              entidadeId: { in: entidadesIds },
              ip: { not: null },
            },
            orderBy: { criadoEm: 'desc' },
            select: {
              entidadeId: true,
              ip: true,
              acao: true,
            },
          })
        : [];

    const ipPorEntidade = mapIpPorEntidade(logsIp);
    const data = dataBase.map((item) => ({
      ...item,
      ipEnvio: ipPorEntidade.get(item.id) ?? null,
    }));

    const filtered =
      query.statusCorrecao !== undefined
        ? data.filter((item) => item.statusCorrecao === query.statusCorrecao)
        : data;

    const orderBy = query.orderBy ?? 'concluidoEm';
    const direction = query.order ?? 'desc';

    const sorted = filtered.sort((a, b) => {
      const multiplier = direction === 'asc' ? 1 : -1;
      if (orderBy === 'alunoNome') {
        return a.aluno.nomeCompleto.localeCompare(b.aluno.nomeCompleto) * multiplier;
      }
      if (orderBy === 'nota') {
        return ((a.nota ?? -1) - (b.nota ?? -1)) * multiplier;
      }
      const aTime = a.concluidoEm ? new Date(a.concluidoEm).getTime() : 0;
      const bTime = b.concluidoEm ? new Date(b.concluidoEm).getTime() : 0;
      return (aTime - bTime) * multiplier;
    });

    const total = sorted.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
    const start = (query.page - 1) * query.pageSize;
    const pageData = sorted.slice(start, start + query.pageSize);

    return {
      success: true,
      data: pageData,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    };
  },

  async get(avaliacaoId: string, respostaId: string, usuarioLogado: UsuarioLogado) {
    const avaliacao = await getAvaliacao(avaliacaoId, usuarioLogado);
    if (!avaliacao.turmaId) {
      const error = new Error('Avaliação sem turma não possui respostas');
      (error as any).code = 'RESPOSTA_NOT_FOUND';
      throw error;
    }

    const context = await resolveSubmissionContext(avaliacaoId, avaliacao.turmaId, respostaId);

    const [inscricao, envio, respostas, ultimaCorrecao, logsIp] = await Promise.all([
      prisma.cursosTurmasInscricoes.findUnique({
        where: { id: context.inscricaoId },
        select: {
          id: true,
          codigo: true,
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              cpf: true,
              email: true,
              UsuariosInformation: { select: { avatarUrl: true } },
            },
          },
        },
      }),
      prisma.cursosTurmasProvasEnvios.findUnique({
        where: {
          provaId_inscricaoId: {
            provaId: avaliacaoId,
            inscricaoId: context.inscricaoId,
          },
        },
        select: {
          id: true,
          nota: true,
          realizadoEm: true,
          observacoes: true,
          atualizadoEm: true,
        },
      }),
      prisma.cursosTurmasProvasRespostas.findMany({
        where: {
          inscricaoId: context.inscricaoId,
          CursosTurmasProvasQuestoes: { provaId: avaliacaoId },
        },
        include: {
          CursosTurmasProvasQuestoes: {
            include: {
              CursosTurmasProvasQuestoesAlternativas: {
                orderBy: { ordem: 'asc' },
              },
            },
          },
          CursosTurmasProvasQuestoesAlternativas: true,
        },
        orderBy: { CursosTurmasProvasQuestoes: { ordem: 'asc' } },
      }),
      prisma.auditoriaLogs.findFirst({
        where: {
          entidadeTipo: 'PROVA_RESPOSTA',
          entidadeId: context.groupId,
          acao: {
            in: CORRECAO_HISTORICO_ACOES,
          },
        },
        orderBy: { criadoEm: 'desc' },
        include: {
          Usuarios: {
            select: { id: true, nomeCompleto: true },
          },
        },
      }),
      prisma.auditoriaLogs.findMany({
        where: {
          entidadeTipo: 'PROVA_RESPOSTA',
          entidadeId: context.groupId,
          ip: { not: null },
        },
        orderBy: { criadoEm: 'desc' },
        take: 10,
        select: {
          entidadeId: true,
          ip: true,
          acao: true,
        },
      }),
    ]);

    if (!inscricao) {
      const error = new Error('Inscrição não encontrada para a resposta');
      (error as any).code = 'RESPOSTA_NOT_FOUND';
      throw error;
    }

    const statusCorrecao = resolveStatusCorrecao(
      envio?.nota ?? null,
      respostas.map((resposta) => resposta.corrigida),
    );
    const nota = toNumber(envio?.nota);
    const concluidoEm = getConcluidoEm(
      envio?.realizadoEm,
      respostas.map((resposta) => resposta.criadoEm),
    );
    const ipPorEntidade = mapIpPorEntidade(logsIp);
    const ipEnvio = ipPorEntidade.get(context.groupId) ?? null;

    if (avaliacao.tipo === 'ATIVIDADE' && avaliacao.tipoAtividade === 'PERGUNTA_RESPOSTA') {
      const questao = avaliacao.questoes?.[0] ?? null;
      const resposta = respostas[0] ?? null;
      const anexos = respostas
        .filter((item) => item.anexoUrl)
        .map((item) => ({
          nome: item.anexoNome ?? 'anexo',
          url: item.anexoUrl as string,
        }));

      return {
        success: true,
        data: {
          id: context.groupId,
          avaliacaoId,
          tipoAvaliacao: avaliacao.tipo,
          tipoAtividade: avaliacao.tipoAtividade,
          aluno: {
            id: inscricao.Usuarios.id,
            nomeCompleto: inscricao.Usuarios.nomeCompleto,
            cpf: inscricao.Usuarios.cpf,
          },
          enunciado: questao?.enunciado ?? avaliacao.titulo,
          respostaAluno: {
            texto: resposta?.respostaTexto ?? null,
            anexos,
          },
          statusCorrecao,
          nota,
          notaMaxima: 10,
          peso: avaliacao.peso ?? 0,
          valeNota: avaliacao.valePonto ?? true,
          valePonto: avaliacao.valePonto ?? true,
          concluidoEm: toIso(concluidoEm),
          ipEnvio,
          corrigidoEm: ultimaCorrecao?.criadoEm?.toISOString() ?? null,
          corrigidoPor: ultimaCorrecao?.Usuarios
            ? { id: ultimaCorrecao.Usuarios.id, nome: ultimaCorrecao.Usuarios.nomeCompleto }
            : null,
          feedback: envio?.observacoes ?? null,
        },
      };
    }

    const respostaByQuestao = new Map(respostas.map((resposta) => [resposta.questaoId, resposta]));

    const itens =
      avaliacao.questoes?.map((questao) => {
        const resposta = respostaByQuestao.get(questao.id);
        const correta =
          questao.alternativas?.find((alternativa) => alternativa.correta) ??
          resposta?.CursosTurmasProvasQuestoes.CursosTurmasProvasQuestoesAlternativas.find(
            (alternativa) => alternativa.correta,
          );

        const alternativaAluno = resposta?.CursosTurmasProvasQuestoesAlternativas;
        const acertou =
          alternativaAluno && correta
            ? alternativaAluno.id === correta.id
            : (null as boolean | null);

        return {
          questaoId: questao.id,
          ordem: questao.ordem,
          enunciado: questao.enunciado,
          tipo: questao.tipo,
          peso: questao.peso,
          respostaAluno: resposta
            ? {
                alternativaId: alternativaAluno?.id ?? null,
                texto: alternativaAluno?.texto ?? resposta.respostaTexto ?? null,
                anexoUrl: resposta.anexoUrl ?? null,
                anexoNome: resposta.anexoNome ?? null,
              }
            : null,
          respostaCorreta: correta
            ? {
                alternativaId: correta.id,
                texto: correta.texto,
              }
            : null,
          acertou,
          notaItem: toNumber(resposta?.nota),
        };
      }) ?? [];

    return {
      success: true,
      data: {
        id: context.groupId,
        avaliacaoId,
        inscricaoId: context.inscricaoId,
        aluno: {
          id: inscricao.Usuarios.id,
          nomeCompleto: inscricao.Usuarios.nomeCompleto,
          cpf: inscricao.Usuarios.cpf,
        },
        statusCorrecao,
        nota,
        concluidoEm: toIso(concluidoEm),
        ipEnvio,
        corrigidoEm: ultimaCorrecao?.criadoEm?.toISOString() ?? null,
        corrigidoPor: ultimaCorrecao?.Usuarios
          ? { id: ultimaCorrecao.Usuarios.id, nome: ultimaCorrecao.Usuarios.nomeCompleto }
          : null,
        feedback: envio?.observacoes ?? null,
        itens,
      },
    };
  },

  async corrigir(
    avaliacaoId: string,
    respostaId: string,
    input: {
      nota?: number | null;
      feedback?: string | null;
      statusCorrecao?: StatusCorrecao;
    },
    usuarioLogado: UsuarioLogado,
    metadata?: { ip?: string; userAgent?: string },
  ) {
    const avaliacao = await getAvaliacao(avaliacaoId, usuarioLogado);
    if (avaliacao.tipo === 'PROVA') {
      const error = new Error(
        'Provas possuem correção automática. Não é permitido aplicar correção manual.',
      );
      (error as any).code = 'PROVA_AUTO_CORRECAO';
      throw error;
    }
    if (!avaliacao.turmaId) {
      const error = new Error('Avaliação sem turma não suporta correção de respostas');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const context = await resolveSubmissionContext(avaliacaoId, avaliacao.turmaId, respostaId);
    const [envioAntes, respostasAntes, inscricao] = await Promise.all([
      prisma.cursosTurmasProvasEnvios.findUnique({
        where: {
          provaId_inscricaoId: {
            provaId: avaliacaoId,
            inscricaoId: context.inscricaoId,
          },
        },
        select: {
          nota: true,
          observacoes: true,
        },
      }),
      prisma.cursosTurmasProvasRespostas.findMany({
        where: {
          inscricaoId: context.inscricaoId,
          CursosTurmasProvasQuestoes: { provaId: avaliacaoId },
        },
        select: {
          corrigida: true,
        },
      }),
      prisma.cursosTurmasInscricoes.findUnique({
        where: {
          id: context.inscricaoId,
        },
        select: {
          codigo: true,
        },
      }),
    ]);

    const notaAnterior = toNumber(envioAntes?.nota);
    const feedbackAnterior = envioAntes?.observacoes ?? null;
    const statusAnterior = resolveStatusCorrecao(
      envioAntes?.nota ?? null,
      respostasAntes.map((resposta) => resposta.corrigida),
    );
    const statusCorrecao = input.statusCorrecao ?? 'CORRIGIDA';
    const corrigida = statusCorrecao === 'CORRIGIDA';
    const notaFoiInformada = Object.prototype.hasOwnProperty.call(input, 'nota');
    const notaAplicada = notaFoiInformada ? (input.nota ?? null) : undefined;

    if (corrigida && notaAplicada !== undefined && notaAplicada !== null && avaliacao.cursoId) {
      await provasService.registrarNota(avaliacao.cursoId, avaliacao.turmaId!, avaliacaoId, {
        inscricaoId: context.inscricaoId,
        nota: notaAplicada,
        observacoes: input.feedback ?? null,
      });
    } else {
      await prisma.cursosTurmasProvasEnvios.upsert({
        where: {
          provaId_inscricaoId: {
            provaId: avaliacaoId,
            inscricaoId: context.inscricaoId,
          },
        },
        update: {
          nota:
            notaAplicada === undefined
              ? undefined
              : notaAplicada === null
                ? null
                : new Prisma.Decimal(notaAplicada),
          observacoes: input.feedback ?? undefined,
        },
        create: {
          provaId: avaliacaoId,
          inscricaoId: context.inscricaoId,
          nota:
            notaAplicada === undefined || notaAplicada === null
              ? null
              : new Prisma.Decimal(notaAplicada),
          observacoes: input.feedback ?? null,
          realizadoEm: null,
        },
      });
    }

    await prisma.cursosTurmasProvasRespostas.updateMany({
      where: {
        inscricaoId: context.inscricaoId,
        CursosTurmasProvasQuestoes: { provaId: avaliacaoId },
      },
      data: {
        corrigida,
        observacoes: input.feedback ?? undefined,
      },
    });

    const envioDepois = await prisma.cursosTurmasProvasEnvios.findUnique({
      where: {
        provaId_inscricaoId: {
          provaId: avaliacaoId,
          inscricaoId: context.inscricaoId,
        },
      },
      select: {
        nota: true,
        observacoes: true,
      },
    });
    const notaNova = toNumber(envioDepois?.nota);
    const feedbackNovo = envioDepois?.observacoes ?? null;
    const statusNovo = resolveStatusCorrecao(envioDepois?.nota ?? null, [corrigida]);
    const feedbackAlterado =
      input.feedback !== undefined && (feedbackAnterior ?? null) !== (feedbackNovo ?? null);
    const eventoCorrecao = buildDescricaoCorrecao(notaAnterior, notaNova, avaliacao.tipo);
    const corrigidoEm = new Date();
    const corrigidoPorId = usuarioLogado.id ?? null;

    if (usuarioLogado.id) {
      await auditoriaService.registrarLog({
        categoria: AuditoriaCategoria.CURSO,
        tipo: 'PROVA_CORRECAO',
        acao: eventoCorrecao.acao,
        usuarioId: usuarioLogado.id,
        entidadeId: context.groupId,
        entidadeTipo: 'PROVA_RESPOSTA',
        descricao: eventoCorrecao.descricao,
        dadosAnteriores: {
          avaliacaoId,
          inscricaoId: context.inscricaoId,
          codigoInscricao: inscricao?.codigo ?? null,
          statusCorrecao: statusAnterior,
          nota: notaAnterior,
          feedback: feedbackAnterior,
        },
        dadosNovos: {
          avaliacaoId,
          inscricaoId: context.inscricaoId,
          codigoInscricao: inscricao?.codigo ?? null,
          statusCorrecao,
          nota: notaNova,
          feedback: feedbackNovo,
          corrigidoPorId,
          corrigidoEm: corrigidoEm.toISOString(),
        },
        metadata: {
          avaliacaoId,
          inscricaoId: context.inscricaoId,
          codigoInscricao: inscricao?.codigo ?? null,
          respostaId: context.groupId,
          notaAnterior,
          notaNova,
          statusCorrecaoAnterior: statusAnterior,
          statusCorrecaoNovo: statusNovo,
          feedbackAlterado,
          corrigidoPorId,
          corrigidoEm: corrigidoEm.toISOString(),
          turmaId: avaliacao.turmaId,
          cursoId: avaliacao.cursoId,
        },
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
      });
    }

    return {
      success: true,
      message: 'Resposta corrigida com sucesso',
      data: {
        id: context.groupId,
        statusCorrecao,
        nota: notaNova,
        corrigidoEm: corrigidoEm.toISOString(),
      },
    };
  },
};
