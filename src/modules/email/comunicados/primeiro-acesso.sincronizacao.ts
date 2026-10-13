import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { recordUserAuditEvent } from '@/modules/usuarios/utils/user-history';
import { BrevoClient, type BrevoEmailEvent } from '../client/brevo-client';
import { registrarSinaisBrevo, type SinalBrevo } from '../validacao';
import { COMUNICADO_PRIMEIRO_ACESSO } from './primeiro-acesso.service';

const log = logger.child({ module: 'ComunicadoSincronizacaoBrevo' });

/** Eventos que significam "não chegou e não deve ser tentado de novo neste endereço" */
const EVENTOS_DEFINITIVOS: Record<string, Omit<SinalBrevo, 'email'>> = {
  hardBounces: { resultado: 'INVALIDO', motivo: 'BREVO_HARD_BOUNCE' },
  invalid: { resultado: 'INVALIDO', motivo: 'BREVO_ENDERECO_INVALIDO' },
  blocked: { resultado: 'BLOQUEADO', motivo: 'BREVO_BLOQUEADO' },
  spam: { resultado: 'BLOQUEADO', motivo: 'BREVO_DENUNCIA_SPAM' },
};

/** Motivos da lista de bloqueio transacional da Brevo */
const MOTIVOS_BLOQUEIO: Record<string, Omit<SinalBrevo, 'email'>> = {
  hardBounce: { resultado: 'INVALIDO', motivo: 'BREVO_HARD_BOUNCE' },
  contactFlaggedAsSpam: { resultado: 'BLOQUEADO', motivo: 'BREVO_DENUNCIA_SPAM' },
  adminBlocked: { resultado: 'BLOQUEADO', motivo: 'BREVO_BLOQUEADO_MANUALMENTE' },
  unsubscribedViaEmail: { resultado: 'BLOQUEADO', motivo: 'BREVO_DESCADASTRADO' },
  unsubscribedViaApi: { resultado: 'BLOQUEADO', motivo: 'BREVO_DESCADASTRADO' },
  unsubscribedViaMA: { resultado: 'BLOQUEADO', motivo: 'BREVO_DESCADASTRADO' },
};

const DIAS_EVENTOS_DEFINITIVOS = 30;
const DIAS_EVENTOS_ENTREGA = 7;
const PAGINA_EVENTOS = 2500;
const PAGINA_BLOQUEIOS = 100;
const MAX_PAGINAS = 40;

export const normalizarMessageId = (messageId?: string | null) =>
  (messageId ?? '').trim().replace(/^<|>$/g, '').toLowerCase();

const dataDoEvento = (evento: BrevoEmailEvent, fallback: Date) => {
  const data = new Date(evento.date);
  return Number.isNaN(data.getTime()) ? fallback : data;
};

export interface ResultadoSincronizacao {
  em: string;
  contatosBloqueados: number;
  enderecosAtualizados: number;
  devolvidos: number;
  devolucoesTemporarias: number;
  entregues: number;
}

async function listarTodosEventos(event: string, days: number) {
  const brevo = BrevoClient.getInstance();
  const todos: BrevoEmailEvent[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const lote = await brevo.listarEventos({
      event,
      days,
      limit: PAGINA_EVENTOS,
      offset: pagina * PAGINA_EVENTOS,
    });
    todos.push(...lote);
    if (lote.length < PAGINA_EVENTOS) break;
  }
  return todos;
}

async function listarTodosBloqueados() {
  const brevo = BrevoClient.getInstance();
  const sinais: SinalBrevo[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const offset = pagina * PAGINA_BLOQUEIOS;
    const { count, contacts } = await brevo.listarContatosBloqueados({
      limit: PAGINA_BLOQUEIOS,
      offset,
    });
    for (const contato of contacts) {
      const codigo = contato.reason?.code ?? '';
      const sinal = MOTIVOS_BLOQUEIO[codigo] ?? {
        resultado: 'BLOQUEADO' as const,
        motivo: `BREVO_${(codigo || 'BLOQUEIO').toUpperCase()}`,
      };
      sinais.push({ email: contato.email, ...sinal });
    }
    if (contacts.length < PAGINA_BLOQUEIOS || offset + PAGINA_BLOQUEIOS >= count) break;
  }
  return sinais;
}

