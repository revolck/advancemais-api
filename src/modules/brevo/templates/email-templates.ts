import * as fs from "fs";
import * as path from "path";

/**
 * Sistema de templates simplificado e eficiente
 *
 * Responsabilidades:
 * - Gerar emails personalizados
 * - Carregar templates HTML de forma síncrona
 * - Fornecer fallbacks robustos
 *
 * @author Sistema AdvanceMais
 * @version 5.0.0 - Simplificação total
 */
export interface WelcomeEmailData {
  nomeCompleto: string;
  tipoUsuario: string;
  email: string;
  frontendUrl: string;
}

export interface PasswordRecoveryData {
  nomeCompleto: string;
  token: string;
  linkRecuperacao: string;
  expiracaoMinutos: number;
}

export class EmailTemplates {
  private static templatesDir = path.join(__dirname, "html");

  /**
   * Gera email de boas-vindas com template dinâmico
   */
  public static generateWelcomeEmail(data: WelcomeEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
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
   * Gera email de recuperação de senha
   */
  public static generatePasswordRecoveryEmail(data: PasswordRecoveryData): {
    subject: string;
    html: string;
    text: string;
  } {
    return {
      subject: "🔐 Recuperação de Senha - AdvanceMais",
      html: this.loadPasswordRecoveryHTML(data),
      text: this.generatePasswordRecoveryText(data),
    };
  }

  /**
   * Carrega template HTML de boas-vindas com fallback
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
   * Carrega template HTML de recuperação com fallback
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
   * Substitui variáveis no template de forma segura
   */
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

  /**
   * Formata tipo de usuário para exibição
   */
  private static formatUserType(userType: string): string {
    const types: Record<string, string> = {
      PESSOA_FISICA: "pessoa física",
      PESSOA_JURIDICA: "empresa",
    };
    return types[userType] || "usuário";
  }

  /**
   * Gera versão texto do email de boas-vindas
   */
  private static generateWelcomeText(data: WelcomeEmailData): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
Bem-vindo ao AdvanceMais!

Olá ${firstName},

Sua conta foi criada com sucesso em nossa plataforma.

Para começar, acesse: ${data.frontendUrl}/login

Atenciosamente,
Equipe AdvanceMais
    `.trim();
  }

  /**
   * Gera versão texto do email de recuperação
   */
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

  /**
   * Template HTML de fallback para boas-vindas
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
   * Template HTML de fallback para recuperação de senha
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

  /**
   * Escapa HTML para prevenir XSS
   */
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
