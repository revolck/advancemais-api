/**
 * Gerador de templates de email otimizado
 * Templates responsivos e modernos com fallbacks robustos
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0
 */

import {
  WelcomeTemplateData,
  PasswordRecoveryTemplateData,
} from "../types/interfaces";

export class EmailTemplates {
  private static templateCache = new Map<string, string>();

  /**
   * Gera template de boas-vindas
   */
  public static generateWelcomeTemplate(data: WelcomeTemplateData): string {
    try {
      const cacheKey = `welcome_${data.tipoUsuario}`;

      if (this.templateCache.has(cacheKey)) {
        return this.replaceVariables(this.templateCache.get(cacheKey)!, data);
      }

      const template = this.getWelcomeHTMLTemplate();
      this.templateCache.set(cacheKey, template);

      return this.replaceVariables(template, data);
    } catch (error) {
      console.error("❌ Erro no template de boas-vindas:", error);
      return this.getFallbackWelcomeTemplate(data);
    }
  }

  /**
   * Gera template de recuperação de senha
   */
  public static generatePasswordRecoveryTemplate(
    data: PasswordRecoveryTemplateData
  ): string {
    try {
      const template = this.getPasswordRecoveryHTMLTemplate();
      return this.replaceVariables(template, data);
    } catch (error) {
      console.error("❌ Erro no template de recuperação:", error);
      return this.getFallbackPasswordRecoveryTemplate(data);
    }
  }

