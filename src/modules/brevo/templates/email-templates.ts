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

export interface PlanEmailDataBase {
  nomeCompleto: string;
  planName: string;
  vagas?: number | null;
  supportUrl?: string;
}

export interface EstagioConvocacaoLocalEmailData {
  empresaNome: string;
  endereco?: string | null;
  horarios?: string | null;
  diasSemana?: string[];
  pontoReferencia?: string | null;
  observacoes?: string | null;
}

export interface EstagioConvocacaoEmailData {
  nomeCompleto: string;
  cursoNome: string;
  turmaNome: string;
  estagioNome: string;
  dataInicio: string;
  dataFim: string;
  confirmacaoUrl: string;
  obrigatorio: boolean;
  empresaPrincipal?: string | null;
  cargaHoraria?: number | null;
  observacoes?: string | null;
  locais: EstagioConvocacaoLocalEmailData[];
}

export interface EstagioEncerramentoEmailData {
  adminNome: string;
  alunoNome: string;
  cursoNome: string;
  turmaNome: string;
  estagioNome: string;
  dataFim: string;
  diasRestantes: number;
  observacoes?: string | null;
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
    data: AccountConfirmationEmailData,
  ): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
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
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
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
            <a href="${data.verificationUrl}" class="fallback-link">${data.verificationUrl}</a>
          </div>
        </div>
        
        <div class="info-box">
          <p class="info-text">
            <strong>Importante:</strong> Este link expira em ${data.expirationHours ?? 72} horas.
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
  public static generatePasswordRecoveryEmail(data: PasswordRecoveryData): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
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
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
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
            <a href="${data.linkRecuperacao}" class="fallback-link">${data.linkRecuperacao}</a>
          </div>
        </div>
        
        <div class="info-box">
          <p class="info-text">
            <strong>Este link expira em ${
              data.expiracaoHoras
            } horas</strong> por motivos de segurança.
          </p>
          <p class="info-text">
            Você pode realizar até ${data.maxTentativas} tentativas de recuperação.
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
  public static generateVerificationEmail(data: AccountConfirmationEmailData): EmailTemplate {
    return this.generateAccountConfirmationEmail(data);
  }

  public static generateWelcomeEmail(data: AccountConfirmationEmailData): EmailTemplate {
    return this.generateAccountConfirmationEmail(data);
  }

  // ========= Assinaturas / Planos =========

  public static generatePlanActivatedEmail(data: PlanEmailDataBase): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
    const currentYear = this.getCurrentYear();
    const vagasText = typeof data.vagas === 'number' ? `${data.vagas} vagas` : 'vagas';

    const subject = `Seu acesso ${data.planName} foi liberado.`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assinatura Ativada - Advance+</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
        </div>
      </div>
      <div class="content">
        <div class="greeting">Bem-vindo(a), ${firstName}!</div>
        <div class="message">
          É um prazer ter você com a gente. Seu plano <strong>${data.planName}</strong> foi ativado.
        </div>
        <div class="info-box">
          <p class="info-text">
            O <strong>${data.planName}</strong> oferece a você <strong>${vagasText} por mês</strong> em nosso site. Tenha o
            controle de novas solicitações de candidatos, conheça os perfis e aumente suas chances de match!
          </p>
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">Advance+ © ${currentYear} todos os direitos reservados.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    const text = `Bem-vindo(a), ${firstName}!

É um prazer ter você com a gente. Seu plano ${data.planName} foi ativado.

O ${data.planName} oferece a você ${vagasText} por mês em nosso site. Tenha o controle de novas solicitações de candidatos, conheça os perfis e aumente suas chances de match!

