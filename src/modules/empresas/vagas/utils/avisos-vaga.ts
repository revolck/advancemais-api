import { NotificacaoStatus, Roles, Status, StatusDeVagas } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';
import type { CriarNotificacaoInput } from '@/modules/notificacoes/validators/notificacoes.schema';
import { logger } from '@/utils/logger';

const avisosLogger = logger.child({ module: 'AvisosVaga' });

const linkDaVaga = (vagaId: string) => `/dashboard/empresas/vagas/${vagaId}`;
const LINK_PLANOS = '/dashboard/upgrade';
/** Mesmo aviso de limite, para a mesma vaga, não se repete enquanto não for lido (1h) */
const JANELA_SEM_REPETIR_MS = 60 * 60 * 1000;

const NOME_DA_SITUACAO: Record<StatusDeVagas, string> = {
  RASCUNHO: 'Rascunho',
  EM_ANALISE: 'Em análise',
  PUBLICADO: 'Publicada',
  DESPUBLICADA: 'Despublicada',
  PAUSADA: 'Pausada',
  ENCERRADA: 'Encerrada',
  EXPIRADO: 'Expirada',
};

export interface VagaDoAviso {
  id: string;
  usuarioId: string;
  titulo: string;
}

interface Ocupacao {
  limite: number | null;
  emUso: number;
}

/**
 * Cria a notificação para a empresa dona da vaga. Falha ao notificar nunca desfaz a ação
 * (já concluída): fica só no log de erro.
 */
async function avisar(
  vaga: VagaDoAviso,
  aviso: Omit<CriarNotificacaoInput, 'usuarioId' | 'vagaId'>,
  opcoes?: { semRepetir?: boolean },
) {
  try {
    if (opcoes?.semRepetir) {
      const recente = await prisma.notificacoes.findFirst({
        where: {
          usuarioId: vaga.usuarioId,
          vagaId: vaga.id,
          tipo: aviso.tipo as any,
          status: NotificacaoStatus.NAO_LIDA,
          criadoEm: { gte: new Date(Date.now() - JANELA_SEM_REPETIR_MS) },
        },
        select: { id: true },
      });
      if (recente) return;
    }
    await notificacoesService.criar({ ...aviso, usuarioId: vaga.usuarioId, vagaId: vaga.id });
  } catch (error) {
    avisosLogger.error(
      { err: error, vagaId: vaga.id, tipo: aviso.tipo },
      'Não foi possível notificar a empresa sobre a vaga',
    );
  }
}

