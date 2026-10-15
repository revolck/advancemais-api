import {
  AuditoriaCategoria,
  CursoStatus,
  CursosCertificadosLogAcao,
  Prisma,
  Roles,
  Status,
  StatusInscricao,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { EmailConfigManager } from '@/modules/email/config/email-config';
import { EmailService } from '@/modules/email/services/email-service';
import { EmailTemplates } from '@/modules/email/templates/email-templates';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';
import { invalidateCacheByPrefix } from '@/utils/cache';
import { logger } from '@/utils/logger';
import { generateUniqueInscricaoCode } from '../utils/code-generator';
import { createLateEnrollmentAccessRecords } from './turmas.service';

/**
 * Matrícula pela equipe (administração, moderação e pedagógico): adicionar, reativar e
 * remover alunos de uma turma, inclusive em andamento ou concluída. Remover nunca apaga:
 * a inscrição fica cancelada e marcada como removida, com histórico, notas, frequência e
 * certificado (revogado) guardados; adicionar de novo reativa a mesma inscrição.
 * Toda ação tem prévia, motivo e um registro por aluno na auditoria.
 */

const log = logger.child({ module: 'InscricoesEquipe' });

export type PagamentoMatricula = 'CONCEDIDO' | 'COBRANCA_PENDENTE';
export type OrigemAcao = 'TURMA' | 'ALUNO' | 'ROTA_ANTIGA';

export interface AtorEquipe {
  id: string;
  role?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

const MAX_POR_ACAO = 200;
/** Ocupam vaga: tudo que não foi cancelado nem trancado (e não removido) */
const STATUS_SEM_VAGA: StatusInscricao[] = [StatusInscricao.CANCELADO, StatusInscricao.TRANCADO];

const erro = (code: string, message: string, statusCode: number) =>
  Object.assign(new Error(message), { code, statusCode });

const motivoLimpo = (motivo: string) => motivo.trim().slice(0, 480);

/** Pagamento escolhido pela equipe → campos da inscrição */
const camposDePagamento = (pagamento: PagamentoMatricula, valorCurso: number | null) =>
  pagamento === 'CONCEDIDO'
    ? {
        status: StatusInscricao.INSCRITO,
        statusPagamento: 'APROVADO',
        metodoPagamento: 'ADMINISTRATIVO',
        valorOriginal: valorCurso,
        valorDesconto: valorCurso,
        valorFinal: 0,
        valorPago: 0,
      }
    : {
        status: StatusInscricao.AGUARDANDO_PAGAMENTO,
        statusPagamento: 'PENDENTE',
        metodoPagamento: null,
        valorOriginal: valorCurso,
        valorDesconto: 0,
        valorFinal: valorCurso,
        valorPago: null,
      };

// ---------------------------------------------------------------------------
// Adicionar / reativar
// ---------------------------------------------------------------------------

export interface PedidoAdicao {
  cursoId: string;
  turmaId: string;
  alunoIds: string[];
  motivo: string;
  pagamento: PagamentoMatricula;
  /** Aviso no painel e e-mail ao aluno (padrão: sim) */
  avisar?: boolean;
  simular?: boolean;
  origemAcao?: OrigemAcao;
}

interface AlunoResumo {
  alunoId: string;
  nome: string;
}

export async function adicionarAlunos(pedido: PedidoAdicao, ator: AtorEquipe) {
  const ids = [...new Set(pedido.alunoIds.filter(Boolean))];
  if (ids.length === 0) throw erro('SEM_ALUNOS', 'Selecione pelo menos um aluno.', 400);
  if (ids.length > MAX_POR_ACAO) {
    throw erro('MUITOS_ALUNOS', `Adicione no máximo ${MAX_POR_ACAO} alunos por vez.`, 400);
  }

  const turma = await prisma.cursosTurmas.findFirst({
    where: { id: pedido.turmaId, cursoId: pedido.cursoId, deletedAt: null },
    select: {
      id: true,
      nome: true,
      codigo: true,
      status: true,
      vagasTotais: true,
      vagasIlimitadas: true,
      dataInicio: true,
      dataFim: true,
      dataInscricaoFim: true,
      Cursos: { select: { id: true, nome: true, valor: true, gratuito: true } },
    },
  });
  if (!turma) throw erro('TURMA_NOT_FOUND', 'Turma não encontrada para o curso informado.', 404);
  if (turma.status === CursoStatus.CANCELADO) {
    throw erro('TURMA_CANCELADA', 'Turma cancelada não recebe alunos.', 409);
  }
  // O aluno paga pelo checkout do site, que só vende turma aberta: cobrança pendente em
  // turma concluída ou em rascunho ficaria sem como pagar
  if (
    pedido.pagamento === 'COBRANCA_PENDENTE' &&
    (turma.status === CursoStatus.CONCLUIDO || turma.status === CursoStatus.RASCUNHO)
  ) {
    throw erro(
      'COBRANCA_INDISPONIVEL',
      'Esta turma não está aberta para pagamento pelo site. Use "Concedido pela equipe".',
      409,
    );
  }

  const [alunos, existentes, outrasDoCurso, ocupadas] = await Promise.all([
    prisma.usuarios.findMany({
      where: { id: { in: ids } },
      select: { id: true, nomeCompleto: true, email: true, role: true, status: true },
    }),
    prisma.cursosTurmasInscricoes.findMany({
      where: { turmaId: turma.id, alunoId: { in: ids } },
      select: {
        id: true,
        alunoId: true,
        status: true,
        statusPagamento: true,
        removidaEm: true,
        statusAntesRemocao: true,
      },
    }),
    prisma.cursosTurmasInscricoes.findMany({
      where: {
        alunoId: { in: ids },
        turmaId: { not: turma.id },
        removidaEm: null,
        status: { notIn: STATUS_SEM_VAGA },
        CursosTurmas: { cursoId: pedido.cursoId, deletedAt: null },
      },
      select: { alunoId: true, CursosTurmas: { select: { nome: true } } },
    }),
    prisma.cursosTurmasInscricoes.count({
      where: { turmaId: turma.id, removidaEm: null, status: { notIn: STATUS_SEM_VAGA } },
    }),
  ]);

  const alunoPorId = new Map(alunos.map((a) => [a.id, a]));
  const inscricaoPorAluno = new Map(existentes.map((i) => [i.alunoId, i]));
  const adicionar: AlunoResumo[] = [];
  const reativar: (AlunoResumo & { inscricaoId: string })[] = [];
  const jaNaTurma: AlunoResumo[] = [];
  const recusados: { alunoId: string; nome: string | null; motivo: string }[] = [];

  for (const id of ids) {
    const aluno = alunoPorId.get(id);
    if (!aluno) {
      recusados.push({ alunoId: id, nome: null, motivo: 'Aluno não encontrado.' });
      continue;
    }
    if (aluno.role !== Roles.ALUNO_CANDIDATO) {
      recusados.push({ alunoId: id, nome: aluno.nomeCompleto, motivo: 'A conta não é de aluno.' });
      continue;
    }
    if (aluno.status !== Status.ATIVO) {
      recusados.push({
        alunoId: id,
        nome: aluno.nomeCompleto,
        motivo: 'A conta do aluno está bloqueada ou inativa.',
      });
      continue;
    }
    const existente = inscricaoPorAluno.get(id);
    if (existente && !existente.removidaEm) {
      jaNaTurma.push({ alunoId: id, nome: aluno.nomeCompleto });
    } else if (existente) {
      reativar.push({ alunoId: id, nome: aluno.nomeCompleto, inscricaoId: existente.id });
    } else {
      adicionar.push({ alunoId: id, nome: aluno.nomeCompleto });
    }
  }

  const agora = new Date();
  const entram = adicionar.length + reativar.length;
  const limite = !turma.vagasIlimitadas && turma.vagasTotais > 0 ? turma.vagasTotais : null;
  const avisos = {
    turmaConcluida: turma.status === CursoStatus.CONCLUIDO,
    turmaIniciada: Boolean(turma.dataInicio && turma.dataInicio <= agora),
    prazoDeInscricaoEncerrado: Boolean(turma.dataInscricaoFim && turma.dataInscricaoFim < agora),
    excedeVagas: limite !== null && ocupadas + entram > limite,
    outrasTurmasDoCurso: outrasDoCurso
      .filter(
        (o) =>
          adicionar.some((a) => a.alunoId === o.alunoId) ||
          reativar.some((r) => r.alunoId === o.alunoId),
      )
      .map((o) => ({
        alunoId: o.alunoId,
        nome: alunoPorId.get(o.alunoId)?.nomeCompleto ?? '',
        turma: o.CursosTurmas.nome,
      })),
  };
  const resumo = {
    adicionar,
    reativar: reativar.map(({ alunoId, nome }) => ({ alunoId, nome })),
    jaNaTurma,
    recusados,
    avisos,
    vagas: { ocupadas, limite, depois: ocupadas + entram },
  };

  if (pedido.simular) return { aplicado: false, ...resumo };
  if (entram === 0) {
    throw erro('NADA_A_ADICIONAR', 'Nenhum dos alunos selecionados pode ser adicionado.', 400);
  }

  const motivo = motivoLimpo(pedido.motivo);
  const valorCurso = turma.Cursos.gratuito ? 0 : Number(turma.Cursos.valor ?? 0) || 0;
  const pagamento = camposDePagamento(pedido.pagamento, valorCurso);
  const origemAcao = pedido.origemAcao ?? 'TURMA';
  const inscricaoIds: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      for (const aluno of adicionar) {
        // Código de inscrição do aluno (mesmo comportamento da matrícula atual)
        const info = await tx.usuariosInformation.findUnique({
          where: { usuarioId: aluno.alunoId },
          select: { inscricao: true },
        });
        if (info && !info.inscricao) {
          await tx.usuariosInformation.update({
            where: { usuarioId: aluno.alunoId },
            data: { inscricao: await generateUniqueInscricaoCode(tx, log) },
          });
        }
        const criada = await tx.cursosTurmasInscricoes.create({
          data: {
            turmaId: turma.id,
            alunoId: aluno.alunoId,
            origem: 'EQUIPE',
            adicionadaPorId: ator.id,
            ...pagamento,
          },
          select: { id: true },
        });
        inscricaoIds.push(criada.id);
        if (avisos.turmaIniciada && turma.status !== CursoStatus.CONCLUIDO) {
          await createLateEnrollmentAccessRecords(tx, {
            turmaId: turma.id,
            inscricaoId: criada.id,
            enrolledAt: agora,
            turmaDataFim: turma.dataFim ?? null,
            criadoPorId: ator.id,
          });
        }
        await tx.auditoriaLogs.create({
          data: registroDeAuditoria({
            acao: 'INSCRICAO_ADICIONADA_PELA_EQUIPE',
            inscricaoId: criada.id,
            aluno,
            turma,
            cursoId: pedido.cursoId,
            ator,
            motivo,
            descricao: `Adicionado(a) à turma ${turma.nome}: ${motivo}`,
            antes: null,
            depois: { status: pagamento.status, statusPagamento: pagamento.statusPagamento },
            extra: { origem: origemAcao, pagamento: pedido.pagamento, avisos },
          }),
        });
      }

      for (const aluno of reativar) {
        const atual = existentes.find((e) => e.id === aluno.inscricaoId)!;
        const statusRestaurado = atual.statusAntesRemocao ?? StatusInscricao.INSCRITO;
        // Já pago: mantém o pagamento; senão vale a escolha da equipe
        const dadosPagamento =
          atual.statusPagamento === 'APROVADO'
            ? { status: statusRestaurado }
            : pedido.pagamento === 'CONCEDIDO'
              ? { ...pagamento, status: statusRestaurado }
              : pagamento;
        await tx.cursosTurmasInscricoes.update({
          where: { id: aluno.inscricaoId },
          data: {
            ...dadosPagamento,
            removidaEm: null,
            removidaPorId: null,
            motivoRemocao: null,
            statusAntesRemocao: null,
          },
        });
        // Voltou como concluinte: o certificado revogado na remoção volta a valer
        if (dadosPagamento.status === StatusInscricao.CONCLUIDO) {
          const revogados = await tx.cursosCertificadosEmitidos.findMany({
            where: { inscricaoId: aluno.inscricaoId, revogadoEm: { not: null } },
            select: { id: true, formato: true },
          });
          if (revogados.length) {
            await tx.cursosCertificadosEmitidos.updateMany({
              where: { id: { in: revogados.map((c) => c.id) } },
              data: { revogadoEm: null, revogadoPorId: null, motivoRevogacao: null },
            });
            await tx.cursosCertificadosLogs.createMany({
              data: revogados.map((c) => ({
                certificadoId: c.id,
                acao: CursosCertificadosLogAcao.RESTAURACAO,
                formato: c.formato,
                detalhes: `Restaurado ao reativar na turma: ${motivo}`.slice(0, 500),
              })),
            });
          }
        }
        inscricaoIds.push(aluno.inscricaoId);
        await tx.auditoriaLogs.create({
          data: registroDeAuditoria({
            acao: 'INSCRICAO_REATIVADA',
            inscricaoId: aluno.inscricaoId,
            aluno,
            turma,
            cursoId: pedido.cursoId,
            ator,
            motivo,
            descricao: `Reativado(a) na turma ${turma.nome}: ${motivo}`,
            antes: { status: atual.status, removida: true },
            depois: { status: dadosPagamento.status },
            extra: { origem: origemAcao, pagamento: pedido.pagamento, avisos },
          }),
        });
      }
    },
    { timeout: 60_000 },
  );

  await invalidarCaches();
  log.info(
    {
      turmaId: turma.id,
      adicionados: adicionar.length,
      reativados: reativar.length,
      atorId: ator.id,
      pagamento: pedido.pagamento,
    },
    'Alunos adicionados à turma pela equipe',
  );

  const novos = [...adicionar, ...reativar];
  if (pedido.avisar !== false) {
    await avisarAdicao(novos, alunoPorId, turma, pedido.pagamento);
  }
  sincronizarAgenda(
    novos.map((a) => a.alunoId),
    turma.id,
  );

  return { aplicado: true, ...resumo, inscricaoIds };
}