  /**
   * Gera versão texto do template de boas-vindas
   */
  public static generateWelcomeText(data: WelcomeTemplateData): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
Bem-vindo ao AdvanceMais, ${data.nomeCompleto}!

Olá ${firstName},

É com grande satisfação que te damos as boas-vindas ao AdvanceMais!

Sua conta como ${data.tipoUsuario} foi criada com sucesso e você já pode começar a explorar nossa plataforma.

Para começar, acesse: ${data.frontendUrl}/login

Atenciosamente,
Equipe AdvanceMais

© ${data.ano} AdvanceMais. Todos os direitos reservados.
    `.trim();
  }

  /**
   * Gera versão texto do template de recuperação
   */
  public static generatePasswordRecoveryText(
    data: PasswordRecoveryTemplateData
  ): string {
    const firstName = data.nomeCompleto.split(" ")[0];

    return `
Recuperação de Senha - AdvanceMais

Olá, ${firstName}!

Para redefinir sua senha, acesse: ${data.linkRecuperacao}

Ou use o código: ${data.token}

IMPORTANTE:
- Válido por ${data.expiracaoMinutos} minutos
- Máximo ${data.maxTentativas} tentativas
- Se não solicitou, ignore este email

Atenciosamente,
Equipe AdvanceMais

© ${data.ano} AdvanceMais. Todos os direitos reservados.
    `.trim();
  }

  /**
   * Template HTML de boas-vindas
   */
  private static getWelcomeHTMLTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao AdvanceMais</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .content h2 { color: #2c3e50; font-size: 24px; margin-bottom: 20px; }
    .content p { margin-bottom: 15px; font-size: 16px; color: #555; line-height: 1.6; }
    .button { display: inline-block; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef; }
    .footer p { font-size: 14px; color: #6c757d; margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vindo ao AdvanceMais!</h1>
      <p>Sua jornada de crescimento profissional começa aqui</p>
    </div>
    <div class="content">
      <h2>Olá, {{nomeCompleto}}!</h2>
      <p>É com grande satisfação que te damos as boas-vindas ao <strong>AdvanceMais</strong>!</p>
      <p>Sua conta como <strong>{{tipoUsuario}}</strong> foi criada com sucesso e você já pode começar a explorar nossa plataforma.</p>
      <p style="text-align: center;">
        <a href="{{frontendUrl}}/login" class="button">🚀 Acessar Plataforma</a>
      </p>
      <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong> 💚</p>
    </div>
    <div class="footer">
      <p>© {{ano}} AdvanceMais. Todos os direitos reservados.</p>
      <p>Este é um email automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Template HTML de recuperação de senha
   */
  private static getPasswordRecoveryHTMLTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .content h2 { color: #2c3e50; font-size: 24px; margin-bottom: 20px; }
    .content p { margin-bottom: 15px; font-size: 16px; color: #555; line-height: 1.6; }
    .button { display: inline-block; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .token-box { background-color: #f8f9fa; border: 2px dashed #dee2e6; padding: 20px; border-radius: 8px; font-family: monospace; text-align: center; margin: 25px 0; font-size: 18px; font-weight: bold; color: #495057; }
    .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-left: 4px solid #ffc107; padding: 20px; border-radius: 6px; margin: 25px 0; }
    .footer { background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef; }
    .footer p { font-size: 14px; color: #6c757d; margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Recuperação de Senha</h1>
    </div>
    <div class="content">
      <h2>Olá, {{nomeCompleto}}!</h2>
      <p>Recebemos uma solicitação para recuperar a senha da sua conta no AdvanceMais.</p>
      <p>Para redefinir sua senha com segurança, clique no botão abaixo:</p>
      <p style="text-align: center;">
        <a href="{{linkRecuperacao}}" class="button">🔑 Redefinir Senha</a>
      </p>
      <p>Ou copie e cole o seguinte código na página de recuperação:</p>
      <div class="token-box">{{token}}</div>
      <div class="warning">
        <p><strong>⚠️ Importante:</strong></p>
        <ul>
          <li>Válido por {{expiracaoMinutos}} minutos</li>
          <li>Máximo {{maxTentativas}} tentativas por hora</li>
          <li>Se não solicitou, ignore este email</li>
        </ul>
      </div>
      <p>Atenciosamente,<br><strong>Equipe de Segurança AdvanceMais</strong> 🔒</p>
    </div>
    <div class="footer">
      <p>© {{ano}} AdvanceMais. Todos os direitos reservados.</p>
      <p>Este é um email automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Substitui variáveis no template
   */
  private static replaceVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      const safeValue = this.sanitizeValue(value);
      result = result.replace(regex, safeValue);
    });

    return result;
  }

  /**
   * Sanitiza valores para HTML
   */
  private static sanitizeValue(value: any): string {
    if (value === null || value === undefined) return "";

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Template de fallback para boas-vindas
   */
  private static getFallbackWelcomeTemplate(data: WelcomeTemplateData): string {
    return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #4CAF50;">🎉 Bem-vindo ao AdvanceMais!</h1>
  <p>Olá, ${this.sanitizeValue(data.nomeCompleto)}!</p>
  <p>Sua conta como <strong>${this.sanitizeValue(
    data.tipoUsuario
  )}</strong> foi criada com sucesso!</p>
  <p><a href="${this.sanitizeValue(
    data.frontendUrl
  )}/login" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar Plataforma</a></p>
  <hr>
  <p style="font-size: 12px; color: #666;">© ${
    data.ano
  } AdvanceMais. Todos os direitos reservados.</p>
</div>`;
  }

  /**
   * Template de fallback para recuperação
   */
  private static getFallbackPasswordRecoveryTemplate(
    data: PasswordRecoveryTemplateData
  ): string {
    return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #ff9800;">🔐 Recuperação de Senha</h1>
  <p>Olá, ${this.sanitizeValue(data.nomeCompleto)}!</p>
  <p>Para recuperar sua senha, use o código: <strong>${this.sanitizeValue(
    data.token
  )}</strong></p>
  <p><a href="${this.sanitizeValue(
    data.linkRecuperacao
  )}" style="background: #ff9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a></p>
  <p style="color: #d32f2f;"><strong>Válido por ${
    data.expiracaoMinutos
  } minutos!</strong></p>
  <hr>
  <p style="font-size: 12px; color: #666;">© ${
    data.ano
  } AdvanceMais. Todos os direitos reservados.</p>
</div>`;
  }

  /**
   * Limpa cache de templates
   */
  public static clearCache(): void {
    this.templateCache.clear();
    console.log("🗑️ Cache de templates limpo");
  }
}
