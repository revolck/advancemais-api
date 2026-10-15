import { prisma } from '@/config/prisma';
import { instrutorOverviewService } from '@/modules/instrutor/services/overview.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { logger } from '@/utils/logger';

const log = logger.child({ module: 'AssistenteContexto' });
const DIA_MS = 86_400_000;

/** Fim do dia em Brasília (UTC-3, sem horário de verão) */
export const fimDoDiaEmBrasilia = (agora: Date) => {
  const local = new Date(agora.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 3));
};

/** Status de inscrição em que o aluno está cursando (mesma regra do painel do aluno) */
const INSCRICAO_EM_CURSO = ['INSCRITO', 'EM_ANDAMENTO', 'EM_ESTAGIO'] as const;

/** Próxima entrevista e quantas há nos próximos 7 dias */
async function entrevistas(where: Record<string, unknown>, agora: Date) {
  const filtro = {
    ...where,
    status: 'AGENDADA' as const,
    dataInicio: { gte: agora, lt: new Date(agora.getTime() + 7 * DIA_MS) },
  };
  const [total, proxima] = await Promise.all([
    prisma.empresasVagasEntrevistas.count({ where: filtro }),
    prisma.empresasVagasEntrevistas.findFirst({
      where: filtro,
      orderBy: { dataInicio: 'asc' },
      select: { dataInicio: true },
    }),
  ]);
  return { proximos7Dias: total, proxima: proxima?.dataInicio.toISOString() ?? null };
}

export async function contextoEmpresa(usuarioId: string, agora = new Date()) {
  const [plano, premium, porStatus, candidatosNovos, agenda] = await Promise.all([
    prisma.empresasPlano.findFirst({
      where: { usuarioId, status: 'ATIVO', OR: [{ fim: null }, { fim: { gt: agora } }] },
      orderBy: { inicio: 'desc' },
      select: {
        modo: true,
        fim: true,
        PlanosEmpresariais: { select: { nome: true, quantidadeVagas: true } },
      },
    }),
    prisma.empresasRecursosPremiumVagas.findFirst({
      where: { empresaId: usuarioId, ativo: true, vagasIlimitadas: true },
      select: { empresaId: true },
    }),
    prisma.empresasVagas.groupBy({
      by: ['status'],
      where: { usuarioId },
      _count: { _all: true },
    }),
    prisma.empresasCandidatos.count({
      where: {
        empresaUsuarioId: usuarioId,
        aplicadaEm: { gte: new Date(agora.getTime() - 7 * DIA_MS) },
      },
    }),
    entrevistas({ empresaUsuarioId: usuarioId }, agora),
  ]);

  const vagas = Object.fromEntries(porStatus.map((g) => [g.status, g._count._all]));
  return {
    plano: plano
      ? {
          nome: plano.PlanosEmpresariais?.nome ?? null,
          modo: plano.modo,
          fim: plano.fim?.toISOString() ?? null,
          limiteVagas: plano.PlanosEmpresariais?.quantidadeVagas ?? null,
        }
      : null,
    vagasIlimitadas: Boolean(premium),
    vagas: {
      publicadas: vagas.PUBLICADO ?? 0,
      emAnalise: vagas.EM_ANALISE ?? 0,
      rascunhos: vagas.RASCUNHO ?? 0,
    },
    candidatosNovos7Dias: candidatosNovos,
    entrevistas: agenda,
  };
}

export async function contextoAluno(usuarioId: string, agora = new Date()) {
  const [emCurso, aguardandoPagamento, concluidos, certificados, curriculos, candidaturas, agenda] =
    await Promise.all([
      prisma.cursosTurmasInscricoes.findMany({
        where: {
          alunoId: usuarioId,
          statusPagamento: 'APROVADO',
          status: { in: [...INSCRICAO_EM_CURSO] },
        },
        orderBy: { criadoEm: 'desc' },
        take: 3,
        select: {
          turmaId: true,
          CursosTurmas: { select: { nome: true, Cursos: { select: { id: true, nome: true } } } },
        },
      }),
      prisma.cursosTurmasInscricoes.count({
        where: { alunoId: usuarioId, status: 'AGUARDANDO_PAGAMENTO' },
      }),
      prisma.cursosTurmasInscricoes.count({ where: { alunoId: usuarioId, status: 'CONCLUIDO' } }),
      prisma.cursosCertificadosEmitidos.count({
        where: { CursosTurmasInscricoes: { alunoId: usuarioId }, revogadoEm: null },
      }),
      prisma.usuariosCurriculos.count({ where: { usuarioId } }),
      prisma.empresasCandidatos.count({ where: { candidatoId: usuarioId } }),
      entrevistas({ candidatoId: usuarioId }, agora),
    ]);

  return {
    cursosEmAndamento: emCurso
      .filter((i) => i.CursosTurmas?.Cursos?.id)
      .map((i) => ({
        cursoId: i.CursosTurmas.Cursos.id,
        turmaId: i.turmaId,
        curso: i.CursosTurmas.Cursos.nome,
        turma: i.CursosTurmas.nome,
      })),
    inscricoesAguardandoPagamento: aguardandoPagamento,
    cursosConcluidos: concluidos,
    certificados,
    curriculos,
    candidaturas,
    entrevistas: agenda,
  };
}

