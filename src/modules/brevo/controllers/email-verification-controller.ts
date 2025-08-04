import { Request, Response } from "express";
import { EmailVerificationService } from "../../brevo/services/email-verification-service";

/**
 * Controller para verificação de email
 * Implementa endpoints para confirmar email e reenviar verificação
 *
 * Responsabilidades:
 * - Verificar tokens de verificação
 * - Reenviar emails de verificação
 * - Validar estado da conta
 * - Logs de auditoria
 *
 * @author Sistema AdvanceMais
 * @version 6.0.0 - Sistema completo de verificação
 */
export class EmailVerificationController {
  private emailVerificationService: EmailVerificationService;

  constructor() {
    this.emailVerificationService = new EmailVerificationService();
  }

  /**
   * Verifica token de verificação de email
   * GET /verificar-email?token=xxx
   */
  public verifyEmail = async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(400).json({
          success: false,
          message: "Token de verificação é obrigatório",
        });
      }

      console.log(`🔍 Verificando token: ${token.substring(0, 8)}...`);

      const result = await this.emailVerificationService.verifyEmailToken(
        token
      );

      if (result.valid) {
        console.log(
          `✅ Email verificado com sucesso para usuário ${result.userId}`
        );

        return res.json({
          success: true,
          message:
            "Email verificado com sucesso! Agora você pode fazer login na plataforma.",
          userId: result.userId,
        });
      } else if (result.alreadyVerified) {
        return res.status(400).json({
          success: false,
          message: "Este email já foi verificado anteriormente.",
          code: "ALREADY_VERIFIED",
          userId: result.userId,
        });
      } else if (result.expired) {
        return res.status(400).json({
          success: false,
          message:
            "Token de verificação expirado. Solicite um novo email de verificação.",
          code: "TOKEN_EXPIRED",
          userId: result.userId,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: result.error || "Token de verificação inválido",
          code: "INVALID_TOKEN",
        });
      }
    } catch (error) {
      console.error("Erro na verificação de email:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Reenvia email de verificação
   * POST /reenviar-verificacao
   */
  public resendVerification = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          success: false,
          message: "Email é obrigatório",
        });
      }

      console.log(`🔄 Reenviando verificação para: ${email}`);

      const result =
        await this.emailVerificationService.resendVerificationEmail(email);

      if (result.success) {
        const responseMessage = result.simulated
          ? "Email de verificação reenviado (simulado)."
          : "Email de verificação reenviado com sucesso. Verifique sua caixa de entrada.";

        return res.json({
          success: true,
          message: responseMessage,
          simulated: result.simulated,
          messageId: result.messageId,
        });
      } else {
        const statusCode = result.error?.includes("não encontrado")
          ? 404
          : result.error?.includes("já verificado")
          ? 400
          : result.error?.includes("inativa")
          ? 403
          : result.error?.includes("limite")
          ? 429
          : 400;

        return res.status(statusCode).json({
          success: false,
          message: result.error || "Erro ao reenviar email de verificação",
        });
      }
    } catch (error) {
      console.error("Erro ao reenviar verificação:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Verifica status de verificação de um email
   * GET /status-verificacao/:email
   */
  public checkVerificationStatus = async (req: Request, res: Response) => {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email é obrigatório",
        });
      }

      const { prisma } = await import("../../../config/prisma.js");

      const usuario = await prisma.usuario.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: {
          id: true,
          email: true,
          emailVerificado: true,
          emailVerificadoEm: true,
          status: true,
          criadoEm: true,
        },
      });

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
        });
      }

      return res.json({
        success: true,
        data: {
          email: usuario.email,
          verified: usuario.emailVerificado,
          verifiedAt: usuario.emailVerificadoEm,
          accountStatus: usuario.status,
          createdAt: usuario.criadoEm,
          canLogin: usuario.emailVerificado && usuario.status === "ATIVO",
        },
      });
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
}
