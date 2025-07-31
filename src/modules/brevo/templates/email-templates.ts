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
 * Interface para dados de templates customizados
 */
interface CustomTemplateData {
  nomeCompleto: string;
  titulo: string;
  conteudo: string;
  frontendUrl: string;
  ano: number;
  [key: string]: any; // Permite dados adicionais
}

/**
 * Classe responsável por gerar templates de email profissionais
 *
 * Funcionalidades principais:
 * - Templates HTML responsivos e modernos
 * - Cache inteligente de templates
 * - Substituição segura de variáveis
 * - Templates de fallback para robustez
 * - Suporte a templates customizados
 * - Validação de dados de entrada
 *
 * Templates disponíveis:
 * - Email de boas-vindas
 * - Recuperação de senha
 * - Notificações gerais
 * - Templates customizados
 *
 * @author Sistema AdvanceMais
 * @version 2.0.0
 */
export class EmailTemplates {
  private static templateCache = new Map<string, string>();
  private static readonly TEMPLATE_DIR = path.join(__dirname, "html");

  /**
   * Carrega template HTML do sistema de arquivos
   * Implementa cache para melhor performance
   *
   * @param {string} templateName - Nome do arquivo de template (sem extensão)
   * @returns {string} Conteúdo HTML do template
   * @throws {Error} Se o template não for encontrado
   */
  private static loadTemplate(templateName: string): string {
    // Verifica cache primeiro para melhor performance
    const cacheKey = `${templateName}.html`;
    if (this.templateCache.has(cacheKey)) {
      console.log(`📄 Template ${templateName} carregado do cache`);
      return this.templateCache.get(cacheKey)!;
    }

    try {
      const templatePath = path.join(this.TEMPLATE_DIR, `${templateName}.html`);

      // Verifica se o arquivo existe
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      const templateContent = fs.readFileSync(templatePath, "utf8");

      // Valida se o conteúdo não está vazio
      if (!templateContent.trim()) {
        throw new Error(`Template ${templateName} is empty`);
      }

      // Armazena no cache para próximas utilizações
      this.templateCache.set(cacheKey, templateContent);
      console.log(`📄 Template ${templateName} carregado e cacheado`);

      return templateContent;
    } catch (error) {
      console.error(`❌ Erro ao carregar template ${templateName}:`, error);
      throw new Error(`Template ${templateName} não encontrado ou inválido`);
    }
  }

  /**
   * Substitui variáveis no template de forma segura
   * Utiliza sintaxe {{variavel}} para substituições
   *
   * @param {string} template - Conteúdo do template
   * @param {Record<string, any>} variables - Variáveis para substituição
   * @returns {string} Template com variáveis substituídas
   */
  private static replaceVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    let result = template;
    let substituicoes = 0;

    // Substitui cada variável de forma segura
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      const valorString = this.sanitizeValue(value);