export async function contextoEquipe(usuarioId: string, role: string, agora = new Date()) {
  const seteDiasAtras = new Date(agora.getTime() - 7 * DIA_MS);

  switch (role) {
    case 'ADMIN':
    case 'MODERADOR': {
      const [vagasEmAnalise, usuariosPendentes, empresasNovas] = await Promise.all([
        prisma.empresasVagas.count({ where: { status: 'EM_ANALISE' } }),
        prisma.usuarios.count({ where: { status: 'PENDENTE' } }),
        prisma.usuarios.count({ where: { role: 'EMPRESA', criadoEm: { gte: seteDiasAtras } } }),
      ]);
      return { vagasEmAnalise, usuariosPendentes, empresasNovas7Dias: empresasNovas };
    }
    case 'SETOR_DE_VAGAS': {
      const [vagasEmAnalise, empresasNovas] = await Promise.all([
        prisma.empresasVagas.count({ where: { status: 'EM_ANALISE' } }),
        prisma.usuarios.count({ where: { role: 'EMPRESA', criadoEm: { gte: seteDiasAtras } } }),
      ]);
      return { vagasEmAnalise, empresasNovas7Dias: empresasNovas };
    }
    case 'RECRUTADOR': {
      const vagaIds = await recrutadorVagasService.listVagaIds(usuarioId);
      const minhas = { OR: [{ recrutadorId: usuarioId }, { vagaId: { in: vagaIds } }] };
      const [agenda, hoje, candidatosNovos] = await Promise.all([
        entrevistas(minhas, agora),
        prisma.empresasVagasEntrevistas.count({
          where: {
            ...minhas,
            status: 'AGENDADA',
            dataInicio: { gte: agora, lt: fimDoDiaEmBrasilia(agora) },
          },
        }),
        vagaIds.length
          ? prisma.empresasCandidatos.count({
              where: { vagaId: { in: vagaIds }, aplicadaEm: { gte: seteDiasAtras } },
            })
          : Promise.resolve(0),
      ]);
      return {
        vagasVinculadas: vagaIds.length,
        entrevistasHoje: hoje,
        entrevistas: agenda,
        candidatosNovos7Dias: candidatosNovos,
      };
    }
    case 'INSTRUTOR': {
      const visao = await instrutorOverviewService.getOverview(usuarioId);
      return {
        turmas: visao.metricasGerais.totalTurmas,
        aulasHoje: visao.cards.aulas.hoje,
        provasParaCorrigir: visao.cards.provas.pendentesCorrecao,
        notasPendentes: visao.cards.notas.pendentes,
      };
    }
    case 'PEDAGOGICO': {
      const [turmasEmAndamento, aguardandoPagamento, certificadosAEmitir] = await Promise.all([
        prisma.cursosTurmas.count({ where: { status: 'EM_ANDAMENTO' } }),
        prisma.cursosTurmasInscricoes.count({ where: { status: 'AGUARDANDO_PAGAMENTO' } }),
        prisma.cursosTurmasInscricoes.count({
          where: { status: 'CONCLUIDO', CursosCertificadosEmitidos: { none: {} } },
        }),
      ]);
      return {
        turmasEmAndamento,
        inscricoesAguardandoPagamento: aguardandoPagamento,
        certificadosAEmitir,
      };
    }
    default:
      return {};
  }
}

/**
 * Fatos do dia para o assistente, conforme a função de quem está logado. Só contagens:
 * o texto e as regras do que oferecer ficam no painel. Se uma consulta falhar, o
 * assistente segue com a ajuda genérica (bloco null).
 */
export async function obterContexto(usuario: { id: string; role: string }) {
  const agora = new Date();
  const seguro = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (error) {
      log.warn({ err: error, usuarioId: usuario.id, role: usuario.role }, 'Contexto do assistente');
      return null;
    }
  };

  if (usuario.role === 'EMPRESA') {
    return { role: usuario.role, empresa: await seguro(() => contextoEmpresa(usuario.id, agora)) };
  }
  if (usuario.role === 'ALUNO_CANDIDATO') {
    return { role: usuario.role, aluno: await seguro(() => contextoAluno(usuario.id, agora)) };
  }
  return {
    role: usuario.role,
    equipe: await seguro(() => contextoEquipe(usuario.id, usuario.role, agora)),
  };
}