© ${currentYear} Advance+ - Todos os direitos reservados`;

    return { subject, html, text };
  }

  public static generatePlanPaymentRejectedEmail(data: PlanEmailDataBase): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
    const currentYear = this.getCurrentYear();
    const subject = `Pagamento recusado para o plano ${data.planName}`;
    const link = data.supportUrl ?? '#';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento Recusado - Advance+</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
        </div>
      </div>
      <div class="content">
        <div class="greeting">Olá, ${firstName}!</div>
        <div class="message">
          Não foi possível concluir a compra do seu plano <strong>${data.planName}</strong>. O pagamento foi recusado.
        </div>
        <div class="fallback-section">
          <div class="fallback-title">Que tal tentar novamente?</div>
          <div>Você pode atualizar seus dados de pagamento e refazer a tentativa no link abaixo:</div>
          <div style="margin-top: 8px;">
            <a href="${link}" class="fallback-link">${link}</a>
          </div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">Advance+ © ${currentYear} todos os direitos reservados.</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Olá, ${firstName}!

Não foi possível concluir a compra do seu plano ${data.planName}. O pagamento foi recusado.
Atualize seus dados ou tente novamente: ${link}

© ${currentYear} Advance+ - Todos os direitos reservados`;
    return { subject, html, text };
  }

  public static generatePlanUpgradedEmail(data: PlanEmailDataBase): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
    const currentYear = this.getCurrentYear();
    const vagasText = typeof data.vagas === 'number' ? `${data.vagas} vagas` : 'vagas';
    const subject = `Seu plano foi atualizado para ${data.planName}`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plano Atualizado - Advance+</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
        </div>
      </div>
      <div class="content">
        <div class="greeting">Olá, ${firstName}!</div>
        <div class="message">
          Seu plano foi atualizado para <strong>${data.planName}</strong>.
        </div>
        <div class="info-box">
          <p class="info-text">Agora você conta com <strong>${vagasText} por mês</strong> para publicar e gerenciar no site.</p>
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">Advance+ © ${currentYear} todos os direitos reservados.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    const text = `Olá, ${firstName}!

Seu plano foi atualizado para ${data.planName}.
Agora você conta com ${vagasText} por mês para publicar e gerenciar no site.