/**
 * Traz da Brevo tudo o que aconteceu depois do envio: lista de bloqueio, devoluções
 * definitivas e temporárias, denúncias e entregas. Lança erro se a Brevo não responder
 * (quem chama não pode seguir enviando sem essa informação).
 */
export async function sincronizarComBrevo(agora = new Date()): Promise<ResultadoSincronizacao> {
  const sinais = await listarTodosBloqueados();
  const contatosBloqueados = sinais.length;

  const definitivos = new Map<string, BrevoEmailEvent>();
  for (const [event, sinal] of Object.entries(EVENTOS_DEFINITIVOS)) {
    for (const item of await listarTodosEventos(event, DIAS_EVENTOS_DEFINITIVOS)) {
      definitivos.set(normalizarMessageId(item.messageId), item);
      if (item.email) sinais.push({ email: item.email, ...sinal });
    }
  }
  const temporarios = new Map(
    (await listarTodosEventos('softBounces', DIAS_EVENTOS_ENTREGA)).map((item) => [
      normalizarMessageId(item.messageId),
      item,
    ]),
  );
  const entregues = new Map(
    (await listarTodosEventos('delivered', DIAS_EVENTOS_ENTREGA)).map((item) => [
      normalizarMessageId(item.messageId),
      item,
    ]),
  );

  const enderecosAtualizados = await registrarSinaisBrevo(sinais, agora);

  const envios = await prisma.comunicadosEnvios.findMany({
    where: {
      comunicado: COMUNICADO_PRIMEIRO_ACESSO,
      messageId: { not: null },
      OR: [
        { status: { in: ['ENVIADO', 'DEVOLUCAO_TEMPORARIA'] } },
        // devoluções registradas antes de existir `devolvidoEm`
        { status: 'DEVOLVIDO', devolvidoEm: null },
      ],
    },
    select: { id: true, usuarioId: true, messageId: true, status: true, entregueEm: true },
  });

  const resultado: ResultadoSincronizacao = {
    em: agora.toISOString(),
    contatosBloqueados,
    enderecosAtualizados,
    devolvidos: 0,
    devolucoesTemporarias: 0,
    entregues: 0,
  };

  for (const envio of envios) {
    const id = normalizarMessageId(envio.messageId);
    const definitivo = definitivos.get(id);
    if (definitivo) {
      await prisma.comunicadosEnvios.update({
        where: { id: envio.id },
        data: {
          status: 'DEVOLVIDO',
          devolvidoEm: dataDoEvento(definitivo, agora),
          erro: `${definitivo.event}${definitivo.reason ? `: ${definitivo.reason}` : ''}`.slice(
            0,
            500,
          ),
        },
      });
      if (envio.status !== 'DEVOLVIDO') {
        await recordUserAuditEvent({
          client: prisma,
          targetUserId: envio.usuarioId,
          action: 'COMUNICADO_EMAIL_DEVOLVIDO',
          descricao:
            'O comunicado de primeiro acesso voltou (e-mail inexistente ou bloqueado): a senha provisória não chegou ao aluno. Corrija o e-mail para reenviar.',
          meta: { origem: 'COMUNICADO_PRIMEIRO_ACESSO', evento: definitivo.event },
        });
      }
      resultado.devolvidos += 1;
      continue;
    }
    if (envio.status === 'DEVOLVIDO') continue;

    const entrega = entregues.get(id);
    if (entrega) {
      if (!envio.entregueEm || envio.status !== 'ENVIADO') {
        await prisma.comunicadosEnvios.update({
          where: { id: envio.id },
          data: { status: 'ENVIADO', entregueEm: dataDoEvento(entrega, agora), erro: null },
        });
        resultado.entregues += 1;
      }
      continue;
    }

    const temporario = temporarios.get(id);
    if (temporario && envio.status === 'ENVIADO') {
      await prisma.comunicadosEnvios.update({
        where: { id: envio.id },
        data: {
          status: 'DEVOLUCAO_TEMPORARIA',
          erro: `softBounces${temporario.reason ? `: ${temporario.reason}` : ''}`.slice(0, 500),
        },
      });
      resultado.devolucoesTemporarias += 1;
    }
  }

  if (resultado.devolvidos || resultado.devolucoesTemporarias || resultado.enderecosAtualizados) {
    log.warn(resultado, '↩️ Sincronização com a Brevo registrou devoluções/bloqueios');
  }
  return resultado;
}
