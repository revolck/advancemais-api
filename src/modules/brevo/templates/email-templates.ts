export interface AccountConfirmationEmailData {
  /** Nome completo do destinatário */
  nomeCompleto: string;
  /** URL completa para validação do token de confirmação */
  verificationUrl: string;
  // Campos adicionais são ignorados mas mantidos por compatibilidade
  token?: string;
  expirationHours?: number;
  email?: string;
  tipoUsuario?: string;
  frontendUrl?: string;
}

export interface PasswordRecoveryData {
  /** Nome completo do destinatário */
  nomeCompleto: string;
  /** Link completo para recuperação de senha */
  linkRecuperacao: string;
  /** Tempo de expiração do link em minutos */
  expiracaoMinutos: number;
  // Token opcional apenas para compatibilidade
  token?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailTemplates {
  /**
   * Email de boas vindas com link de confirmação de conta
   */
  public static generateAccountConfirmationEmail(
    data: AccountConfirmationEmailData
  ): EmailTemplate {
    const firstName = data.nomeCompleto.split(" ")[0];
    const link = data.verificationUrl;

    return {
      subject: `Bem-vindo ao AdvanceMais, ${firstName}!`,
      html: `<!DOCTYPE html>
<html lang="pt-BR">
  <body>
    <p>Olá ${firstName},</p>
    <p>Bem-vindo ao AdvanceMais! Para confirmar seu cadastro clique no link abaixo:</p>
    <p><a href="${link}">Confirmar cadastro</a></p>
    <p>Se o botão não funcionar, copie e cole o link no navegador:</p>
    <p>${link}</p>
    <p>Após a confirmação você será redirecionado para nosso portal.</p>
    <p>Equipe AdvanceMais</p>
  </body>
</html>`,
      text: `Olá ${firstName},\n\nBem-vindo ao AdvanceMais! Confirme seu cadastro pelo link abaixo:\n${link}\n\nApós a confirmação você será redirecionado para nosso portal.\n\nEquipe AdvanceMais`,
    };
  }

  /**
   * Email para recuperação de senha
   */
  public static generatePasswordRecoveryEmail(
    data: PasswordRecoveryData
  ): EmailTemplate {
    const firstName = data.nomeCompleto.split(" ")[0];
    const link = data.linkRecuperacao;

    return {
      subject: "Recuperação de Senha - AdvanceMais",
      html: `<!DOCTYPE html>
<html lang="pt-BR">
  <body>
    <p>Olá ${firstName},</p>
    <p>Recebemos uma solicitação para redefinir sua senha.</p>
    <p><a href="${link}">Recuperar senha</a></p>
    <p>Se o botão não funcionar, copie e cole o link no navegador:</p>
    <p>${link}</p>
    <p>Este link é válido por ${data.expiracaoMinutos} minutos.</p>
    <p>Se você não solicitou esta alteração, ignore este email.</p>
    <p>Equipe AdvanceMais</p>
  </body>
</html>`,
      text: `Olá ${firstName},\n\nRecebemos uma solicitação para redefinir sua senha. Use o link abaixo para criar uma nova senha:\n${link}\n\nEste link é válido por ${data.expiracaoMinutos} minutos.\nSe você não fez esta solicitação, ignore este email.\n\nEquipe AdvanceMais`,
    };
  }

  // Métodos antigos mantidos para compatibilidade
  public static generateVerificationEmail(
    data: AccountConfirmationEmailData
  ): EmailTemplate {
    return this.generateAccountConfirmationEmail(data);
  }

  public static generateWelcomeEmail(
    data: AccountConfirmationEmailData
  ): EmailTemplate {
    return this.generateAccountConfirmationEmail(data);
  }
}
