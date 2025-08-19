export interface AccountConfirmationEmailData {
  /** Nome completo do destinatário */
  nomeCompleto: string;
  /** URL completa para validação do token de confirmação */
  verificationUrl?: string;
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
  /** Tempo de expiração do link em horas */
  expiracaoHoras: number;
  /** Número máximo de tentativas permitidas */
  maxTentativas: number;
  // Token opcional apenas para compatibilidade
  token?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Templates de email com design limpo e profissional
 * Foco na legibilidade e experiência do usuário
 */
export class EmailTemplates {
  /**
   * Retorna o ano atual para uso nos templates
   */
  private static getCurrentYear(): number {
    return new Date().getFullYear();
  }

  /**
   * Styles base - design limpo com bom contraste
   */
  private static getBaseStyles(): string {
    return `
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f8fafc;
          color: #1e293b;
        }
        
        .email-wrapper {
          background-color: #f8fafc;
          padding: 20px;
          min-height: 100vh;
        }
        
        .email-container {
          max-width: 560px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        
        .header {
          background: linear-gradient(135deg, #00257d 0%, #001a57 100%);
          padding: 32px 24px;
          text-align: center;
        }
        
        .logo {
          margin-bottom: 0;
        }
        
        .logo img {
          height: 40px;
          width: auto;
          display: block;
          margin: 0 auto;
        }
        
        .content {
          padding: 48px 32px;
        }
        
        .greeting {
          font-size: 18px;
          color: #0f172a;
          font-weight: 600;
          margin-bottom: 24px;
        }
        
        .message {
          font-size: 16px;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 32px;
        }
        
        .cta-button {
          display: inline-block;
          background-color: #dc2626;
          color: #ffffff !important;
          padding: 16px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 32px;
          transition: background-color 0.2s;
        }
        
        .cta-button:hover {
          background-color: #b91c1c;
        }
        
        .fallback-section {
          background-color: #f1f5f9;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }
        
        .fallback-title {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
        }
        
        .fallback-link {
          color: #00257d;
          word-break: break-all;
          font-size: 13px;
          line-height: 1.4;
        }
        
        .info-box {
          border-left: 4px solid #00257d;
          background-color: #f8fafc;
          padding: 20px;
          margin: 24px 0;
          border-radius: 0 8px 8px 0;
        }
        
        .info-text {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }
        
        .footer {
          background-color: #f8fafc;
          padding: 32px 24px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
        }
        
        .company-name {
          font-weight: 600;
          color: #00257d;
        }
        
        .warning-box {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 20px;
          margin: 24px 0;
        }
        
        .warning-title {
          font-size: 15px;
          font-weight: 600;
          color: #dc2626;
          margin-bottom: 8px;
        }
        
        .warning-text {
          font-size: 14px;
          color: #7f1d1d;
          line-height: 1.5;
          margin: 0;
        }
        
        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 16px; }
          .content { padding: 32px 24px; }
          .header { padding: 24px 20px; }
          .greeting { font-size: 16px; }
          .message { font-size: 15px; }
          .cta-button { padding: 14px 24px; font-size: 15px; }
        }
      </style>
    `;
  }

  /**
   * Email de confirmação de conta - design limpo e direto
   */
  public static generateAccountConfirmationEmail(
    data: AccountConfirmationEmailData
  ): EmailTemplate {
    const firstName = data.nomeCompleto.split(" ")[0];
    const currentYear = this.getCurrentYear();

    return {
      subject: `Confirme sua conta`,
      html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmar Conta - Advance+</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.webp" alt="Advance+" />
        </div>
      </div>
      
      <div class="content">
        <div class="greeting">Olá, ${firstName}!</div>
        
        <div class="message">
          Obrigado por se cadastrar na Advance+. Para começar a usar nossa plataforma, 
          você precisa confirmar seu endereço de email.
        </div>
        
        <div style="text-align: center;">
          <a
            href="${data.verificationUrl}"
            class="cta-button"
            style="color: #ffffff !important;"
          >
            Confirmar minha conta
          </a>
        </div>
        
        <div class="fallback-section">
          <div class="fallback-title">Não consegue clicar no botão?</div>
          <div>Copie e cole este link no seu navegador:</div>
          <div style="margin-top: 8px;">
            <a href="${data.verificationUrl}" class="fallback-link">${
        data.verificationUrl
      }</a>
          </div>
        </div>
        
        <div class="info-box">
          <p class="info-text">
            <strong>Importante:</strong> Este link expira em ${
              data.expirationHours ?? 72
            } horas.
            Se não confirmar até lá, você precisará fazer um novo cadastro.
          </p>
        </div>
        
      </div>
      
      <div class="footer">
        <div class="footer-text">
          Advance+ © ${currentYear} todos os direitos reservados.
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>`,
      text: `Confirme sua conta na Advance+\n\nOlá, ${firstName}!\n\nObrigado por se cadastrar na Advance+. Para começar a usar nossa plataforma, confirme seu endereço de email através do link abaixo:\n\n${
        data.verificationUrl
      }\n\nEste link expira em ${
        data.expirationHours ?? 72
      } horas. Se não confirmar até lá, você precisará fazer um novo cadastro.\n\n© ${currentYear} Advance+ - Todos os direitos reservados`,
    };
  }

  /**
   * Email de recuperação de senha - foco na segurança
   */
  public static generatePasswordRecoveryEmail(
    data: PasswordRecoveryData
  ): EmailTemplate {
    const firstName = data.nomeCompleto.split(" ")[0];
    const currentYear = this.getCurrentYear();

    return {
      subject: `Redefinir senha da sua conta`,
      html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir Senha - Advance+</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.webp" alt="Advance+" />
        </div>
      </div>
      
      <div class="content">
        <div class="greeting">Olá, ${firstName}</div>
        
        <div class="message">
          Recebemos uma solicitação para redefinir a senha da sua conta. 
          Se foi você quem solicitou, clique no botão abaixo para criar uma nova senha.
        </div>
        
        <div style="text-align: center;">
          <a
            href="${data.linkRecuperacao}"
            class="cta-button"
            style="color: #ffffff !important;"
          >
            Redefinir minha senha
          </a>
        </div>
        
        <div class="fallback-section">
          <div class="fallback-title">Não consegue clicar no botão?</div>
          <div>Copie e cole este link no seu navegador:</div>
          <div style="margin-top: 8px;">
            <a href="${data.linkRecuperacao}" class="fallback-link">${
        data.linkRecuperacao
      }</a>
          </div>
        </div>
        
        <div class="info-box">
          <p class="info-text">
            <strong>Este link expira em ${
              data.expiracaoHoras
            } horas</strong> por motivos de segurança.
          </p>
          <p class="info-text">
            Você pode realizar até ${
              data.maxTentativas
            } tentativas de recuperação.
          </p>
        </div>
        
        <div class="warning-box">
          <div class="warning-title">Não foi você?</div>
          <p class="warning-text">
            Se você não solicitou esta alteração, pode ignorar este email com segurança. 
            Sua senha não será alterada.
          </p>
        </div>
        
      </div>
      
      <div class="footer">
        <div class="footer-text">
         Advance+ © ${currentYear} todos os direitos reservados.
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>`,
      text: `Redefinir senha da sua conta Advance+\n\nOlá, ${firstName}\n\nRecebemos uma solicitação para redefinir a senha da sua conta. Se foi você quem solicitou, use o link abaixo para criar uma nova senha:\n\n${data.linkRecuperacao}\n\nEste link expira em ${data.expiracaoHoras} horas por motivos de segurança. Você pode realizar até ${data.maxTentativas} tentativas de recuperação.\n\nSe você não solicitou esta alteração, pode ignorar este email. Sua senha não será alterada.\n\n© ${currentYear} Advance+ - Todos os direitos reservados`,
    };
  }

  // Métodos de compatibilidade
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
