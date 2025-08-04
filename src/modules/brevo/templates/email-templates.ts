import * as fs from "fs";
import * as path from "path";

/**
 * Sistema de templates completo para emails transacionais
 * Implementa templates para todas as necessidades da plataforma
 *
 * Responsabilidades:
 * - Templates de boas-vindas
 * - Templates de verificação de email
 * - Templates de recuperação de senha
 * - Fallbacks robustos
 * - Personalização dinâmica
 *
 * @author Sistema AdvanceMais
 * @version 6.0.0 - Sistema completo de templates
 */

// Interfaces para dados dos templates
export interface WelcomeEmailData {
  nomeCompleto: string;
  tipoUsuario: string;
  email: string;
  frontendUrl: string;
}

export interface EmailVerificationData {
  nomeCompleto: string;
  email: string;
  tipoUsuario: string;
  verificationUrl: string;
  token: string;
  expirationHours: number;
  frontendUrl: string;
}

export interface PasswordRecoveryData {
  nomeCompleto: string;
  token: string;
  linkRecuperacao: string;
  expiracaoMinutos: number;
}

// Interface padrão para resposta de templates
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailTemplates {
  private static templatesDir = path.join(__dirname, "html");

  /**
   * Gera email de verificação de conta (NOVO)
   */
  public static generateVerificationEmail(
    data: EmailVerificationData
  ): EmailTemplate {
    const firstName = data.nomeCompleto.split(" ")[0];
    const userType =
      data.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa física";

    return {
      subject: `🔐 Confirme seu email - AdvanceMais`,
      html: this.loadVerificationHTML(data),
      text: this.generateVerificationText(data),
    };
  }

  /**
   * Gera email de boas-vindas (ATUALIZADO)
   */
  public static generateWelcomeEmail(data: WelcomeEmailData): EmailTemplate {
    const firstName = data.nomeCompleto.split(" ")[0];
    const userType =
      data.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa física";

    return {
      subject: `🎉 Bem-vind${
        userType === "empresa" ? "a" : "o"
      } ao AdvanceMais, ${firstName}!`,
      html: this.loadWelcomeHTML(data),
      text: this.generateWelcomeText(data),
    };
  }

  /**
   * Gera email de recuperação de senha (MANTIDO)
   */
  public static generatePasswordRecoveryEmail(
    data: PasswordRecoveryData
  ): EmailTemplate {
    return {
      subject: "🔐 Recuperação de Senha - AdvanceMais",
      html: this.loadPasswordRecoveryHTML(data),
      text: this.generatePasswordRecoveryText(data),
    };
  }

  /**
   * Carrega template HTML de verificação de email
   */
  private static loadVerificationHTML(data: EmailVerificationData): string {
    try {
      const templatePath = path.join(
        this.templatesDir,
        "email-verification.html"
      );

      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, "utf-8");
        return this.replaceVariables(template, {
          nomeCompleto: data.nomeCompleto,
          primeiroNome: data.nomeCompleto.split(" ")[0],
          email: data.email,
          tipoUsuario: this.formatUserType(data.tipoUsuario),
          verificationUrl: data.verificationUrl,
          token: data.token,
          expirationHours: data.expirationHours.toString(),
          frontendUrl: data.frontendUrl,
          ano: new Date().getFullYear().toString(),
        });
      }
    } catch (error) {
      console.warn(
        "⚠️ Template de verificação não encontrado, usando fallback"
      );
    }

    return this.getFallbackVerificationHTML(data);
  }

  /**
   * Carrega template HTML de boas-vindas
   */
  private static loadWelcomeHTML(data: WelcomeEmailData): string {
    try {
      const templatePath = path.join(this.templatesDir, "welcome-email.html");

      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, "utf-8");
        return this.replaceVariables(template, {
          nomeCompleto: data.nomeCompleto,
          tipoUsuario: this.formatUserType(data.tipoUsuario),
          frontendUrl: data.frontendUrl,
          ano: new Date().getFullYear().toString(),
          primeiroNome: data.nomeCompleto.split(" ")[0],
        });
      }
    } catch (error) {
      console.warn("⚠️ Template HTML não encontrado, usando fallback");
    }

    return this.getFallbackWelcomeHTML(data);
  }

  /**
   * Carrega template HTML de recuperação
   */
  private static loadPasswordRecoveryHTML(data: PasswordRecoveryData): string {
    try {
      const templatePath = path.join(
        this.templatesDir,
        "password-recovery-email.html"
      );

      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, "utf-8");
        return this.replaceVariables(template, {
          nomeCompleto: data.nomeCompleto,
          token: data.token,
          linkRecuperacao: data.linkRecuperacao,
          expiracaoMinutos: data.expiracaoMinutos.toString(),
          frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
          ano: new Date().getFullYear().toString(),
          maxTentativas: "3",
        });
      }
    } catch (error) {
      console.warn(
        "⚠️ Template de recuperação não encontrado, usando fallback"
      );
    }

    return this.getFallbackPasswordRecoveryHTML(data);
  }

  /**
   * Template HTML de fallback para verificação de email
   */
  private static getFallbackVerificationHTML(
    data: EmailVerificationData
  ): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu Email - AdvanceMais</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; padding: 20px; background-color: #f5f5f5; line-height: 1.6;
    }
    .container { 
      max-width: 600px; margin: 0 auto; background: white; 
      border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
    }
    .header { 
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); 
      color: white; padding: 40px 20px; text-align: center; 
    }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .header .emoji { font-size: 48px; display: block; margin-bottom: 15px; }
    .content { padding: 40px 30px; }
    .content h2 { color: #2c3e50; font-size: 24px; margin-bottom: 20px; }
    .content p { margin-bottom: 15px; font-size: 16px; color: #555; }
    .button { 
      display: inline-block; background: #007bff; color: white !important; 
      padding: 15px 30px; text-decoration: none; border-radius: 8px; 
      font-weight: 600; margin: 20px 0; transition: all 0.3s ease;
    }
    .button:hover { background: #0056b3; transform: translateY(-2px); }
    .token-box { 
      background: #f8f9fa; padding: 15px; border-radius: 8px; 
      font-family: monospace; font-size: 16px; text-align: center; 
      letter-spacing: 2px; margin: 20px 0; border: 2px dashed #ddd; 
      word-break: break-all;
    }
    .warning { 
      background: #fff3cd; border-left: 4px solid #ffc107; 
      padding: 20px; margin: 20px 0; border-radius: 4px; 
    }
    .warning h3 { color: #856404; margin: 0 0 10px 0; }
    .warning p { color: #856404; margin: 0; }
    .footer { 
      background: #f8f9fa; padding: 20px; text-align: center; 
      font-size: 14px; color: #666; border-top: 1px solid #e9ecef; 
    }
    .security-info { 
      background: #e7f3ff; border-left: 4px solid #007bff; 
      padding: 20px; margin: 20px 0; border-radius: 4px; 
    }
    @media (max-width: 600px) {
      .container { margin: 0; border-radius: 0; }
      .header, .content, .footer { padding-left: 20px; padding-right: 20px; }
      .header h1 { font-size: 24px; }
      .token-box { font-size: 14px; letter-spacing: 1px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="emoji">🔐</span>
      <h1>Confirme seu Email</h1>
      <p>Último passo para ativar sua conta</p>
    </div>
    
    <div class="content">
      <h2>Olá, ${firstName}!</h2>
      
      <p>Obrigado por se cadastrar no <strong>AdvanceMais</strong>!</p>
      
      <p>Para ativar sua conta e começar a usar nossa plataforma, você precisa confirmar seu endereço de email clicando no botão abaixo:</p>
      
      <div style="text-align: center;">
        <a href="${data.verificationUrl}" class="button">
          ✅ Confirmar Email
        </a>
      </div>
      
      <p>Ou copie e cole o seguinte link no seu navegador:</p>
      <div class="token-box">${data.verificationUrl}</div>
      
      <div class="security-info">
        <p><strong>🛡️ Segurança:</strong></p>
        <p>Este link é válido por <strong>${
          data.expirationHours
        } horas</strong> e só pode ser usado uma vez.</p>
      </div>
      
      <div class="warning">
        <h3>⚠️ Importante</h3>
        <p>Sem a confirmação do email, você não conseguirá fazer login na plataforma.</p>
      </div>
      
      <p>Se você não se cadastrou no AdvanceMais, pode ignorar este email com segurança.</p>
      
      <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong> 🚀</p>
    </div>
    
    <div class="footer">
      <p>Este é um email automático, por favor não responda.</p>
      <p>© ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Template HTML de fallback para boas-vindas (ATUALIZADO)
   */
  private static getFallbackWelcomeHTML(data: WelcomeEmailData): string {
    const firstName = data.nomeCompleto.split(" ")[0];
    const userType =
      data.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa";

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao AdvanceMais</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 40px 20px; text-align: center; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
    .info-box { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vind${userType === "empresa" ? "a" : "o"} ao AdvanceMais!</h1>
      <p>Sua jornada de crescimento profissional começa aqui</p>
    </div>
    <div class="content">
      <h2>Olá, ${firstName}!</h2>
      <p>É com grande satisfação que te damos as boas-vindas ao <strong>AdvanceMais</strong>!</p>
      <p>Sua conta como <strong>${this.formatUserType(
        data.tipoUsuario
      )}</strong> foi criada com sucesso.</p>
      
      <div class="info-box">
        <p><strong>📧 Próximo passo importante:</strong></p>
        <p>Verifique seu email para encontrar o link de confirmação de conta. Sem essa confirmação, você não conseguirá fazer login na plataforma.</p>
      </div>
      
      <div style="text-align: center;">
        <a href="${
          data.frontendUrl
        }/login" class="button">🚀 Acessar Plataforma</a>
      </div>
      <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong> 💚</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Template HTML de fallback para recuperação (MANTIDO)
   */
  private static getFallbackPasswordRecoveryHTML(
    data: PasswordRecoveryData
  ): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 40px 20px; text-align: center; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #ff9800; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .token { background: #f5f5f5; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 2px; margin: 20px 0; border: 2px dashed #ddd; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Recuperação de Senha</h1>
      <p>Redefina sua senha de forma segura</p>
    </div>
    <div class="content">
      <h2>Olá, ${firstName}!</h2>
      <p>Para recuperar sua senha, use o código abaixo:</p>
      <div class="token">${data.token}</div>
      <div style="text-align: center;">
        <a href="${data.linkRecuperacao}" class="button">🔑 Redefinir Senha</a>
      </div>
      <div class="warning">
        <p><strong>⚠️ Importante:</strong></p>
        <p>Este código é válido por apenas <strong>${
          data.expiracaoMinutos
        } minutos</strong>.</p>
      </div>
      <p>Se você não solicitou esta recuperação, ignore este email.</p>
      <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong> 🔒</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;
  }

  // Métodos para gerar versões texto
  private static generateVerificationText(data: EmailVerificationData): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
Confirme seu Email - AdvanceMais

Olá ${firstName},

Para ativar sua conta no AdvanceMais, confirme seu email acessando:
${data.verificationUrl}

Este link é válido por ${data.expirationHours} horas.

Sem a confirmação, você não conseguirá fazer login na plataforma.

Atenciosamente,
Equipe AdvanceMais
    `.trim();
  }

  private static generateWelcomeText(data: WelcomeEmailData): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
Bem-vindo ao AdvanceMais!

Olá ${firstName},

Sua conta foi criada com sucesso em nossa plataforma.

IMPORTANTE: Verifique seu email para encontrar o link de confirmação de conta.

Para começar, acesse: ${data.frontendUrl}/login

Atenciosamente,
Equipe AdvanceMais
    `.trim();
  }

  private static generatePasswordRecoveryText(
    data: PasswordRecoveryData
  ): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
Recuperação de Senha - AdvanceMais

Olá ${firstName},

Para redefinir sua senha, acesse: ${data.linkRecuperacao}

Ou use o código: ${data.token}

Válido por ${data.expiracaoMinutos} minutos.

Atenciosamente,
Equipe AdvanceMais
    `.trim();
  }

  // Métodos auxiliares
  private static replaceVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      result = result.replace(regex, this.escapeHtml(value));
    });

    return result;
  }

  private static formatUserType(userType: string): string {
    const types: Record<string, string> = {
      PESSOA_FISICA: "pessoa física",
      PESSOA_JURIDICA: "empresa",
    };
    return types[userType] || "usuário";
  }

  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
