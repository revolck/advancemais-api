import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../../config/prisma';
import { EmailService } from '../../brevo/services/email-service';
import { brevoConfig } from '../../../config/env';
import { logger } from '../../../utils/logger';
import {
  validarCPF,
  validarCNPJ,
  validarEmail,
  validarSenha,
  limparDocumento,
} from '../utils/validation';
import { invalidateUserCache } from '../utils/cache';

/**
 * Interface para solicitação de recuperação de senha
 */
interface SolicitarRecuperacaoData {
  identificador?: string; // CPF, CNPJ ou email
  email?: string;
  cpf?: string;
  cnpj?: string;
}

/**
 * Interface para redefinição de senha
 */
interface RedefinirSenhaData {
  token: string;
  novaSenha: string;
  confirmarSenha: string;
}

/**
 * Controller para recuperação de senha
 * Gerencia todo o fluxo de recuperação via email
 */
export class PasswordRecoveryController {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  private getLogger(req: Request) {
    return logger.child({
      controller: 'PasswordRecoveryController',
      correlationId: req.id,
    });
  }

  /**
   * Solicita recuperação de senha via CPF, CNPJ ou email
   * @param req - Request com identificador
   * @param res - Response com resultado
   */
  public solicitarRecuperacao = async (req: Request, res: Response) => {
    const log = this.getLogger(req);
    try {
      const { identificador, email, cpf, cnpj }: SolicitarRecuperacaoData = req.body;

      const entradas = [
        { tipo: 'identificador', valor: identificador },
        { tipo: 'email', valor: email },
        { tipo: 'cpf', valor: cpf },
        { tipo: 'cnpj', valor: cnpj },
      ].filter((entrada) => typeof entrada.valor === 'string' && entrada.valor.trim() !== '');

      if (entradas.length === 0) {
        return res.status(400).json({
          message: 'Informe um email, CPF ou CNPJ para recuperar a senha',
        });
      }

      const entradaSelecionada = entradas[0];
      const valorEntrada = (entradaSelecionada.valor as string).trim();
      let buscarPor: Record<string, string> | null = null;

      if (entradaSelecionada.tipo === 'email') {
        if (!validarEmail(valorEntrada)) {
          return res.status(400).json({
            message: 'Email inválido. Informe um email válido para continuar',
          });
        }

        buscarPor = { email: valorEntrada.toLowerCase() };
      } else if (entradaSelecionada.tipo === 'cpf') {
        const documentoLimpo = limparDocumento(valorEntrada);

        if (!validarCPF(documentoLimpo)) {
          return res.status(400).json({
            message: 'CPF deve conter 11 dígitos numéricos',
          });
        }

        buscarPor = { cpf: documentoLimpo };
      } else if (entradaSelecionada.tipo === 'cnpj') {
        const documentoLimpo = limparDocumento(valorEntrada);

        if (!validarCNPJ(documentoLimpo)) {
          return res.status(400).json({
            message: 'CNPJ deve conter 14 dígitos numéricos',
          });
        }

        buscarPor = { cnpj: documentoLimpo };
      } else {
        if (validarEmail(valorEntrada)) {
          buscarPor = { email: valorEntrada.toLowerCase() };
        } else {
          const documentoLimpo = limparDocumento(valorEntrada);

          if (validarCPF(documentoLimpo)) {
            buscarPor = { cpf: documentoLimpo };
          } else if (validarCNPJ(documentoLimpo)) {
            buscarPor = { cnpj: documentoLimpo };
          } else {
            return res.status(400).json({
              message:
                'Identificador deve ser um email válido, CPF (11 dígitos) ou CNPJ (14 dígitos)',
            });
          }
        }
      }

      // Busca usuário no banco
      if (!buscarPor) {
        return res.status(400).json({
          message: 'Não foi possível identificar um email, CPF ou CNPJ válido',
        });
      }

      const usuario = await prisma.usuarios.findFirst({
        where: {
          ...buscarPor,
          status: 'ATIVO', // Só permite recuperação para usuários ativos
        },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          UsuariosRecuperacaoSenha: {
            select: {
              tokenRecuperacao: true,
              tokenRecuperacaoExp: true,
              tentativasRecuperacao: true,
              ultimaTentativaRecuperacao: true,
            },
          },
        },
      });

      if (!usuario) {
        return res.status(404).json({
          message: 'Usuário não encontrado com este identificador',
        });
      }

      // Verifica limite de tentativas
      const agora = new Date();
      const cooldownMinutes = brevoConfig.passwordRecovery.cooldownMinutes;
      const maxAttempts = brevoConfig.passwordRecovery.maxAttempts;

      const recuperacao = usuario.UsuariosRecuperacaoSenha;

      if (recuperacao?.ultimaTentativaRecuperacao) {
        const tempoCooldown = new Date(
          recuperacao.ultimaTentativaRecuperacao.getTime() + cooldownMinutes * 60000,
        );

        if (agora < tempoCooldown && (recuperacao.tentativasRecuperacao ?? 0) >= maxAttempts) {
          const minutosRestantes = Math.ceil((tempoCooldown.getTime() - agora.getTime()) / 60000);
          return res.status(429).json({
            message: `Muitas tentativas de recuperação. Tente novamente em ${minutosRestantes} minutos`,
          });
        }

        // Reset do contador se passou do tempo de cooldown
        if (agora >= tempoCooldown) {
          await prisma.usuariosRecuperacaoSenha.upsert({
            where: { usuarioId: usuario.id },
            update: {
              tentativasRecuperacao: 0,
            },
            create: {
              usuarioId: usuario.id,
              tentativasRecuperacao: 0,
            },
          });

          await invalidateUserCache(usuario);
        }
      }

      // Gera token seguro
      const token = crypto.randomBytes(32).toString('hex');
      const tokenExpiracao = new Date(
        agora.getTime() + brevoConfig.passwordRecovery.tokenExpirationMinutes * 60000,
      );

      // Atualiza/Cria registro de recuperação com token e incrementa tentativas
      await prisma.usuariosRecuperacaoSenha.upsert({
        where: { usuarioId: usuario.id },
        update: {
          tokenRecuperacao: token,
          tokenRecuperacaoExp: tokenExpiracao,
          tentativasRecuperacao: { increment: 1 },
          ultimaTentativaRecuperacao: agora,
        },
        create: {
          usuarioId: usuario.id,
          tokenRecuperacao: token,
          tokenRecuperacaoExp: tokenExpiracao,
          tentativasRecuperacao: 1,
          ultimaTentativaRecuperacao: agora,
        },
      });

      await invalidateUserCache(usuario);

      // Envia email de recuperação
      const emailResult = await this.emailService.enviarEmailRecuperacaoSenha(usuario, token);

      if (!emailResult.success) {
        log.error({ error: emailResult.error }, 'Erro ao enviar email de recuperação');
        return res.status(500).json({
          message: 'Erro interno ao enviar email de recuperação',
        });
      }

      res.json({
        message:
          'Se o identificador estiver correto, você receberá um email com instruções para recuperação',
      });
    } catch (error) {
      log.error({ err: error }, 'Erro na solicitação de recuperação');
      res.status(500).json({
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  /**
   * Valida token de recuperação
   * @param req - Request com token
   * @param res - Response com validação
   */
  public validarToken = async (req: Request, res: Response) => {
    const log = this.getLogger(req);
    try {
      const { token } = req.params;

      if (!token || token.trim() === '') {
        return res.status(400).json({
          message: 'Token é obrigatório',
        });
      }

      // Busca registro de recuperação pelo token
      const recuperacao = await prisma.usuariosRecuperacaoSenha.findFirst({
        where: {
          tokenRecuperacao: token,
          Usuarios: {
            status: 'ATIVO',
          },
        },
        select: {
          tokenRecuperacaoExp: true,
          Usuarios: {
            select: {
              id: true,
              email: true,
              nomeCompleto: true,
            },
          },
        },
      });

      if (!recuperacao || !recuperacao.Usuarios) {
        return res.status(400).json({
          message: 'Token inválido ou expirado',
        });
      }

      // Verifica se token não expirou
      if (!recuperacao.tokenRecuperacaoExp || new Date() > recuperacao.tokenRecuperacaoExp) {
        // Remove token expirado
        await prisma.usuariosRecuperacaoSenha.update({
          where: { usuarioId: recuperacao.Usuarios.id },
          data: {
            tokenRecuperacao: null,
            tokenRecuperacaoExp: null,
          },
        });

        await invalidateUserCache(recuperacao.Usuarios);

        return res.status(400).json({
          message: 'Token expirado. Solicite uma nova recuperação',
        });
      }

      res.json({
        message: 'Token válido',
          Usuarios: {
          email: recuperacao.Usuarios.email,
          nomeCompleto: recuperacao.Usuarios.nomeCompleto,
        },
      });
    } catch (error) {
      log.error({ err: error }, 'Erro na validação do token');
      res.status(500).json({
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  /**
   * Redefine senha usando token válido
   * @param req - Request com token e nova senha
   * @param res - Response com resultado
   */
  public redefinirSenha = async (req: Request, res: Response) => {
    const log = this.getLogger(req);
    try {
      const { token, novaSenha, confirmarSenha }: RedefinirSenhaData = req.body;

      // Validações básicas
      if (!token || !novaSenha || !confirmarSenha) {
        return res.status(400).json({
          message: 'Token, nova senha e confirmação são obrigatórios',
        });
      }

      // Valida nova senha
      const validacaoSenha = validarSenha(novaSenha);
      if (!validacaoSenha.valida) {
        return res.status(400).json({
          message: 'Nova senha não atende aos critérios de segurança',
          detalhes: validacaoSenha.mensagens,
        });
      }

      // Verifica confirmação de senha
      if (novaSenha !== confirmarSenha) {
        return res.status(400).json({
          message: 'Confirmação de senha não confere',
        });
      }

      // Busca registro de recuperação pelo token
      const recuperacao = await prisma.usuariosRecuperacaoSenha.findFirst({
        where: {
          tokenRecuperacao: token,
          Usuarios: {
            status: 'ATIVO',
          },
        },
        select: {
          tokenRecuperacaoExp: true,
          Usuarios: {
            select: {
              id: true,
              email: true,
              nomeCompleto: true,
              senha: true,
            },
          },
        },
      });

      if (!recuperacao || !recuperacao.Usuarios) {
        return res.status(400).json({
          message: 'Token inválido ou expirado',
        });
      }

      // Verifica se token não expirou
      if (!recuperacao.tokenRecuperacaoExp || new Date() > recuperacao.tokenRecuperacaoExp) {
        await prisma.usuariosRecuperacaoSenha.update({
          where: { usuarioId: recuperacao.Usuarios.id },
          data: {
            tokenRecuperacao: null,
            tokenRecuperacaoExp: null,
          },
        });

        await invalidateUserCache(recuperacao.Usuarios);

        return res.status(400).json({
          message: 'Token expirado. Solicite uma nova recuperação',
        });
      }

      // Verifica se a nova senha é diferente da atual
      const senhaIgual = await bcrypt.compare(novaSenha, recuperacao.Usuarios.senha);
      if (senhaIgual) {
        return res.status(400).json({
          message: 'A nova senha deve ser diferente da senha atual',
        });
      }

      // Gera hash da nova senha
      const novaSenhaHash = await bcrypt.hash(novaSenha, 12);

      // Atualiza senha e remove token
      await prisma.$transaction([
        prisma.usuarios.update({
          where: { id: recuperacao.Usuarios.id },
          data: {
            senha: novaSenhaHash,
            atualizadoEm: new Date(),
          },
        }),
        prisma.usuariosRecuperacaoSenha.update({
          where: { usuarioId: recuperacao.Usuarios.id },
          data: {
            tokenRecuperacao: null,
            tokenRecuperacaoExp: null,
            tentativasRecuperacao: 0,
            ultimaTentativaRecuperacao: null,
          },
        }),
      ]);

      await invalidateUserCache(recuperacao.Usuarios);

      res.json({
        message: 'Senha redefinida com sucesso',
      });
    } catch (error) {
      log.error({ err: error }, 'Erro na redefinição de senha');
      res.status(500).json({
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };
}
