import { BrevoClient } from '@/modules/brevo/client/brevo-client';
import { BrevoConfigManager } from '@/modules/brevo/config/brevo-config';
import { EmailTemplates } from '@/modules/brevo/templates';
import { logger } from '@/utils/logger';

const emailLogger = logger.child({ module: 'CursosEstagiosEmailService' });

const formatDate = (value: Date | string) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date);
};

const buildConfirmacaoUrl = (token: string) => {
  const config = BrevoConfigManager.getInstance().getConfig();
  const baseUrl = config.urls.frontend.replace(/\/$/, '');
  const confirmPath = process.env.FRONTEND_ESTAGIO_CONFIRM_PATH || '/estagios/confirmacao';
  return `${baseUrl}${confirmPath}?token=${token}`;
};

type EstagioLocalEmailInput = {
  empresaNome: string;
  endereco?: string | null;
  horarios?: string | null;
  diasSemana?: string[];
  pontoReferencia?: string | null;
  observacoes?: string | null;
};

type EstagioConvocacaoEmailInput = {
  alunoEmail: string;
  alunoNome: string;
  cursoNome: string;
  turmaNome: string;
  estagioNome: string;
  dataInicio: Date | string;
  dataFim: Date | string;
  obrigatorio: boolean;
  confirmacaoToken: string;
  empresaPrincipal?: string | null;
  cargaHoraria?: number | null;
  observacoes?: string | null;
  locais: EstagioLocalEmailInput[];
  destinatarioAlternativo?: string;
};

type EstagioAvisoEncerramentoInput = {
  adminEmail: string;
  adminNome?: string | null;
  alunoNome: string;
  cursoNome: string;
  turmaNome: string;
  estagioNome: string;
  dataFim: Date | string;
  diasRestantes: number;
  observacoes?: string | null;
};

const brevoClient = BrevoClient.getInstance();

export const estagiosEmailService = {
  async enviarConvocacao(data: EstagioConvocacaoEmailInput) {
    const confirmacaoUrl = buildConfirmacaoUrl(data.confirmacaoToken);
    const destinatario = data.destinatarioAlternativo ?? data.alunoEmail;
    const locais = data.locais.map((local) => ({
      empresaNome: local.empresaNome,
      endereco: local.endereco ?? null,
      horarios: local.horarios ?? null,
      diasSemana: local.diasSemana ?? [],
      pontoReferencia: local.pontoReferencia ?? null,
      observacoes: local.observacoes ?? null,
    }));

    const emailContent = EmailTemplates.generateEstagioConvocacaoEmail({
      nomeCompleto: data.alunoNome,
      cursoNome: data.cursoNome,
      turmaNome: data.turmaNome,
      estagioNome: data.estagioNome,
      dataInicio: formatDate(data.dataInicio),
      dataFim: formatDate(data.dataFim),
      confirmacaoUrl,
      obrigatorio: data.obrigatorio,
      empresaPrincipal: data.empresaPrincipal ?? null,
      cargaHoraria: data.cargaHoraria ?? null,
      observacoes: data.observacoes ?? null,
      locais,
    });

    emailLogger.info({ destinatario, estagio: data.estagioNome }, 'Enviando email de convocação de estágio');

    const result = await brevoClient.sendEmail({
      to: destinatario,
      toName: data.alunoNome,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!result.success) {
      emailLogger.warn({ destinatario, estagio: data.estagioNome }, 'Falha ao enviar email de estágio');
    }

    return { result, confirmacaoUrl };
  },

  async enviarAvisoEncerramento(data: EstagioAvisoEncerramentoInput) {
    const emailContent = EmailTemplates.generateEstagioEncerramentoEmail({
      adminNome: data.adminNome ?? data.adminEmail,
      alunoNome: data.alunoNome,
      cursoNome: data.cursoNome,
      turmaNome: data.turmaNome,
      estagioNome: data.estagioNome,
      dataFim: formatDate(data.dataFim),
      diasRestantes: data.diasRestantes,
      observacoes: data.observacoes ?? null,
    });

    emailLogger.info({ destinatario: data.adminEmail, estagio: data.estagioNome }, 'Enviando aviso de encerramento de estágio');

    return brevoClient.sendEmail({
      to: data.adminEmail,
      toName: data.adminNome ?? data.adminEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  },
};
