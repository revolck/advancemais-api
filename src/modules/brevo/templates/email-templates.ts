import * as fs from "fs";
import * as path from "path";

/**
 * Interface para dados do template de boas-vindas
 */
interface WelcomeTemplateData {
  nomeCompleto: string;
  tipoUsuario: string;
  frontendUrl: string;
  ano: number;
}

/**
 * Interface para dados do template de recuperação de senha
 */
interface PasswordRecoveryTemplateData {
  nomeCompleto: string;
  linkRecuperacao: string;
  token: string;
  expiracaoMinutos: number;
  maxTentativas: number;
  frontendUrl: string;
  ano: number;
}

/**
 * Classe responsável por gerar templates de email
 * Carrega templates HTML externos e substitui variáveis
 */
export class EmailTemplates {
  private static templateCache = new Map<string, string>();

  /**
   * Carrega template HTML do arquivo
   * @param templateName - Nome do template
   * @returns Conteúdo HTML do template
   */
  private static loadTemplate(templateName: string): string {
    // Verifica cache primeiro
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    try {
      const templatePath = path.join(__dirname, "html", `${templateName}.html`);
      const templateContent = fs.readFileSync(templatePath, "utf8");

      // Armazena no cache
      this.templateCache.set(templateName, templateContent);

      return templateContent;
    } catch (error) {
      console.error(`Erro ao carregar template ${templateName}:`, error);
      throw new Error(`Template ${templateName} não encontrado`);
    }
  }

  /**
   * Substitui variáveis no template
   * @param template - Conteúdo do template
   * @param variables - Variáveis para substituição
   * @returns Template com variáveis substituídas
   */
  private static replaceVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      result = result.replace(regex, String(value));
    });

    return result;
  }

  /**
   * Gera template HTML para email de boas-vindas
   * @param data - Dados para o template
   * @returns String HTML do template
   */
  public static gerarTemplateBoasVindas(data: WelcomeTemplateData): string {
    try {
      const template = this.loadTemplate("welcome-email");
      return this.replaceVariables(template, {
        ...data,
        ano: new Date().getFullYear(),
      });
    } catch (error) {
      console.error("Erro ao gerar template de boas-vindas:", error);
      // Fallback para template simples
      return this.getFallbackWelcomeTemplate(data);
    }
  }

  /**
   * Gera template HTML para recuperação de senha
   * @param data - Dados para o template
   * @returns String HTML do template
   */
  public static gerarTemplateRecuperacaoSenha(
    data: PasswordRecoveryTemplateData
  ): string {
    try {
      const template = this.loadTemplate("password-recovery-email");
      return this.replaceVariables(template, {
        ...data,
        ano: new Date().getFullYear(),
      });
    } catch (error) {
      console.error("Erro ao gerar template de recuperação:", error);
      // Fallback para template simples
      return this.getFallbackPasswordRecoveryTemplate(data);
    }
  }

  /**
   * Gera template de texto simples para boas-vindas
   * @param data - Dados para o template
   * @returns String de texto simples
   */
  public static gerarTextoBoasVindas(data: WelcomeTemplateData): string {
    return `
Bem-vindo ao AdvanceMais, ${data.nomeCompleto}!

Sua conta como ${data.tipoUsuario} foi criada com sucesso.

Na AdvanceMais você terá acesso a:
- Cursos especializados e certificações
- Oportunidades exclusivas de carreira  
- Networking com profissionais da área
- Ferramentas de desenvolvimento pessoal
- Mentoria especializada
- Relatórios de progresso detalhados

Acesse a plataforma: ${data.frontendUrl}/login

Atenciosamente,
Equipe AdvanceMais
    `.trim();
  }

  /**
   * Gera template de texto simples para recuperação de senha
   * @param data - Dados para o template
   * @returns String de texto simples
   */
  public static gerarTextoRecuperacaoSenha(
    data: PasswordRecoveryTemplateData
  ): string {
    return `
Recuperação de Senha - AdvanceMais

Olá, ${data.nomeCompleto}!

Para recuperar sua senha, acesse o link: ${data.linkRecuperacao}

Ou use o código: ${data.token}

IMPORTANTE:
- Válido por ${data.expiracaoMinutos} minutos
- Máximo ${data.maxTentativas} tentativas por hora
- Se não solicitou, ignore este email

Atenciosamente,
Equipe de Segurança AdvanceMais
    `.trim();
  }

  /**
   * Template de fallback para boas-vindas (caso o arquivo não seja encontrado)
   * @param data - Dados para o template
   * @returns Template HTML simples
   */
  private static getFallbackWelcomeTemplate(data: WelcomeTemplateData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bem-vindo ao AdvanceMais</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
          <h1>🎉 Bem-vindo ao AdvanceMais!</h1>
        </div>
        <div style="padding: 20px;">
          <h2>Olá, ${data.nomeCompleto}!</h2>
          <p>Sua conta como <strong>${data.tipoUsuario}</strong> foi criada com sucesso!</p>
          <p style="text-align: center;">
            <a href="${data.frontendUrl}/login" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Acessar Plataforma
            </a>
          </p>
          <p>Atenciosamente,<br>Equipe AdvanceMais</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de fallback para recuperação de senha
   * @param data - Dados para o template
   * @returns Template HTML simples
   */
  private static getFallbackPasswordRecoveryTemplate(
    data: PasswordRecoveryTemplateData
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Recuperação de Senha</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ff9800; color: white; padding: 20px; text-align: center;">
          <h1>🔐 Recuperação de Senha</h1>
        </div>
        <div style="padding: 20px;">
          <h2>Olá, ${data.nomeCompleto}!</h2>
          <p>Para recuperar sua senha, clique no botão abaixo:</p>
          <p style="text-align: center;">
            <a href="${data.linkRecuperacao}" style="background-color: #ff9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Redefinir Senha
            </a>
          </p>
          <p>Ou use o código: <strong>${data.token}</strong></p>
          <p><small>Válido por ${data.expiracaoMinutos} minutos.</small></p>
          <p>Atenciosamente,<br>Equipe AdvanceMais</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Limpa o cache de templates (útil em desenvolvimento)
   */
  public static clearCache(): void {
    this.templateCache.clear();
  }
}