© ${currentYear} Advance+ - Todos os direitos reservados`;
    return { subject, html, text };
  }

  // ========= Cursos - Estágios =========

  public static generateEstagioConvocacaoEmail(data: EstagioConvocacaoEmailData): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
    const currentYear = this.getCurrentYear();
    const obrigatorioText = data.obrigatorio ? 'Sim' : 'Não';
    const cargaHorariaText = typeof data.cargaHoraria === 'number' ? `${data.cargaHoraria} horas` : 'A combinar';

    const locaisHtml = data.locais.length
      ? data.locais
          .map((local) => {
            const dias = local.diasSemana && local.diasSemana.length > 0 ? local.diasSemana.join(', ') : null;
            return `
        <div class="info-box">
          <p class="info-text"><strong>${local.empresaNome}</strong></p>
          ${local.endereco ? `<p class="info-text">${local.endereco}</p>` : ''}
          ${local.horarios ? `<p class="info-text">Horário: ${local.horarios}</p>` : ''}
          ${dias ? `<p class="info-text">Dias: ${dias}</p>` : ''}
          ${local.pontoReferencia ? `<p class="info-text">Referência: ${local.pontoReferencia}</p>` : ''}
          ${local.observacoes ? `<p class="info-text">Observações: ${local.observacoes}</p>` : ''}
        </div>`;
          })
          .join('\n')
      : `
      <div class="info-box">
        <p class="info-text">Os detalhes do local serão alinhados com você em breve.</p>
      </div>`;

    const subject = `Confirmação de estágio • ${data.estagioNome}`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de estágio</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
        </div>
      </div>
      <div class="content">
        <div class="greeting">Olá, ${firstName}!</div>
        <div class="message">
          Seu estágio <strong>${data.estagioNome}</strong> referente ao curso <strong>${data.cursoNome}</strong> (turma ${data.turmaNome}) foi cadastrado.
          Para iniciarmos o processo, confirme que está ciente das informações abaixo.
        </div>
        <div class="info-box">
          <p class="info-text"><strong>Período:</strong> ${data.dataInicio} até ${data.dataFim}</p>
          <p class="info-text"><strong>Carga horária prevista:</strong> ${cargaHorariaText}</p>
          <p class="info-text"><strong>Estágio obrigatório?</strong> ${obrigatorioText}</p>
          ${data.empresaPrincipal ? `<p class="info-text"><strong>Empresa responsável:</strong> ${data.empresaPrincipal}</p>` : ''}
        </div>
        ${locaisHtml}
        ${data.observacoes ? `<div class="warning-box"><div class="warning-title">Observações importantes</div><p class="warning-text">${data.observacoes}</p></div>` : ''}
        <a href="${data.confirmacaoUrl}" class="cta-button">Confirmar ciência do estágio</a>
        <div class="fallback-section">
          <div class="fallback-title">Não consegue clicar?</div>
          <div class="fallback-link">${data.confirmacaoUrl}</div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">Advance+ © ${currentYear} todos os direitos reservados.</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const locaisText = data.locais.length
      ? data.locais
          .map((local, index) => {
            const linhas: string[] = [`${index + 1}. ${local.empresaNome}`];
            if (local.endereco) linhas.push(`Endereço: ${local.endereco}`);
            if (local.horarios) linhas.push(`Horários: ${local.horarios}`);
            if (local.diasSemana && local.diasSemana.length > 0)
              linhas.push(`Dias: ${local.diasSemana.join(', ')}`);
            if (local.pontoReferencia) linhas.push(`Referência: ${local.pontoReferencia}`);
            if (local.observacoes) linhas.push(`Observações: ${local.observacoes}`);
            return linhas.join('\n');
          })
          .join('\n\n')
      : 'Os detalhes de local serão compartilhados em breve.';

    const text = `Olá, ${firstName}!

Seu estágio ${data.estagioNome} referente ao curso ${data.cursoNome} (turma ${data.turmaNome}) foi cadastrado.
Período: ${data.dataInicio} até ${data.dataFim}
Carga horária prevista: ${cargaHorariaText}
Estágio obrigatório? ${obrigatorioText}
${data.empresaPrincipal ? `Empresa responsável: ${data.empresaPrincipal}
` : ''}

Locais do estágio:
${locaisText}

${data.observacoes ? `Observações: ${data.observacoes}

` : ''}Confirme sua ciência acessando: ${data.confirmacaoUrl}

