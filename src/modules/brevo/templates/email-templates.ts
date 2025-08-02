/**
 * Gerador de templates de email otimizado
 * REFATORAÇÃO: Carrega templates HTML de arquivos separados ao invés de hardcode
 *
 * Benefícios da refatoração:
 * - Separação de responsabilidades (HTML vs lógica)
 * - Melhor manutenibilidade dos templates
 * - Facilita edição por designers
 * - Cache inteligente para performance
 * - Fallbacks robustos
 *
 * @author Sistema AdvanceMais
 * @version 4.0.0 - Refatoração para arquivos HTML externos
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  WelcomeTemplateData,
  PasswordRecoveryTemplateData,
} from "../types/interfaces";

export class EmailTemplates {
  private static templateCache = new Map<string, string>();
  private static readonly TEMPLATES_DIR = path.join(__dirname, "html");

  /**
   * Gera template de boas-vindas carregando de arquivo HTML
   */
  public static async generateWelcomeTemplate(
    data: WelcomeTemplateData
  ): Promise<string> {
    try {
      const cacheKey = `welcome_${data.tipoUsuario}`;

      // Verifica cache primeiro
      if (this.templateCache.has(cacheKey)) {
        return this.replaceVariables(this.templateCache.get(cacheKey)!, data);
      }

      // Carrega template do arquivo HTML
      const template = await this.loadHTMLTemplate("welcome-email.html");
      this.templateCache.set(cacheKey, template);

      return this.replaceVariables(template, data);
    } catch (error) {
      console.error("❌ Erro ao carregar template de boas-vindas:", error);
      return this.getFallbackWelcomeTemplate(data);
    }
  }

  /**
   * Gera template de recuperação de senha carregando de arquivo HTML
   */
  public static async generatePasswordRecoveryTemplate(
    data: PasswordRecoveryTemplateData
  ): Promise<string> {
    try {
      const cacheKey = "password_recovery";

      // Verifica cache primeiro
      if (this.templateCache.has(cacheKey)) {
        return this.replaceVariables(this.templateCache.get(cacheKey)!, data);
      }

      // Carrega template do arquivo HTML
      const template = await this.loadHTMLTemplate(
        "password-recovery-email.html"
      );
      this.templateCache.set(cacheKey, template);

      return this.replaceVariables(template, data);
    } catch (error) {
      console.error("❌ Erro ao carregar template de recuperação:", error);
      return this.getFallbackPasswordRecoveryTemplate(data);
    }
  }

  /**
   * Carrega template HTML de arquivo
   * Implementa cache e tratamento de erro robusto
   */
  private static async loadHTMLTemplate(filename: string): Promise<string> {
    try {
      const filePath = path.join(this.TEMPLATES_DIR, filename);

      // Verifica se arquivo existe
      await fs.access(filePath);

      // Carrega conteúdo do arquivo
      const content = await fs.readFile(filePath, "utf-8");

      if (!content || content.trim().length === 0) {
        throw new Error(`Template vazio: ${filename}`);
      }

      console.log(`✅ Template carregado com sucesso: ${filename}`);
      return content;
    } catch (error) {
      console.error(`❌ Erro ao carregar template ${filename}:`, error);
      throw error;
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
   * Template de fallback para boas-vindas (caso arquivo não carregue)
   */
  private static getFallbackWelcomeTemplate(data: WelcomeTemplateData): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao AdvanceMais</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
    .header { text-align: center; color: #4CAF50; margin-bottom: 30px; }
    .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vindo ao AdvanceMais!</h1>
    </div>
    <p>Olá, <strong>${this.sanitizeValue(data.nomeCompleto)}</strong>!</p>
    <p>Sua conta como <strong>${this.sanitizeValue(
      data.tipoUsuario
    )}</strong> foi criada com sucesso!</p>
    <p style="text-align: center;">
      <a href="${this.sanitizeValue(
        data.frontendUrl
      )}/login" class="button">Acessar Plataforma</a>
    </p>
    <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong></p>
    <hr>
    <p style="font-size: 12px; color: #666;">© ${
      data.ano
    } AdvanceMais. Todos os direitos reservados.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Template de fallback para recuperação
   */
  private static getFallbackPasswordRecoveryTemplate(
    data: PasswordRecoveryTemplateData
  ): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
    .header { text-align: center; color: #ff9800; margin-bottom: 30px; }
    .button { display: inline-block; background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
    .token { background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Recuperação de Senha</h1>
    </div>
    <p>Olá, <strong>${this.sanitizeValue(data.nomeCompleto)}</strong>!</p>
    <p>Para recuperar sua senha, use o código:</p>
    <div class="token">${this.sanitizeValue(data.token)}</div>
    <p style="text-align: center;">
      <a href="${this.sanitizeValue(
        data.linkRecuperacao
      )}" class="button">Redefinir Senha</a>
    </p>
    <p style="color: #d32f2f;"><strong>Válido por ${
      data.expiracaoMinutos
    } minutos!</strong></p>
    <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong></p>
    <hr>
    <p style="font-size: 12px; color: #666;">© ${
      data.ano
    } AdvanceMais. Todos os direitos reservados.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Precarrega templates para cache
   * Útil para inicialização da aplicação
   */
  public static async preloadTemplates(): Promise<void> {
    try {
      console.log("🔄 Precarregando templates de email...");

      const templates = ["welcome-email.html", "password-recovery-email.html"];

      const loadPromises = templates.map(async (template) => {
        try {
          const content = await this.loadHTMLTemplate(template);
          this.templateCache.set(template, content);
          console.log(`✅ Template precarregado: ${template}`);
        } catch (error) {
          console.warn(`⚠️ Falha ao precarregar template ${template}:`, error);
        }
      });

      await Promise.allSettled(loadPromises);
      console.log("✅ Precarregamento de templates concluído");
    } catch (error) {
      console.error("❌ Erro no precarregamento de templates:", error);
    }
  }

  /**
   * Limpa cache de templates
   */
  public static clearCache(): void {
    this.templateCache.clear();
    console.log("🗑️ Cache de templates limpo");
  }

  /**
   * Obtém estatísticas do cache
   */
  public static getCacheStats(): {
    size: number;
    templates: string[];
    memoryUsage: string;
  } {
    const templates = Array.from(this.templateCache.keys());
    const memoryUsage = templates.reduce((total, key) => {
      return total + (this.templateCache.get(key)?.length || 0);
    }, 0);

    return {
      size: this.templateCache.size,
      templates,
      memoryUsage: `${Math.round(memoryUsage / 1024)} KB`,
    };
  }

  /**
   * Valida se todos os templates necessários existem
   */
  public static async validateTemplates(): Promise<{
    valid: boolean;
    missing: string[];
    errors: string[];
  }> {
    const requiredTemplates = [
      "welcome-email.html",
      "password-recovery-email.html",
    ];

    const missing: string[] = [];
    const errors: string[] = [];

    for (const template of requiredTemplates) {
      try {
        const filePath = path.join(this.TEMPLATES_DIR, template);
        await fs.access(filePath);

        // Tenta carregar para validar conteúdo
        const content = await fs.readFile(filePath, "utf-8");
        if (!content || content.trim().length === 0) {
          errors.push(`Template vazio: ${template}`);
        }
      } catch (error) {
        missing.push(template);
      }
    }

    return {
      valid: missing.length === 0 && errors.length === 0,
      missing,
      errors,
    };
  }
}
