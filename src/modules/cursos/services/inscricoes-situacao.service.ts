import {
  AuditoriaCategoria,
  CursosCertificadosLogAcao,
  CursosCertificadosTipos,
  Prisma,
  StatusInscricao,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';
import { invalidateCacheByPrefix } from '@/utils/cache';
import { atualizarAgenda } from './agenda-matricula';
import { logger } from '@/utils/logger';

const log = logger.child({ module: 'InscricoesSituacao' });

/** O que a equipe escolhe → situação gravada na inscrição */
export const SITUACOES = {
  CONCLUIU: StatusInscricao.CONCLUIDO,
  NAO_CONCLUIU: StatusInscricao.CANCELADO,
  REPROVADO: StatusInscricao.REPROVADO,
  TRANCADO: StatusInscricao.TRANCADO,
  CURSANDO: StatusInscricao.INSCRITO,
} as const;
export type Situacao = keyof typeof SITUACOES;

const LOTE = 500;
const soDigitos = (valor: string | null | undefined) => (valor ?? '').replace(/\D/g, '');

export interface InscricaoParaSituacao {
  id: string;
  status: StatusInscricao;
  cpf: string | null;
  alunoId?: string;
  alunoNome?: string | null;
  certificados: { id: string; formato: CursosCertificadosTipos; revogadoEm: Date | null }[];
}

export interface PedidoSituacao {
  inscricaoIds?: string[];
  cpfs?: string[];
  /** Aplica a todos da turma que NÃO estão na lista (ex.: "só estes concluíram") */
  aplicarAosDemais?: boolean;
  situacao: Situacao;
}

/**
 * Decide o que muda, sem tocar no banco: quem é atingido, quais certificados são
 * revogados (quem não concluiu) ou restaurados (quem volta a "concluiu").
 */
export function planejarSituacao(inscricoes: InscricaoParaSituacao[], pedido: PedidoSituacao) {
  const selecionadas = new Set<string>();
  const porId = new Map(inscricoes.map((i) => [i.id, i]));
  (pedido.inscricaoIds ?? []).forEach((id) => {
    if (porId.has(id)) selecionadas.add(id);
  });

  const porCpf = new Map<string, string[]>();
  inscricoes.forEach((i) => {
    const cpf = soDigitos(i.cpf);
    if (cpf) porCpf.set(cpf, [...(porCpf.get(cpf) ?? []), i.id]);
  });
  const cpfsInvalidos: string[] = [];
  const naoEncontrados: string[] = [];
  const vistos = new Set<string>();
  (pedido.cpfs ?? []).forEach((bruto) => {
    const cpf = soDigitos(bruto);
    if (!cpf) return;
    if (cpf.length !== 11) {
      cpfsInvalidos.push(bruto.trim());
      return;
    }
    if (vistos.has(cpf)) return;
    vistos.add(cpf);
    const ids = porCpf.get(cpf);
    if (!ids) naoEncontrados.push(cpf);
    else ids.forEach((id) => selecionadas.add(id));
  });

  const alvo = pedido.aplicarAosDemais
    ? inscricoes.filter((i) => !selecionadas.has(i.id))
    : inscricoes.filter((i) => selecionadas.has(i.id));
  const novoStatus = SITUACOES[pedido.situacao];
  const concluiu = novoStatus === StatusInscricao.CONCLUIDO;

  const mudancas = alvo
    .map((i) => {
      const revogar = concluiu ? [] : i.certificados.filter((c) => !c.revogadoEm);
      const restaurar = concluiu ? i.certificados.filter((c) => c.revogadoEm) : [];
      return { inscricao: i, mudaStatus: i.status !== novoStatus, revogar, restaurar };
    })
    .filter((m) => m.mudaStatus || m.revogar.length > 0 || m.restaurar.length > 0);

  return {
    novoStatus,
    alvo,
    mudancas,
    resumo: {
      selecionados: selecionadas.size,
      naoEncontrados,
      cpfsInvalidos,
      atingidos: alvo.length,
      mudam: mudancas.length,
      jaNaSituacao: alvo.length - mudancas.length,
      certificadosARevogar: mudancas.reduce((n, m) => n + m.revogar.length, 0),
      certificadosARestaurar: mudancas.reduce((n, m) => n + m.restaurar.length, 0),
      concluintesSemCertificado: concluiu
        ? alvo.filter((i) => i.certificados.length === 0).length
        : 0,
    },
  };
}

const erro = (codigo: string, mensagem: string, status: number) =>
  Object.assign(new Error(mensagem), { code: codigo, statusCode: status });

export interface AtorSituacao {
  id: string;
  role?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Muda a situação de várias inscrições da turma de uma vez (por seleção ou lista de CPFs).
 * "Não concluiu" revoga o certificado (o código continua existindo, marcado como
 * revogado); voltar para "Concluiu" restaura o mesmo certificado. Tudo fica na auditoria.
 */
export async function alterarSituacaoEmLote(
  params: PedidoSituacao & {
    cursoId: string;
    turmaId: string;
    motivo: string;
    simular?: boolean;
    /** Quantos a prévia mostrou: se mudou, pede nova prévia */
    totalEsperado?: number;
    /** Notificação no painel para quem teve a situação alterada (padrão: não) */
    avisar?: boolean;
  },
  ator: AtorSituacao,
) {
  const turma = await prisma.cursosTurmas.findFirst({
    where: { id: params.turmaId, cursoId: params.cursoId },
    select: { id: true, nome: true },
  });
  if (!turma) throw erro('TURMA_NOT_FOUND', 'Turma não encontrada para o curso informado', 404);

  const temLista = Boolean(params.inscricaoIds?.length || params.cpfs?.length);
  if (!temLista) {
    throw erro('SITUACAO_SEM_ALUNOS', 'Selecione alunos ou informe uma lista de CPFs.', 400);
  }

  const registros = await prisma.cursosTurmasInscricoes.findMany({
    // Removidos pela equipe ficam de fora: a situação deles não muda por aqui
    where: { turmaId: params.turmaId, removidaEm: null },
    select: {
      id: true,
      status: true,
      alunoId: true,
      Usuarios: { select: { cpf: true, nomeCompleto: true } },
      CursosCertificadosEmitidos: { select: { id: true, formato: true, revogadoEm: true } },
    },
  });
  const inscricoes: InscricaoParaSituacao[] = registros.map((r) => ({
    id: r.id,
    status: r.status,
    cpf: r.Usuarios?.cpf ?? null,
    alunoId: r.alunoId,
    alunoNome: r.Usuarios?.nomeCompleto ?? null,
    certificados: r.CursosCertificadosEmitidos,
  }));

  const plano = planejarSituacao(inscricoes, params);
  if (plano.alvo.length === 0) {
    throw erro('SITUACAO_SEM_ALUNOS', 'Nenhum aluno desta turma corresponde à seleção.', 400);
  }
  if (params.simular) return { aplicado: false, ...plano.resumo };

  if (typeof params.totalEsperado === 'number' && params.totalEsperado !== plano.resumo.atingidos) {
    throw erro(
      'SITUACAO_ALVO_MUDOU',
      'A turma mudou desde a prévia. Gere a prévia de novo antes de aplicar.',
      409,
    );
  }

  const agora = new Date();
  const motivo = params.motivo.trim().slice(0, 480);
  for (let i = 0; i < plano.mudancas.length; i += LOTE) {
    const lote = plano.mudancas.slice(i, i + LOTE);
    const revogar = lote.flatMap((m) => m.revogar);
    const restaurar = lote.flatMap((m) => m.restaurar);
    await prisma.$transaction(
      async (tx) => {
        const comMudancaDeStatus = lote.filter((m) => m.mudaStatus).map((m) => m.inscricao.id);
        if (comMudancaDeStatus.length) {
          await tx.cursosTurmasInscricoes.updateMany({
            where: { id: { in: comMudancaDeStatus }, turmaId: params.turmaId },
            data: { status: plano.novoStatus },
          });
        }
        if (revogar.length) {
          await tx.cursosCertificadosEmitidos.updateMany({
            where: { id: { in: revogar.map((c) => c.id) }, revogadoEm: null },
            data: { revogadoEm: agora, revogadoPorId: ator.id, motivoRevogacao: motivo },
          });
          await tx.cursosCertificadosLogs.createMany({
            data: revogar.map((c) => ({
              certificadoId: c.id,
              acao: CursosCertificadosLogAcao.REVOGACAO,
              formato: c.formato,
              detalhes: `Revogado: ${motivo}`.slice(0, 500),
            })),
          });
        }
        if (restaurar.length) {
          await tx.cursosCertificadosEmitidos.updateMany({
            where: { id: { in: restaurar.map((c) => c.id) } },
            data: { revogadoEm: null, revogadoPorId: null, motivoRevogacao: null },
          });
          await tx.cursosCertificadosLogs.createMany({
            data: restaurar.map((c) => ({
              certificadoId: c.id,
              acao: CursosCertificadosLogAcao.RESTAURACAO,
              formato: c.formato,
              detalhes: `Restaurado: ${motivo}`.slice(0, 500),
            })),
          });
        }
        await tx.auditoriaLogs.createMany({
          data: lote.map((m) => ({
            categoria: AuditoriaCategoria.CURSO,
            tipo: 'CURSO_INSCRICAO',
            acao: 'INSCRICAO_SITUACAO_ALTERADA',
            usuarioId: ator.id,
            entidadeId: m.inscricao.id,
            entidadeTipo: 'CURSO_INSCRICAO',
            descricao: `Situação ${m.inscricao.status} → ${plano.novoStatus}: ${motivo}`.slice(
              0,
              500,
            ),
            dadosAnteriores: { status: m.inscricao.status } as Prisma.JsonObject,
            dadosNovos: { status: plano.novoStatus } as Prisma.JsonObject,
            metadata: {
              cursoId: params.cursoId,
              turmaId: params.turmaId,
              turmaNome: turma.nome,
              alunoId: m.inscricao.alunoId ?? null,
              alunoNome: m.inscricao.alunoNome ?? null,
              motivo,
              situacao: params.situacao,
              certificadosRevogados: m.revogar.map((c) => c.id),
              certificadosRestaurados: m.restaurar.map((c) => c.id),
              actorRole: ator.role ?? null,
            } as Prisma.JsonObject,
            ip: ator.ip ?? null,
            userAgent: ator.userAgent?.slice(0, 500) ?? null,
          })),
        });
      },
      { timeout: 60_000 },
    );
  }

  await Promise.all([
    invalidateCacheByPrefix('cursos:historico-inscricoes-curso'),
    invalidateCacheByPrefix('cursos:alunos'),
  ]).catch(() => undefined);

  log.info(
    { turmaId: params.turmaId, situacao: params.situacao, ...plano.resumo, atorId: ator.id },
    'Situação das inscrições alterada em lote',
  );

  // Não concluiu e trancado perdem o acesso (saem da agenda e dos convites do Meet);
  // voltar para cursando devolve
  const alunosQueMudaram = plano.mudancas
    .filter((m) => m.mudaStatus && m.inscricao.alunoId)
    .map((m) => m.inscricao.alunoId!);
  if (params.situacao === 'NAO_CONCLUIU' || params.situacao === 'TRANCADO') {
    atualizarAgenda(alunosQueMudaram, params.turmaId, 'saiu');
  } else if (params.situacao === 'CURSANDO') {
    atualizarAgenda(alunosQueMudaram, params.turmaId, 'entrou');
  }

  if (params.avisar) {
    const nomeDaSituacao: Record<Situacao, string> = {
      CONCLUIU: 'Concluiu',
      NAO_CONCLUIU: 'Não concluiu',
      REPROVADO: 'Reprovado',
      TRANCADO: 'Trancado',
      CURSANDO: 'Cursando',
    };
    for (const m of plano.mudancas.filter((x) => x.mudaStatus && x.inscricao.alunoId)) {
      await notificacoesService
        .criar({
          usuarioId: m.inscricao.alunoId!,
          tipo: 'TURMA_SITUACAO_ALTERADA',
          titulo: 'Sua situação em uma turma mudou',
          mensagem: `Na turma "${turma.nome}", sua situação agora é: ${nomeDaSituacao[params.situacao]}.`,
          prioridade: 'NORMAL',
        } as any)
        .catch((error: unknown) =>
          log.error({ err: error, inscricaoId: m.inscricao.id }, 'Falha ao notificar o aluno'),
        );
    }
  }

  return { aplicado: true, ...plano.resumo };
}