// ---------------------------------------------------------------------------
// Remover (desvincula preservando o histórico)
// ---------------------------------------------------------------------------

export interface PedidoRemocao {
  cursoId: string;
  turmaId: string;
  inscricaoIds: string[];
  motivo: string;
  avisar?: boolean;
  simular?: boolean;
  /** Quantos a prévia mostrou: se mudou, pede nova prévia */
  totalEsperado?: number;
  origemAcao?: OrigemAcao;
}

export async function removerAlunos(pedido: PedidoRemocao, ator: AtorEquipe) {
  const ids = [...new Set(pedido.inscricaoIds.filter(Boolean))];
  if (ids.length === 0) throw erro('SEM_ALUNOS', 'Selecione pelo menos um aluno.', 400);
  if (ids.length > MAX_POR_ACAO) {
    throw erro('MUITOS_ALUNOS', `Remova no máximo ${MAX_POR_ACAO} alunos por vez.`, 400);
  }

  const turma = await prisma.cursosTurmas.findFirst({
    where: { id: pedido.turmaId, cursoId: pedido.cursoId, deletedAt: null },
    select: { id: true, nome: true, codigo: true, Cursos: { select: { id: true, nome: true } } },
  });
  if (!turma) throw erro('TURMA_NOT_FOUND', 'Turma não encontrada para o curso informado.', 404);

  const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
    where: { id: { in: ids }, turmaId: turma.id },
    select: {
      id: true,
      alunoId: true,
      status: true,
      statusPagamento: true,
      removidaEm: true,
      Usuarios: { select: { nomeCompleto: true } },
      CursosCertificadosEmitidos: { select: { id: true, formato: true, revogadoEm: true } },
    },
  });
  const alvo = inscricoes.filter((i) => !i.removidaEm);
  const certificadosARevogar = alvo.flatMap((i) =>
    i.CursosCertificadosEmitidos.filter((c) => !c.revogadoEm),
  );
  const resumo = {
    remover: alvo.map((i) => ({
      inscricaoId: i.id,
      alunoId: i.alunoId,
      nome: i.Usuarios.nomeCompleto,
    })),
    jaRemovidas: inscricoes.length - alvo.length,
    naoEncontradas: ids.length - inscricoes.length,
    certificadosARevogar: certificadosARevogar.length,
    cobrancasACancelar: alvo.filter((i) => i.statusPagamento === 'PENDENTE').length,
  };

  if (pedido.simular) return { aplicado: false, ...resumo };
  if (alvo.length === 0) {
    throw erro('NADA_A_REMOVER', 'Nenhum dos alunos selecionados está ativo nesta turma.', 400);
  }
  if (typeof pedido.totalEsperado === 'number' && pedido.totalEsperado !== alvo.length) {
    throw erro('ALVO_MUDOU', 'A turma mudou desde a prévia. Gere a prévia de novo.', 409);
  }

  const agora = new Date();
  const motivo = motivoLimpo(pedido.motivo);
  const origemAcao = pedido.origemAcao ?? 'TURMA';

  await prisma.$transaction(
    async (tx) => {
      for (const inscricao of alvo) {
        await tx.cursosTurmasInscricoes.update({
          where: { id: inscricao.id },
          data: {
            status: StatusInscricao.CANCELADO,
            statusAntesRemocao: inscricao.status,
            removidaEm: agora,
            removidaPorId: ator.id,
            motivoRemocao: motivo,
            // Cobrança que ainda não foi paga deixa de valer
            ...(inscricao.statusPagamento === 'PENDENTE' ? { statusPagamento: 'CANCELADO' } : {}),
          },
        });
        const revogar = inscricao.CursosCertificadosEmitidos.filter((c) => !c.revogadoEm);
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
              detalhes: `Revogado ao remover da turma: ${motivo}`.slice(0, 500),
            })),
          });
        }
        await tx.auditoriaLogs.create({
          data: registroDeAuditoria({
            acao: 'INSCRICAO_REMOVIDA',
            inscricaoId: inscricao.id,
            aluno: { alunoId: inscricao.alunoId, nome: inscricao.Usuarios.nomeCompleto },
            turma,
            cursoId: pedido.cursoId,
            ator,
            motivo,
            descricao: `Removido(a) da turma ${turma.nome}: ${motivo}`,
            antes: { status: inscricao.status, statusPagamento: inscricao.statusPagamento },
            depois: { status: StatusInscricao.CANCELADO, removida: true },
            extra: { origem: origemAcao, certificadosRevogados: revogar.map((c) => c.id) },
          }),
        });
      }
    },
    { timeout: 60_000 },
  );

  await invalidarCaches();
  log.info(
    { turmaId: turma.id, removidos: alvo.length, atorId: ator.id },
    'Alunos removidos da turma',
  );

  if (pedido.avisar !== false) {
    for (const inscricao of alvo) {
      await notificar({
        usuarioId: inscricao.alunoId,
        tipo: 'TURMA_MATRICULA_REMOVIDA',
        titulo: 'Você saiu de uma turma',
        mensagem: `Sua matrícula na turma "${turma.nome}" do curso "${turma.Cursos.nome}" foi encerrada pela equipe. Em caso de dúvida, fale com a secretaria.`,
      });
    }
  }

  return { aplicado: true, ...resumo };
}

