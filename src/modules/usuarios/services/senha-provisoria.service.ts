import bcrypt from 'bcrypt';
import { prisma } from '@/config/prisma';
import { invalidateUserCache } from '../utils/cache';
import { gerarSenhaProvisoria } from '../utils/senha-provisoria';
import { recordUserAuditEvent } from '../utils/user-history';

export interface SenhaProvisoriaResult {
  usuarioId: string;
  /** Texto puro: usar só para montar o e-mail do próprio usuário, nunca persistir/logar */
  senhaProvisoria: string;
  definidaEm: Date;
}

/**
 * Define uma senha provisória individual e obriga a troca no próximo login.
 * Chamado no momento do envio do comunicado de primeiro acesso.
 */
export async function definirSenhaProvisoria(
  usuarioId: string,
  options: { actorId?: string; origem?: string } = {},
): Promise<SenhaProvisoriaResult> {
  const senhaProvisoria = gerarSenhaProvisoria();
  const senhaHash = await bcrypt.hash(senhaProvisoria, 12);
  const definidaEm = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({
      where: { id: usuarioId },
      data: {
        senha: senhaHash,
        precisaTrocarSenha: true,
        senhaProvisoriaEm: definidaEm,
        atualizadoEm: definidaEm,
      },
    });

    await recordUserAuditEvent({
      client: tx,
      actorId: options.actorId ?? usuarioId,
      targetUserId: usuarioId,
      action: 'USUARIO_SENHA_PROVISORIA_DEFINIDA',
      descricao: 'Senha provisória individual definida; troca obrigatória no próximo login.',
      meta: { origem: options.origem ?? 'COMUNICADO_PRIMEIRO_ACESSO' },
    });
  });

  await invalidateUserCache(usuarioId);

  return { usuarioId, senhaProvisoria, definidaEm };
}