© ${currentYear} Advance+ - Todos os direitos reservados`;

    return { subject, html, text };
  }

  public static generateEstagioEncerramentoEmail(data: EstagioEncerramentoEmailData): EmailTemplate {
    const currentYear = this.getCurrentYear();
    const subject = `Estágio ${data.estagioNome} se encerra em ${data.diasRestantes} dia(s)`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso de encerramento de estágio</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
        </div>
      </div>
      <div class="content">
        <div class="greeting">Olá, ${data.adminNome}!</div>
        <div class="message">
          O estágio <strong>${data.estagioNome}</strong> do aluno <strong>${data.alunoNome}</strong> (curso ${data.cursoNome} • turma ${data.turmaNome})
          está previsto para encerrar em <strong>${data.diasRestantes} dia(s)</strong>, no dia ${data.dataFim}.
        </div>
        <div class="info-box">
          <p class="info-text">Recomendamos validar as entregas e atualizar o status do estágio na plataforma.</p>
        </div>
        ${data.observacoes ? `<div class="warning-box"><div class="warning-title">Observações registradas</div><p class="warning-text">${data.observacoes}</p></div>` : ''}
      </div>
      <div class="footer">
        <div class="footer-text">Advance+ © ${currentYear} todos os direitos reservados.</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Olá, ${data.adminNome}!

O estágio ${data.estagioNome} do aluno ${data.alunoNome} (curso ${data.cursoNome} • turma ${data.turmaNome}) está previsto para encerrar em ${data.diasRestantes} dia(s), no dia ${data.dataFim}.
Revise as entregas e atualize o status na plataforma.
${data.observacoes ? `Observações: ${data.observacoes}
` : ''}

© ${currentYear} Advance+ - Todos os direitos reservados`;

    return { subject, html, text };
  }

  public static generatePlanDowngradedEmail(data: PlanEmailDataBase): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
    const currentYear = this.getCurrentYear();
    const vagasText = typeof data.vagas === 'number' ? `${data.vagas} vagas` : 'vagas';
    const subject = `Seu plano foi alterado para ${data.planName}`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plano Alterado - Advance+</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
        </div>
      </div>
      <div class="content">
        <div class="greeting">Olá, ${firstName}!</div>
        <div class="message">
          Seu plano foi alterado para <strong>${data.planName}</strong>.
        </div>
        <div class="warning-box">
          <div class="warning-title">Importante</div>
          <p class="warning-text">Todas as vagas da sua empresa foram movidas para rascunho conforme a política de downgrade.</p>
        </div>
        <div class="info-box">
          <p class="info-text">O <strong>${data.planName}</strong> oferece ${vagasText} por mês.</p>
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">Advance+ © ${currentYear} todos os direitos reservados.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    const text = `Olá, ${firstName}!

Seu plano foi alterado para ${data.planName}. Todas as vagas foram movidas para rascunho. O ${data.planName} oferece ${vagasText} por mês.

© ${currentYear} Advance+ - Todos os direitos reservados`;
    return { subject, html, text };
  }

  // ========= Bloqueios =========
  public static generateUserBlockedEmail(data: {
    nomeCompleto: string;
    motivo: string;
    fim?: Date | null;
  }): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
    const currentYear = this.getCurrentYear();
    const untilText = data.fim
      ? `até ${new Date(data.fim).toLocaleString('pt-BR')}`
      : 'por tempo indeterminado';
    const subject = `Sua conta foi bloqueada`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bloqueio - Advance+</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
        </div>
      </div>
      <div class="content">
        <div class="greeting">Olá, ${firstName}.</div>
        <div class="message">
          Informamos que sua conta foi <strong>bloqueada</strong> ${untilText}.
        </div>
        <div class="info-box">
          <p class="info-text"><strong>Motivo:</strong> ${data.motivo}</p>
          <p class="info-text">Caso acredite que foi um engano, responda este email com mais detalhes.</p>
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">Advance+ © ${currentYear} todos os direitos reservados.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    const text = `Olá, ${firstName}.

Informamos que sua conta foi bloqueada ${untilText}.
Motivo: ${data.motivo}.

Se acreditar que foi um engano, responda este email com mais detalhes.

© ${currentYear} Advance+ - Todos os direitos reservados`;
    return { subject, html, text };
  }

  public static generateUserUnblockedEmail(data: { nomeCompleto: string }): EmailTemplate {
    const firstName = data.nomeCompleto.split(' ')[0];
    const currentYear = this.getCurrentYear();
    const subject = `Bem-vindo(a) de volta!`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bloqueio Revogado - Advance+</title>
  ${this.getBaseStyles()}
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <img src="https://advancemais.com/images/logos/logo_branco.png" alt="Advance+" />
        </div>
      </div>
      <div class="content">
        <div class="greeting">Olá, ${firstName}!</div>
        <div class="message">
          Seu bloqueio foi <strong>revogado</strong>. Seu acesso foi restaurado.
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">Advance+ © ${currentYear} todos os direitos reservados.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    const text = `Olá, ${firstName}!

Seu bloqueio foi revogado. Seu acesso foi restaurado.

© ${currentYear} Advance+ - Todos os direitos reservados`;
    return { subject, html, text };
  }
}