/** Rota antiga DELETE …/inscricoes/:alunoId: mesma remoção, achando a inscrição pelo aluno */
export async function removerAlunoDaTurma(
  cursoId: string,
  turmaId: string,
  alunoId: string,
  motivo: string,
  ator: AtorEquipe,
) {
  const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
    where: { turmaId_alunoId: { turmaId, alunoId } },
    select: { id: true, removidaEm: true },
  });
  if (!inscricao || inscricao.removidaEm) {
    throw erro('ALUNO_NAO_INSCRITO', 'Aluno não está inscrito nesta turma.', 404);
  }
  return removerAlunos(
    {
      cursoId,
      turmaId,
      inscricaoIds: [inscricao.id],
      motivo,
      avisar: false,
      origemAcao: 'ROTA_ANTIGA',
    },
    ator,
  );
}

/** Mudança de status que não é uma "situação" (ex.: em estágio): só registra na auditoria */
export async function registrarStatusAvulso(
  p: {
    cursoId: string;
    turmaId: string;
    inscricaoId: string;
    de: string;
    para: string;
    motivo: string;
  },
  ator: AtorEquipe,
) {
  const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
    where: { id: p.inscricaoId },
    select: {
      alunoId: true,
      Usuarios: { select: { nomeCompleto: true } },
      CursosTurmas: { select: { id: true, nome: true, codigo: true } },
    },
  });
  if (!inscricao) return;
  await prisma.auditoriaLogs
    .create({
      data: registroDeAuditoria({
        acao: 'INSCRICAO_SITUACAO_ALTERADA',
        inscricaoId: p.inscricaoId,
        aluno: { alunoId: inscricao.alunoId, nome: inscricao.Usuarios.nomeCompleto },
        turma: inscricao.CursosTurmas,
        cursoId: p.cursoId,
        ator,
        motivo: p.motivo,
        descricao: `Situação ${p.de} → ${p.para}: ${p.motivo}`,
        antes: { status: p.de },
        depois: { status: p.para },
        extra: { origem: 'ROTA_ANTIGA' },
      }),
    })
    .catch((error) => log.error({ err: error }, 'Falha ao registrar mudança de status'));
}

