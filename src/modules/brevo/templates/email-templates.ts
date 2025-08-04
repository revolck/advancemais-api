import * as fs from "fs";
import * as path from "path";

/**
 * Sistema de templates simplificado para emails transacionais
 * Templates modernos e responsivos para todas as necessidades
 *
 * @author Sistema AdvanceMais
 * @version 7.0.0 - Templates simplificados e funcionais
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
      html: this.getVerificationHTML(data),
      text: this.getVerificationText(data),
    };
  }

  /**
   * Gera email de boas-vindas simples
   */
  public static generateWelcomeEmail(data: WelcomeEmailData): EmailTemplate {
    const firstName = data.nomeCompleto.split(" ")[0];
    const userType =
      data.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa física";

    return {
      subject: `🎉 Bem-vind${
        userType === "empresa" ? "a" : "o"
      } ao AdvanceMais, ${firstName}!`,
      html: this.getWelcomeHTML(data),
      text: this.getWelcomeText(data),
    };
  }

  /**
   * Gera email de recuperação de senha
   */
  public static generatePasswordRecoveryEmail(
    data: PasswordRecoveryData
  ): EmailTemplate {
    return {
      subject: "🔐 Recuperação de Senha - AdvanceMais",
      html: this.getPasswordRecoveryHTML(data),
      text: this.getPasswordRecoveryText(data),
    };
  }

  // ===========================
  // TEMPLATES HTML
  // ===========================

  /**
   * Template HTML para verificação de email
   */
  private static getVerificationHTML(data: EmailVerificationData): string {
    const firstName = data.nomeCompleto.split(" ")[0];
    const userTypeText =
      data.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa física";

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu Email - AdvanceMais</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .welcome-message { font-size: 18px; color: #333; margin-bottom: 30px; line-height: 1.6; }
    .verification-box { background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
    .verification-title { font-size: 20px; font-weight: 600; color: #333; margin-bottom: 15px; }
    .verification-text { color: #666; margin-bottom: 25px; line-height: 1.5; }
    .verify-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .verify-button:hover { opacity: 0.9; }
    .security-note { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 30px 0; }
    .security-note h3 { margin: 0 0 10px 0; color: #856404; font-size: 16px; }
    .security-note p { margin: 0; color: #856404; font-size: 14px; }
    .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
    .token-info { background: #e8f4fd; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 12px; color: #31708f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vind${
        userTypeText === "empresa" ? "a" : "o"
      } ao AdvanceMais!</h1>
    </div>
    
    <div class="content">
      <div class="welcome-message">
        <p>Olá <strong>${firstName}</strong>,</p>
        <p>Sua conta como <strong>${userTypeText}</strong> foi criada com sucesso! Para começar a usar todos os recursos da plataforma AdvanceMais, você precisa confirmar seu endereço de email.</p>
      </div>

      <div class="verification-box">
        <div class="verification-title">🔐 Confirme seu Email</div>
        <div class="verification-text">
          Clique no botão abaixo para ativar sua conta e ter acesso completo à plataforma:
        </div>
        <a href="${data.verificationUrl}" class="verify-button">
          ✅ Confirmar Email
        </a>
        <div class="token-info">
          Este link é válido por ${
            data.expirationHours
          } horas e pode ser usado apenas uma vez.
        </div>
      </div>

      <div class="security-note">
        <h3>🛡️ Segurança</h3>
        <p>Se você não criou uma conta no AdvanceMais, pode ignorar este email com segurança. Sua conta só será ativada após a confirmação.</p>
      </div>

      <p style="color: #666; line-height: 1.6;">
        <strong>O que você pode fazer no AdvanceMais:</strong><br>
        • Acesso a ferramentas financeiras avançadas<br>
        • Gestão completa de seus investimentos<br>
        • Análises e relatórios personalizados<br>
        • Suporte especializado para ${userTypeText}s
      </p>
    </div>

    <div class="footer">
      <p><strong>AdvanceMais</strong> - Sua plataforma de avanços financeiros</p>
      <p>Se você não conseguir clicar no botão, copie e cole este link no seu navegador:</p>
      <p style="word-break: break-all; color: #667eea;">${
        data.verificationUrl
      }</p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Template HTML para boas-vindas simples
   */
  private static getWelcomeHTML(data: WelcomeEmailData): string {
    const firstName = data.nomeCompleto.split(" ")[0];
    const userTypeText =
      data.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa física";

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao AdvanceMais</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .welcome-message { font-size: 18px; color: #333; margin-bottom: 30px; line-height: 1.6; }
    .action-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .action-button:hover { opacity: 0.9; }
    .features-box { background: #f8f9fa; border-radius: 12px; padding: 30px; margin: 30px 0; }
    .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vind${
        userTypeText === "empresa" ? "a" : "o"
      } ao AdvanceMais!</h1>
    </div>
    
    <div class="content">
      <div class="welcome-message">
        <p>Olá <strong>${firstName}</strong>,</p>
        <p>Sua conta como <strong>${userTypeText}</strong> foi criada com sucesso! Agora você tem acesso completo a todos os recursos da plataforma AdvanceMais.</p>
      </div>

      <div style="text-align: center;">
        <a href="${data.frontendUrl}/login" class="action-button">
          🚀 Acessar Plataforma
        </a>
      </div>

      <div class="features-box">
        <h3 style="color: #333; margin-bottom: 20px;">🌟 O que você pode fazer agora:</h3>
        <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
          <li>Acesso a ferramentas financeiras avançadas</li>
          <li>Gestão completa de seus investimentos</li>
          <li>Análises e relatórios personalizados</li>
          <li>Suporte especializado para ${userTypeText}s</li>
        </ul>
      </div>

      <p style="color: #666; line-height: 1.6;">
        Se você tiver alguma dúvida, nossa equipe de suporte está sempre disponível para ajudar.
      </p>
    </div>

    <div class="footer">
      <p><strong>AdvanceMais</strong> - Sua plataforma de avanços financeiros</p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Template HTML para recuperação de senha
   */
  private static getPasswordRecoveryHTML(data: PasswordRecoveryData): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha - AdvanceMais</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .recovery-box { background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
    .recovery-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .security-note { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 30px 0; }
    .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Recuperação de Senha</h1>
    </div>
    
    <div class="content">
      <p style="font-size: 18px; color: #333; margin-bottom: 30px;">
        Olá <strong>${firstName}</strong>,
      </p>
      
      <p style="color: #666; line-height: 1.6;">
        Recebemos uma solicitação para redefinir a senha da sua conta no AdvanceMais.
      </p>

      <div class="recovery-box">
        <h3 style="color: #333; margin-bottom: 15px;">Redefinir Senha</h3>
        <p style="color: #666; margin-bottom: 25px;">
          Clique no botão abaixo para criar uma nova senha:
        </p>
        <a href="${data.linkRecuperacao}" class="recovery-button">
          🔑 Redefinir Senha
        </a>
        <p style="font-size: 12px; color: #999; margin-top: 15px;">
          Este link é válido por ${data.expiracaoMinutos} minutos.
        </p>
      </div>

      <div class="security-note">
        <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">🛡️ Segurança</h3>
        <p style="margin: 0; color: #856404; font-size: 14px;">
          Se você não solicitou esta recuperação, pode ignorar este email com segurança. Sua senha atual permanecerá inalterada.
        </p>
      </div>
    </div>

    <div class="footer">
      <p><strong>AdvanceMais</strong> - Sua plataforma de avanços financeiros</p>
      <p>Se você não conseguir clicar no botão, copie e cole este link no seu navegador:</p>
      <p style="word-break: break-all; color: #667eea;">${
        data.linkRecuperacao
      }</p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // ===========================
  // TEMPLATES TEXTO
  // ===========================

  /**
   * Template texto para verificação
   */
  private static getVerificationText(data: EmailVerificationData): string {
    const firstName = data.nomeCompleto.split(" ")[0];
    const userType =
      data.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa física";

    return `
Bem-vind${userType === "empresa" ? "a" : "o"} ao AdvanceMais, ${firstName}!

Sua conta como ${userType} foi criada com sucesso! Para começar a usar todos os recursos da plataforma, você precisa confirmar seu endereço de email.

CONFIRME SEU EMAIL:
${data.verificationUrl}

Este link é válido por ${
      data.expirationHours
    } horas e pode ser usado apenas uma vez.

SEGURANÇA:
Se você não criou uma conta no AdvanceMais, pode ignorar este email com segurança.

O que você pode fazer no AdvanceMais:
• Acesso a ferramentas financeiras avançadas
• Gestão completa de seus investimentos  
• Análises e relatórios personalizados
• Suporte especializado

---
AdvanceMais - Sua plataforma de avanços financeiros
© ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.
`;
  }

  /**
   * Template texto para boas-vindas
   */
  private static getWelcomeText(data: WelcomeEmailData): string {
    const firstName = data.nomeCompleto.split(" ")[0];
    const userType =
      data.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa física";

    return `
Bem-vind${userType === "empresa" ? "a" : "o"} ao AdvanceMais, ${firstName}!

Sua conta como ${userType} foi criada com sucesso! Agora você tem acesso completo a todos os recursos da plataforma AdvanceMais.

ACESSAR PLATAFORMA:
${data.frontendUrl}/login

O que você pode fazer agora:
• Acesso a ferramentas financeiras avançadas
• Gestão completa de seus investimentos
• Análises e relatórios personalizados
• Suporte especializado para ${userType}s

Se você tiver alguma dúvida, nossa equipe de suporte está sempre disponível para ajudar.

---
AdvanceMais - Sua plataforma de avanços financeiros
© ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.
`;
  }

  /**
   * Template texto para recuperação de senha
   */
  private static getPasswordRecoveryText(data: PasswordRecoveryData): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
Recuperação de Senha - AdvanceMais

Olá ${firstName},

Recebemos uma solicitação para redefinir a senha da sua conta no AdvanceMais.

REDEFINIR SENHA:
${data.linkRecuperacao}

Este link é válido por ${data.expiracaoMinutos} minutos.

SEGURANÇA:
Se você não solicitou esta recuperação, pode ignorar este email com segurança. Sua senha atual permanecerá inalterada.

---
AdvanceMais - Sua plataforma de avanços financeiros
© ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.
`;
  }
}
