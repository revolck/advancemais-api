import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { invalidateUserCache } from '../utils/cache';
import { recordUserAuditEvent } from '../utils/user-history';
import { validarSenha } from '../utils/validation';

const log = logger.child({ controller: 'AlterarSenhaController' });

/**
 * PUT /api/v1/usuarios/perfil/alterar-senha
 * Troca a senha do usuário autenticado. Também conclui o primeiro acesso de
 * quem está com senha provisória (precisaTrocarSenha).
 *
 * Senha atual incorreta responde 400 (e não 401): o front encerra a sessão em 401.
 */
export const alterarSenha = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado',
      code: 'UNAUTHORIZED',
    });
  }

  const { senhaAntiga, senhaNova, confirmarSenha } = (req.body ?? {}) as Record<string, unknown>;

  if (
    typeof senhaAntiga !== 'string' ||
    typeof senhaNova !== 'string' ||
    typeof confirmarSenha !== 'string' ||
    !senhaAntiga ||
    !senhaNova ||
    !confirmarSenha
  ) {
    return res.status(400).json({
      success: false,
      message: 'Informe a senha atual, a nova senha e a confirmação',
      code: 'MISSING_FIELDS',
    });
  }

  const validacao = validarSenha(senhaNova);
  if (!validacao.valida) {
    return res.status(400).json({
      success: false,
      message: 'A nova senha não atende aos critérios de segurança',
      code: 'WEAK_PASSWORD',
      detalhes: validacao.mensagens,
    });
  }

  if (senhaNova !== confirmarSenha) {
    return res.status(400).json({
      success: false,
      message: 'A confirmação não confere com a nova senha',
      code: 'PASSWORD_MISMATCH',
    });
  }

  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { id: true, senha: true, precisaTrocarSenha: true },
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!(await bcrypt.compare(senhaAntiga, usuario.senha))) {
      return res.status(400).json({
        success: false,
        message: usuario.precisaTrocarSenha
          ? 'Senha provisória incorreta'
          : 'Senha atual incorreta',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    if (await bcrypt.compare(senhaNova, usuario.senha)) {
      return res.status(400).json({
        success: false,
        message: 'A nova senha deve ser diferente da senha atual',
        code: 'SAME_PASSWORD',
      });
    }

    const novaSenhaHash = await bcrypt.hash(senhaNova, 12);
    const primeiroAcesso = usuario.precisaTrocarSenha;

    await prisma.$transaction(async (tx) => {
      await tx.usuarios.update({
        where: { id: userId },
        data: {
          senha: novaSenhaHash,
          precisaTrocarSenha: false,
          senhaProvisoriaEm: null,
          atualizadoEm: new Date(),
        },
      });

      await recordUserAuditEvent({
        client: tx,
        actorId: userId,
        targetUserId: userId,
        action: 'USUARIO_SENHA_ALTERADA',
        descricao: primeiroAcesso
          ? 'Senha provisória trocada no primeiro acesso.'
          : 'Senha alterada pelo próprio usuário.',
        meta: { origem: primeiroAcesso ? 'PRIMEIRO_ACESSO' : 'PERFIL' },
        ip: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });
    });

    await invalidateUserCache(userId);

    log.info({ userId, primeiroAcesso }, '🔐 Senha alterada pelo usuário');

    return res.json({
      success: true,
      message: 'Senha alterada com sucesso',
      precisaTrocarSenha: false,
    });
  } catch (error) {
    log.error({ err: error, userId }, '❌ Erro ao alterar senha');
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao alterar a senha',
      code: 'INTERNAL_ERROR',
    });
  }
};