// ---------------------------------------------------------------------------
// Histórico da turma (para a aba Histórico)
// ---------------------------------------------------------------------------

export async function historicoDeInscricoesDaTurma(cursoId: string, turmaId: string) {
  const registros = await prisma.auditoriaLogs.findMany({
    where: {
      entidadeTipo: 'CURSO_INSCRICAO',
      metadata: { path: ['turmaId'], equals: turmaId },
    },
    orderBy: { criadoEm: 'desc' },
    take: 300,
    select: {
      id: true,
      acao: true,
      descricao: true,
      criadoEm: true,
      dadosAnteriores: true,
      dadosNovos: true,
      metadata: true,
      Usuarios: { select: { id: true, nomeCompleto: true, role: true } },
    },
  });
  return (
    registros
      // Registros antigos do lote não guardavam o curso: só descarta curso diferente explícito
      .filter((r) => {
        const curso = (r.metadata as Record<string, unknown> | null)?.cursoId;
        return !curso || curso === cursoId;
      })
      .map((r) => {
        const meta = (r.metadata as Record<string, unknown> | null) ?? {};
        return {
          id: r.id,
          acao: r.acao,
          descricao: r.descricao,
          criadoEm: r.criadoEm.toISOString(),
          aluno: { id: (meta.alunoId as string) ?? null, nome: (meta.alunoNome as string) ?? null },
          motivo: (meta.motivo as string) ?? null,
          origem: (meta.origem as string) ?? null,
          antes: r.dadosAnteriores,
          depois: r.dadosNovos,
          ator: r.Usuarios
            ? { id: r.Usuarios.id, nome: r.Usuarios.nomeCompleto, role: r.Usuarios.role }
            : null,
        };
      })
  );
}

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

