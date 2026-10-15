import { NotificacaoStatus, StatusDeVagas } from '@prisma/client';
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