export const avisosDaVaga = {
  /** Entrou na fila do setor de vagas (cadastro, envio ou edição de vaga publicada) */
  emAnalise: (vaga: VagaDoAviso, motivo: 'CADASTRADA' | 'ENVIADA' | 'EDITADA') =>
    avisar(vaga, {
      tipo: 'VAGA_EM_ANALISE',
      titulo: motivo === 'EDITADA' ? 'Vaga voltou para aprovação' : 'Vaga enviada para aprovação',
      mensagem:
        motivo === 'EDITADA'
          ? `As alterações na vaga "${vaga.titulo}" foram enviadas para o setor de vagas. Ela fica fora do ar até ser aprovada de novo.`
          : `Sua vaga "${vaga.titulo}" está na fila de aprovação do setor de vagas. Avisaremos assim que ela for analisada.`,
      prioridade: 'NORMAL',
      linkAcao: linkDaVaga(vaga.id),
    }),

  /** Recursos premium publicam sem passar pela fila */
  publicadaDireto: (vaga: VagaDoAviso) =>
    avisar(vaga, {
      tipo: 'VAGA_APROVADA',
      titulo: 'Vaga publicada',
      mensagem: `Sua vaga "${vaga.titulo}" foi publicada e já está visível para os candidatos.`,
      prioridade: 'NORMAL',
      linkAcao: linkDaVaga(vaga.id),
    }),

  despublicada: (vaga: VagaDoAviso, pelaEquipe: boolean) =>
    avisar(vaga, {
      tipo: 'VAGA_DESPUBLICADA',
      titulo: 'Vaga despublicada',
      mensagem: pelaEquipe
        ? `Sua vaga "${vaga.titulo}" foi despublicada pelo setor de vagas e não aparece mais para os candidatos.`
        : `A vaga "${vaga.titulo}" foi despublicada e não aparece mais para os candidatos. Quando quiser, envie para aprovação de novo.`,
      prioridade: pelaEquipe ? 'ALTA' : 'NORMAL',
      linkAcao: linkDaVaga(vaga.id),
    }),

  /** Prazo de inscrições acabou (rotina de expiração) */
  expirada: (vaga: VagaDoAviso) =>
    avisar(vaga, {
      tipo: 'VAGA_EXPIRADA',
      titulo: 'Inscrições encerradas',
      mensagem: `O prazo de inscrições da vaga "${vaga.titulo}" terminou e ela saiu do ar. Os candidatos que já se inscreveram continuam na vaga.`,
      prioridade: 'NORMAL',
      linkAcao: linkDaVaga(vaga.id),
    }),

  /** Situação mudada pela equipe na edição (encerrada, pausada, publicada...) */
  situacaoAlteradaPelaEquipe: (vaga: VagaDoAviso, para: StatusDeVagas) =>
    avisar(vaga, {
      tipo: 'VAGA_SITUACAO_ALTERADA',
      titulo: `Vaga ${NOME_DA_SITUACAO[para].toLowerCase()}`,
      mensagem: `O setor de vagas alterou a situação da sua vaga "${vaga.titulo}" para ${NOME_DA_SITUACAO[para]}.`,
      prioridade: 'NORMAL',
      linkAcao: linkDaVaga(vaga.id),
      dados: { status: para },
    }),

  /** Cadastrada como rascunho porque o plano estava cheio */
  limiteNoCadastro: (vaga: VagaDoAviso, ocupacao: Ocupacao) =>
    avisar(vaga, {
      tipo: 'VAGA_LIMITE_PLANO',
      titulo: 'Limite de vagas do plano atingido',
      mensagem: `A vaga "${vaga.titulo}" foi salva como rascunho: seu plano permite ${ocupacao.limite} vaga(s) ativa(s) e todas estão em uso. Encerre ou despublique uma vaga, ou faça upgrade do plano para enviá-la.`,
      prioridade: 'ALTA',
      linkAcao: LINK_PLANOS,
      dados: { limite: ocupacao.limite, emUso: ocupacao.emUso },
    }),

  /** Envio para aprovação (ou aprovação) recusado pelo limite do plano */
  limiteNoEnvio: (vaga: VagaDoAviso, ocupacao: Ocupacao) =>
    avisar(
      vaga,
      {
        tipo: 'VAGA_LIMITE_PLANO',
        titulo: 'Vaga não publicada: limite do plano',
        mensagem: `A vaga "${vaga.titulo}" não pôde ir ao ar porque seu plano permite ${ocupacao.limite} vaga(s) ativa(s) e todas estão em uso. Encerre ou despublique uma vaga, ou faça upgrade do plano.`,
        prioridade: 'ALTA',
        linkAcao: LINK_PLANOS,
        dados: { limite: ocupacao.limite, emUso: ocupacao.emUso },
      },
      { semRepetir: true },
    ),

  /** Esta vaga ocupou a última vaga livre do plano */
  planoCompleto: (vaga: VagaDoAviso, limite: number) =>
    avisar(
      vaga,
      {
        tipo: 'VAGA_LIMITE_PLANO',
        titulo: 'Você usou todas as vagas do plano',
        mensagem: `Com a vaga "${vaga.titulo}", você está usando as ${limite} vaga(s) do seu plano. Novas vagas ficarão como rascunho até você liberar espaço ou fazer upgrade.`,
        prioridade: 'NORMAL',
        linkAcao: LINK_PLANOS,
        dados: { limite, emUso: limite },
      },
      { semRepetir: true },
    ),
};

// ---------------------------------------------------------------------------
// Aviso para a equipe: vagas aguardando aprovação
// ---------------------------------------------------------------------------

const LINK_FILA = '/dashboard/empresas/solicitacoes';
/** Quem aprova vagas: setor de vagas, moderador e admin */
const PAPEIS_QUE_APROVAM = [Roles.SETOR_DE_VAGAS, Roles.MODERADOR, Roles.ADMIN];