function registroDeAuditoria(p: {
  acao: string;
  inscricaoId: string;
  aluno: AlunoResumo;
  turma: { id: string; nome: string; codigo: string | null };
  cursoId: string;
  ator: AtorEquipe;
  motivo: string;
  descricao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  extra: Record<string, unknown>;
}): Prisma.AuditoriaLogsCreateInput | Prisma.AuditoriaLogsUncheckedCreateInput {
  return {
    categoria: AuditoriaCategoria.CURSO,
    tipo: 'CURSO_INSCRICAO',
    acao: p.acao,
    usuarioId: p.ator.id,
    entidadeId: p.inscricaoId,
    entidadeTipo: 'CURSO_INSCRICAO',
    descricao: p.descricao.slice(0, 500),
    dadosAnteriores: (p.antes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    dadosNovos: (p.depois ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    metadata: {
      cursoId: p.cursoId,
      turmaId: p.turma.id,
      turmaNome: p.turma.nome,
      alunoId: p.aluno.alunoId,
      alunoNome: p.aluno.nome,
      motivo: p.motivo,
      actorRole: p.ator.role ?? null,
      ...p.extra,
    } as Prisma.InputJsonValue,
    ip: p.ator.ip ?? null,
    userAgent: p.ator.userAgent?.slice(0, 500) ?? null,
  };
}

async function invalidarCaches() {
  await Promise.all([
    invalidateCacheByPrefix('cursos:historico-inscricoes-curso'),
    invalidateCacheByPrefix('cursos:alunos'),
  ]).catch(() => undefined);
}

async function notificar(p: {
  usuarioId: string;
  tipo: 'TURMA_MATRICULA_ADICIONADA' | 'TURMA_MATRICULA_REMOVIDA' | 'TURMA_SITUACAO_ALTERADA';
  titulo: string;
  mensagem: string;
  linkAcao?: string;
}) {
  try {
    await notificacoesService.criar({ ...p, prioridade: 'NORMAL' });
  } catch (error) {
    log.error({ err: error, usuarioId: p.usuarioId, tipo: p.tipo }, 'Falha ao notificar o aluno');
  }
}

async function avisarAdicao(
  alunos: AlunoResumo[],
  alunoPorId: Map<string, { email: string; nomeCompleto: string }>,
  turma: { id: string; nome: string; Cursos: { id: string; nome: string } },
  pagamento: PagamentoMatricula,
) {
  const pendente = pagamento === 'COBRANCA_PENDENTE';
  const caminho = pendente
    ? `/cursos/${turma.Cursos.id}`
    : `/dashboard/cursos/alunos/cursos/${turma.Cursos.id}/${turma.id}`;
  let frontend = '';
  try {
    const config = await EmailConfigManager.getInstance().getRuntimeConfig();
    frontend = config.urls.frontend.replace(/\/$/, '');
  } catch (error) {
    log.error({ err: error }, 'Sem URL do site para o e-mail de matrícula');
  }
  const emailService = new EmailService();

  for (const aluno of alunos) {
    await notificar({
      usuarioId: aluno.alunoId,
      tipo: 'TURMA_MATRICULA_ADICIONADA',
      titulo: pendente ? 'Vaga reservada em um curso' : 'Você foi matriculado(a) em um curso',
      mensagem: pendente
        ? `Reservamos sua vaga na turma "${turma.nome}" do curso "${turma.Cursos.nome}". Conclua o pagamento para começar.`
        : `Você foi matriculado(a) na turma "${turma.nome}" do curso "${turma.Cursos.nome}". O acesso já está liberado.`,
      linkAcao: caminho,
    });
    const dados = alunoPorId.get(aluno.alunoId);
    if (!dados?.email || !frontend) continue;
    try {
      const email = EmailTemplates.generateMatriculaEquipeEmail({
        nomeAluno: dados.nomeCompleto,
        cursoNome: turma.Cursos.nome,
        turmaNome: turma.nome,
        pagamentoPendente: pendente,
        link: `${frontend}${caminho}`,
      });
      await emailService.sendGeneric(
        dados.email,
        dados.nomeCompleto,
        email.subject,
        email.html,
        email.text,
      );
    } catch (error) {
      log.error({ err: error, alunoId: aluno.alunoId }, 'Falha ao enviar e-mail de matrícula');
    }
  }
}

function sincronizarAgenda(alunoIds: string[], turmaId: string) {
  if (alunoIds.length === 0) return;
  setImmediate(async () => {
    try {
      const {
        googleCalendarService,
      } = require('@/modules/cursos/aulas/services/google-calendar.service');
      for (const alunoId of alunoIds) {
        await googleCalendarService.sincronizarAgendaAluno({ alunoId, turmaId });
      }
    } catch (error: any) {
      log.error({ err: error, turmaId }, 'Falha ao sincronizar a agenda dos alunos adicionados');
    }
  });
}