      // Conta quantas substituições foram feitas
      const matches = result.match(regex);
      if (matches) {
        substituicoes += matches.length;
        result = result.replace(regex, valorString);
      }
    });

    console.log(`🔄 ${substituicoes} variáveis substituídas no template`);

    // Avisa sobre variáveis não substituídas (para debugging)
    const variaveisNaoSubstituidas = result.match(/{{[\w\s]+}}/g);
    if (variaveisNaoSubstituidas) {
      console.warn(
        "⚠️ Variáveis não substituídas encontradas:",
        variaveisNaoSubstituidas
      );
    }

    return result;
  }

  /**
   * Sanitiza valores para uso seguro em HTML
   * Previne XSS e garante formatação adequada
   *
   * @param {any} value - Valor a ser sanitizado
   * @returns {string} Valor sanitizado e formatado
   */
  private static sanitizeValue(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }

    let stringValue = String(value);

    // Escape de caracteres HTML para segurança
    stringValue = stringValue
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    return stringValue;
  }

  /**
   * Valida dados obrigatórios para templates
   *
   * @param {Record<string, any>} data - Dados para validação
   * @param {string[]} requiredFields - Campos obrigatórios
   * @returns {boolean} true se todos os campos obrigatórios estão presentes
   */
  private static validateTemplateData(
    data: Record<string, any>,
    requiredFields: string[]
  ): boolean {
    for (const field of requiredFields) {
      if (
        !data[field] ||
        (typeof data[field] === "string" && data[field].trim() === "")
      ) {
        console.error(`❌ Campo obrigatório ausente no template: ${field}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Gera template HTML para email de boas-vindas
   * Template responsivo com design moderno e profissional
   *
   * @param {WelcomeTemplateData} data - Dados para personalização
   * @returns {string} Template HTML completo
   */
  public static gerarTemplateBoasVindas(data: WelcomeTemplateData): string {
    try {
      console.log(
        `🎉 Gerando template de boas-vindas para: ${data.nomeCompleto}`
      );

      // Valida dados obrigatórios
      if (
        !this.validateTemplateData(data, [
          "nomeCompleto",
          "tipoUsuario",
          "frontendUrl",
        ])
      ) {
        return this.getFallbackWelcomeTemplate(data);
      }

      // Carrega template principal
      const template = this.loadTemplate("welcome-email");

      // Adiciona dados computados
      const templateData = {
        ...data,
        ano: data.ano || new Date().getFullYear(),
        primeiroNome: data.nomeCompleto.split(" ")[0],
        dataAtual: new Date().toLocaleDateString("pt-BR"),
      };

      return this.replaceVariables(template, templateData);
    } catch (error) {
      console.error("❌ Erro ao gerar template de boas-vindas:", error);
      // Retorna template de fallback em caso de erro
      return this.getFallbackWelcomeTemplate(data);
    }
  }

  /**
   * Gera template HTML para recuperação de senha
   * Inclui elementos de segurança e instruções claras
   *
   * @param {PasswordRecoveryTemplateData} data - Dados para personalização
   * @returns {string} Template HTML completo
   */
  public static gerarTemplateRecuperacaoSenha(
    data: PasswordRecoveryTemplateData
  ): string {
    try {
      console.log(
        `🔐 Gerando template de recuperação de senha para: ${data.nomeCompleto}`
      );

      // Valida dados obrigatórios
      if (
        !this.validateTemplateData(data, [
          "nomeCompleto",
          "linkRecuperacao",
          "token",
        ])
      ) {
        return this.getFallbackPasswordRecoveryTemplate(data);
      }

      // Carrega template principal
      const template = this.loadTemplate("password-recovery-email");

      // Adiciona dados computados
      const templateData = {
        ...data,
        ano: data.ano || new Date().getFullYear(),
        primeiroNome: data.nomeCompleto.split(" ")[0],
        dataAtual: new Date().toLocaleDateString("pt-BR"),
        horaAtual: new Date().toLocaleTimeString("pt-BR"),
        // Mascara parcialmente o token para segurança no log
        tokenMascarado:
          data.token.substring(0, 4) + "*".repeat(data.token.length - 4),
      };

      return this.replaceVariables(template, templateData);
    } catch (error) {
      console.error("❌ Erro ao gerar template de recuperação:", error);
      // Retorna template de fallback em caso de erro
      return this.getFallbackPasswordRecoveryTemplate(data);
    }
  }

  /**
   * Gera template de texto simples para boas-vindas
   * Versão alternativa para clientes que não suportam HTML
   *
   * @param {WelcomeTemplateData} data - Dados para personalização
   * @returns {string} Conteúdo em texto simples
   */
  public static gerarTextoBoasVindas(data: WelcomeTemplateData): string {
    const primeiroNome = data.nomeCompleto.split(" ")[0];

    return `
Bem-vindo ao AdvanceMais, ${data.nomeCompleto}!

Olá ${primeiroNome},

É com grande satisfação que te damos as boas-vindas ao AdvanceMais!

Sua conta como ${data.tipoUsuario} foi criada com sucesso e você já pode começar a explorar nossa plataforma de desenvolvimento profissional.

Na AdvanceMais você terá acesso a:
• Cursos especializados e certificações
• Oportunidades exclusivas de carreira  
• Networking com profissionais da área
• Ferramentas de desenvolvimento pessoal
• Mentoria especializada
• Relatórios de progresso detalhados

Para começar, acesse: ${data.frontendUrl}/login

Se você tiver alguma dúvida ou precisar de ajuda, nossa equipe de suporte está sempre disponível.

Mais uma vez, seja muito bem-vindo(a) à nossa comunidade!

Atenciosamente,
Equipe AdvanceMais

--
© ${data.ano} AdvanceMais. Todos os direitos reservados.
Este é um email automático, por favor não responda.
    `.trim();
  }

  /**
   * Gera template de texto simples para recuperação de senha
   *
   * @param {PasswordRecoveryTemplateData} data - Dados para personalização
   * @returns {string} Conteúdo em texto simples
   */
  public static gerarTextoRecuperacaoSenha(
    data: PasswordRecoveryTemplateData
  ): string {
    const primeiroNome = data.nomeCompleto.split(" ")[0];

    return `
Recuperação de Senha - AdvanceMais

Olá, ${primeiroNome}!

Recebemos uma solicitação para recuperar a senha da sua conta no AdvanceMais.

Para redefinir sua senha, acesse o link: ${data.linkRecuperacao}

Ou use o código: ${data.token}

IMPORTANTE:
• Válido por ${data.expiracaoMinutos} minutos
• Máximo ${data.maxTentativas} tentativas por hora
• Se você não solicitou esta recuperação, ignore este email
• Por segurança, nunca compartilhe este código

Se você não conseguir acessar o link ou tiver problemas, entre em contato com nosso suporte.

Atenciosamente,
Equipe de Segurança AdvanceMais

--
© ${data.ano} AdvanceMais. Todos os direitos reservados.
Este é um email automático, por favor não responda.
    `.trim();
  }

  /**
   * Gera template customizado baseado em dados fornecidos
   * Útil para notificações gerais e comunicações específicas
   *
   * @param {CustomTemplateData} data - Dados customizados
   * @returns {string} Template HTML personalizado
   */
  public static gerarTemplateCustomizado(data: CustomTemplateData): string {
    try {
      console.log(`🎨 Gerando template customizado: ${data.titulo}`);

      const template = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{{titulo}} - AdvanceMais</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4caf50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
            .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background-color: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>{{titulo}}</h1>
          </div>
          <div class="content">
            <p>Olá, {{nomeCompleto}}!</p>
            <div>{{conteudo}}</div>
            <p><a href="{{frontendUrl}}" class="button">Acessar AdvanceMais</a></p>
            <p>Atenciosamente,<br>Equipe AdvanceMais</p>
          </div>
          <div class="footer">
            <p>&copy; {{ano}} AdvanceMais. Todos os direitos reservados.</p>
          </div>
        </body>
        </html>
      `;

      return this.replaceVariables(template, {
        ...data,
        ano: data.ano || new Date().getFullYear(),
      });
    } catch (error) {
      console.error("❌ Erro ao gerar template customizado:", error);
      return this.gerarTemplateFallbackSimples(
        data.nomeCompleto,
        data.titulo,
        data.conteudo
      );
    }
  }

  /**
   * Template de fallback para boas-vindas
   * Usado quando o template principal não pode ser carregado
   *
   * @param {WelcomeTemplateData} data - Dados para o template
   * @returns {string} Template HTML simples e funcional
   */
  private static getFallbackWelcomeTemplate(data: WelcomeTemplateData): string {
    console.log("⚠️ Usando template de fallback para boas-vindas");

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao AdvanceMais</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
          .container { background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: #4CAF50; color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Bem-vindo ao AdvanceMais!</h1>
          </div>
          <div class="content">
            <h2>Olá, ${this.sanitizeValue(data.nomeCompleto)}!</h2>
            <p>Sua conta como <strong>${this.sanitizeValue(
              data.tipoUsuario
            )}</strong> foi criada com sucesso!</p>
            <p>Comece a explorar nossa plataforma agora mesmo:</p>
            <p style="text-align: center;">
              <a href="${this.sanitizeValue(
                data.frontendUrl
              )}/login" class="button">
                🚀 Acessar Plataforma
              </a>
            </p>
            <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${
              data.ano || new Date().getFullYear()
            } AdvanceMais. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de fallback para recuperação de senha
   *
   * @param {PasswordRecoveryTemplateData} data - Dados para o template
   * @returns {string} Template HTML simples e funcional
   */
  private static getFallbackPasswordRecoveryTemplate(
    data: PasswordRecoveryTemplateData
  ): string {
    console.log("⚠️ Usando template de fallback para recuperação de senha");

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperação de Senha</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
          .container { background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: #ff9800; color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .button { display: inline-block; background-color: #ff9800; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
          .token { background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 18px; text-align: center; margin: 15px 0; font-weight: bold; }
          .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Recuperação de Senha</h1>
          </div>
          <div class="content">
            <h2>Olá, ${this.sanitizeValue(data.nomeCompleto)}!</h2>
            <p>Para recuperar sua senha, clique no botão abaixo:</p>
            <p style="text-align: center;">
              <a href="${this.sanitizeValue(
                data.linkRecuperacao
              )}" class="button">
                🔑 Redefinir Senha
              </a>
            </p>
            <p>Ou use o código:</p>
            <div class="token">${this.sanitizeValue(data.token)}</div>
            <div class="warning">
              <p><strong>⚠️ Importante:</strong></p>
              <ul>
                <li>Válido por ${data.expiracaoMinutos} minutos</li>
                <li>Máximo ${data.maxTentativas} tentativas por hora</li>
                <li>Se não solicitou, ignore este email</li>
              </ul>
            </div>
            <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${
              data.ano || new Date().getFullYear()
            } AdvanceMais. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Gera template fallback simples para casos extremos
   *
   * @param {string} nome - Nome do destinatário
   * @param {string} titulo - Título da mensagem
   * @param {string} conteudo - Conteúdo da mensagem
   * @returns {string} Template HTML mínimo
   */
  private static gerarTemplateFallbackSimples(
    nome: string,
    titulo: string,
    conteudo: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${this.sanitizeValue(titulo)} - AdvanceMais</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>${this.sanitizeValue(titulo)}</h1>
        <p>Olá, ${this.sanitizeValue(nome)}!</p>
        <div>${this.sanitizeValue(conteudo)}</div>
        <p>Atenciosamente,<br>Equipe AdvanceMais</p>
        <hr>
        <p style="font-size: 12px; color: #666;">&copy; ${new Date().getFullYear()} AdvanceMais. Todos os direitos reservados.</p>
      </body>
      </html>
    `;
  }

  /**
   * Limpa o cache de templates
   * Útil em desenvolvimento ou quando templates são atualizados
   */
  public static clearCache(): void {
    const cacheSize = this.templateCache.size;
    this.templateCache.clear();
    console.log(
      `🗑️ Cache de templates limpo (${cacheSize} templates removidos)`
    );
  }

  /**
   * Lista templates em cache para debug
   *
   * @returns {string[]} Lista de templates em cache
   */
  public static getCachedTemplates(): string[] {
    return Array.from(this.templateCache.keys());
  }

  /**
   * Pré-carrega todos os templates disponíveis
   * Útil para aquecimento de cache na inicialização
   */
  public static preloadTemplates(): void {
    try {
      console.log("🔄 Pré-carregando templates...");

      const templates = ["welcome-email", "password-recovery-email"];
      let loaded = 0;

      templates.forEach((templateName) => {
        try {
          this.loadTemplate(templateName);
          loaded++;
        } catch (error) {
          console.warn(
            `⚠️ Não foi possível pré-carregar template: ${templateName}`
          );
        }
      });

      console.log(`✅ ${loaded}/${templates.length} templates pré-carregados`);
    } catch (error) {
      console.error("❌ Erro no pré-carregamento de templates:", error);
    }
  }
}