export interface VagaNaFila extends VagaDoAviso {
  empresaNome?: string | null;
}

const tituloDaFila = (pendentes: number) =>
  pendentes === 1 ? '1 vaga aguardando aprovação' : `${pendentes} vagas aguardando aprovação`;

/**
 * Um aviso só por pessoa da equipe, agrupado: "N vagas aguardando aprovação". Vaga nova
 * na fila atualiza (e sobe) o aviso não lido em vez de criar outro. Quando a fila esvazia,
 * o aviso não lido é marcado como lido para não ficar dizendo que há vagas pendentes.
 */
export async function atualizarAvisoDaFila(opcoes: {
  /** Vaga que acabou de entrar na fila (sem ela, só atualiza a contagem) */
  novaVaga?: VagaNaFila;
  motivo?: 'CADASTRADA' | 'ENVIADA' | 'EDITADA';
  /** Quem fez a ação não precisa ser avisado dela */
  atorId?: string | null;
}) {
  try {
    const pendentes = await prisma.empresasVagas.count({
      where: { status: StatusDeVagas.EM_ANALISE },
    });
    const avisosAbertos = await prisma.notificacoes.findMany({
      where: { tipo: 'VAGA_AGUARDANDO_APROVACAO', status: NotificacaoStatus.NAO_LIDA },
      select: { id: true, usuarioId: true },
    });

    if (pendentes === 0) {
      if (avisosAbertos.length > 0) {
        await prisma.notificacoes.updateMany({
          where: { id: { in: avisosAbertos.map((a) => a.id) } },
          data: { status: NotificacaoStatus.LIDA, lidaEm: new Date() },
        });
      }
      return;
    }

    const nova = opcoes.novaVaga;
    const empresa = nova?.empresaNome ? ` (${nova.empresaNome})` : '';
    const mensagem = nova
      ? opcoes.motivo === 'EDITADA'
        ? `A vaga "${nova.titulo}"${empresa} foi editada e voltou para aprovação.`
        : `Nova na fila: "${nova.titulo}"${empresa}.`
      : 'Revise as vagas que estão esperando aprovação do setor de vagas.';
    const conteudo = {
      titulo: tituloDaFila(pendentes),
      mensagem,
      dados: { pendentes, ...(nova ? { ultimaVagaId: nova.id } : {}) },
    };

    // Sem vaga nova (aprovação/rejeição): só corrige a contagem dos avisos abertos
    if (!nova) {
      for (const aviso of avisosAbertos) {
        await prisma.notificacoes.update({ where: { id: aviso.id }, data: conteudo });
      }
      return;
    }

    const equipe = await prisma.usuarios.findMany({
      where: { role: { in: PAPEIS_QUE_APROVAM }, status: Status.ATIVO },
      select: { id: true },
    });
    const abertoPorUsuario = new Map(avisosAbertos.map((a) => [a.usuarioId, a.id]));
    for (const pessoa of equipe) {
      if (pessoa.id === opcoes.atorId) continue;
      const aberto = abertoPorUsuario.get(pessoa.id);
      // Falha no aviso de uma pessoa não pode deixar as outras sem aviso
      try {
        if (aberto) {
          // criadoEm atualizado: o aviso volta para o topo da lista
          await prisma.notificacoes.update({
            where: { id: aberto },
            data: { ...conteudo, criadoEm: new Date() },
          });
        } else {
          await notificacoesService.criar({
            usuarioId: pessoa.id,
            tipo: 'VAGA_AGUARDANDO_APROVACAO',
            ...conteudo,
            prioridade: 'NORMAL',
            linkAcao: LINK_FILA,
          });
        }
      } catch (error) {
        avisosLogger.error(
          { err: error, usuarioId: pessoa.id, vagaId: nova.id },
          'Não foi possível avisar esta pessoa da equipe sobre a fila',
        );
      }
    }
  } catch (error) {
    avisosLogger.error(
      { err: error, vagaId: opcoes.novaVaga?.id },
      'Não foi possível atualizar o aviso da fila de aprovação',
    );
  }
}
