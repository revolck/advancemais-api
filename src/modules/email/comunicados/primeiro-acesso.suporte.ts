import { prisma } from '@/config/prisma';
import { AdminService } from '@/modules/usuarios/services/admin-service';
import { recordUserAuditEvent } from '@/modules/usuarios/utils/user-history';
import {
  carregarValidacoes,
  liberadoParaEnvio,
  normalizarEmail,
  validarEmails,
} from '../validacao';
import { enviarParaAluno } from './primeiro-acesso.cron';
import {
  COMUNICADO_PRIMEIRO_ACESSO,
  filtroPopulacao,
  reabrirEmailsCorrigidos,
} from './primeiro-acesso.service';

export interface ContextoSuporte {
  actorId?: string | null;
  actorRole?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

const erro = (statusCode: number, code: string, message: string) =>
  Object.assign(new Error(message), { statusCode, code });

export async function garantirAlunoDaCampanha(usuarioId: string) {
  const aluno = await prisma.usuarios.findFirst({
    where: { id: usuarioId, ...filtroPopulacao() },
    select: { id: true },
  });
  if (!aluno) throw erro(404, 'ALUNO_FORA_DA_CAMPANHA', 'Aluno não encontrado nesta campanha');
}

/**
 * Corrige o e-mail pelo mesmo serviço do cadastro de usuários (formato, duplicidade e
 * auditoria), devolve o aluno para a fila e valida o novo endereço. Se pedido e o
 * endereço estiver confirmado, envia o comunicado na hora (nova senha provisória
 * por e-mail; a senha nunca aparece para o suporte).
 */
export async function corrigirEmailDoAluno(
  usuarioId: string,
  novoEmail: string,
  opcoes: { enviarAgora: boolean; contexto: ContextoSuporte },
) {
  await garantirAlunoDaCampanha(usuarioId);
  const email = normalizarEmail(novoEmail);

  await new AdminService().atualizarUsuario(
    usuarioId,
    { email },
    {
      userRole: opcoes.contexto.actorRole ?? undefined,
      actorId: opcoes.contexto.actorId ?? undefined,
      actorRole: opcoes.contexto.actorRole ?? undefined,
      ip: opcoes.contexto.ip ?? null,
      userAgent: opcoes.contexto.userAgent ?? null,
    },
  );
  const reaberto = (await reabrirEmailsCorrigidos([usuarioId])) > 0;

  const resumoValidacao = await validarEmails([email]);
  const registro = (await carregarValidacoes([email])).get(email);
  const liberado = liberadoParaEnvio(registro);

  const envio = opcoes.enviarAgora && liberado ? await enviarParaAluno(usuarioId) : null;

  return {
    email,
    reaberto,
    validacao: registro
      ? {
          resultado: registro.resultado,
          motivo: registro.motivo,
          sugestao: registro.sugestao,
          fonte: registro.fonte,
        }
      : null,
    validadorIndisponivel: resumoValidacao.interrompidoPor,
    liberadoParaEnvio: liberado,
    envio,
  };
}

/** Status em que o mesmo endereço não pode ser tentado de novo: é preciso corrigir o e-mail */
const EXIGEM_CORRECAO = ['DEVOLVIDO', 'DESCARTADO'];

/**
 * Reenvio pedido pelo suporte (ex.: aluno diz que não recebeu). Gera nova senha
 * provisória, só se o endereço estiver validado, e respeita as mesmas proteções do envio em massa.
 */
export async function reenviarParaAluno(usuarioId: string, contexto: ContextoSuporte) {
  await garantirAlunoDaCampanha(usuarioId);
  const usuario = await prisma.usuarios.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { email: true, precisaTrocarSenha: true },
  });
  const email = normalizarEmail(usuario.email);
  const envioAtual = await prisma.comunicadosEnvios.findUnique({
    where: { comunicado_usuarioId: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId } },
    select: { status: true, email: true },
  });

  if (envioAtual) {
    const mesmoEmail = normalizarEmail(envioAtual.email) === email;
    if (mesmoEmail && EXIGEM_CORRECAO.includes(envioAtual.status)) {
      throw erro(
        409,
        'EMAIL_PRECISA_CORRECAO',
        'Esse endereço voltou; corrija o e-mail antes de reenviar.',
      );
    }
    if (envioAtual.status === 'PROCESSANDO') {
      throw erro(409, 'ENVIO_EM_ANDAMENTO', 'Já existe um envio em andamento para este aluno.');
    }
    if (envioAtual.status === 'ENVIADO' && !usuario.precisaTrocarSenha) {
      throw erro(409, 'PRIMEIRO_ACESSO_CONCLUIDO', 'O aluno já trocou a senha provisória.');
    }
    if (envioAtual.status !== 'REABERTO') {
      await prisma.comunicadosEnvios.update({
        where: { comunicado_usuarioId: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId } },
        data: {
          status: 'REABERTO',
          tentativas: 0,
          erro: `Reenvio solicitado pelo suporte; envio anterior: ${envioAtual.status}`,
        },
      });
      await recordUserAuditEvent({
        client: prisma,
        actorId: contexto.actorId ?? null,
        actorRole: contexto.actorRole ?? null,
        targetUserId: usuarioId,
        action: 'COMUNICADO_REENVIO_SOLICITADO',
        descricao:
          'Suporte pediu o reenvio do comunicado de primeiro acesso (nova senha provisória).',
        meta: { origem: 'COMUNICADO_PRIMEIRO_ACESSO', statusAnterior: envioAtual.status },
        ip: contexto.ip ?? null,
        userAgent: contexto.userAgent ?? null,
      });
    }
  }

  const resumoValidacao = await validarEmails([email]);
  const registro = (await carregarValidacoes([email])).get(email);
  const liberado = liberadoParaEnvio(registro);
  return {
    email,
    validacao: registro
      ? {
          resultado: registro.resultado,
          motivo: registro.motivo,
          sugestao: registro.sugestao,
          fonte: registro.fonte,
        }
      : null,
    validadorIndisponivel: resumoValidacao.interrompidoPor,
    liberadoParaEnvio: liberado,
    envio: liberado ? await enviarParaAluno(usuarioId) : null,
  };
}
