import { Prisma, type StatusDeVagas } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

const historicoLogger = logger.child({ module: 'HistoricoVaga' });

export type AcaoHistoricoVaga =
  | 'VAGA_CRIADA'
  | 'VAGA_EDITADA'
  | 'VAGA_ENVIADA_PARA_ANALISE'
  | 'VAGA_APROVADA'
  | 'VAGA_REJEITADA'
  | 'VAGA_DESPUBLICADA'
  | 'VAGA_ENVIO_CANCELADO'
  | 'VAGA_EXPIRADA'
  | 'VAGA_EXCLUIDA';

export interface RegistroHistoricoVaga {
  vagaId: string;
  /** Quem fez (empresa, admin, moderador, setor de vagas) */
  usuarioId?: string | null;
  acao: AcaoHistoricoVaga;
  descricao: string;
  de?: StatusDeVagas | null;
  para?: StatusDeVagas | null;
  metadata?: Record<string, unknown>;
}

/**
 * Histórico da vaga em AuditoriaLogs (entidadeTipo VAGA): quem criou, enviou para análise,
 * aprovou, rejeitou, despublicou, editou ou excluiu, e de qual situação para qual.
 * Falha ao registrar não desfaz a ação (já concluída), mas fica no log de erro.
 */
export async function registrarHistoricoVaga(registro: RegistroHistoricoVaga) {
  try {
    await prisma.auditoriaLogs.create({
      data: {
        categoria: 'VAGA',
        tipo: 'VAGA_SITUACAO',
        acao: registro.acao,
        usuarioId: registro.usuarioId ?? null,
        entidadeId: registro.vagaId,
        entidadeTipo: 'VAGA',
        descricao: registro.descricao.slice(0, 500),
        dadosAnteriores: registro.de ? { status: registro.de } : Prisma.JsonNull,
        dadosNovos: registro.para ? { status: registro.para } : Prisma.JsonNull,
        metadata: (registro.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    historicoLogger.error(
      { err: error, vagaId: registro.vagaId, acao: registro.acao },
      'Não foi possível registrar o histórico da vaga',
    );
  }
}
