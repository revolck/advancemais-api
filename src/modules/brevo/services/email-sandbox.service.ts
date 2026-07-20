import bcrypt from 'bcrypt';
import { AuditoriaCategoria, Roles } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AuditoriaService } from '@/modules/auditoria/services/auditoria.service';
import { logger } from '@/utils/logger';
import { BrevoConfigManager } from '../config/brevo-config';
import {
  EmailTemplates,
  type CoursePaymentEmailStatus,
  type EmailTemplate,
} from '../templates/email-templates';
import { EmailService } from './email-service';

export type SandboxEmailRotina =
  | 'NOVO_CADASTRO'
  | 'RECUPERACAO_SENHA'
  | 'CREDENCIAIS_EMPRESA_ADMIN'
  | 'PLANO_ATIVADO'
  | 'PLANO_PAGAMENTO_RECUSADO'
  | 'PLANO_UPGRADE'
  | 'PLANO_DOWNGRADE'
  | 'CURSO_PAGAMENTO_PENDENTE'
  | 'CURSO_PAGAMENTO_PROCESSANDO'
  | 'CURSO_PAGAMENTO_APROVADO'
  | 'CURSO_PAGAMENTO_RECUSADO'
  | 'CURSO_PAGAMENTO_CANCELADO'
  | 'CURSO_PAGAMENTO_ESTORNADO'
  | 'CURSO_PAGAMENTO_CONTESTADO'
  | 'ESTAGIO_CONVOCACAO'
  | 'ESTAGIO_ENCERRAMENTO'
  | 'USUARIO_BLOQUEADO'
  | 'USUARIO_DESBLOQUEADO';

export interface SandboxEmailRotinaCatalogItem {
  value: SandboxEmailRotina;
  label: string;
  group: string;
  description?: string;
}

export interface SendSandboxEmailPayload {
  rotina?: string;
  destinatarioEmail?: string;
  senha?: string;
}

export interface SendSandboxEmailResult {
  rotina: SandboxEmailRotina;
  recipient: string;
  simulated?: boolean;
  messageId?: string;
}

const SANDBOX_EMAIL_ROTINAS: SandboxEmailRotinaCatalogItem[] = [
  {
    value: 'NOVO_CADASTRO',
    label: 'Novo cadastro / confirmação de conta',
    group: 'Usuários',
  },
  {
    value: 'RECUPERACAO_SENHA',
    label: 'Recuperação de senha',
    group: 'Usuários',
  },
  {
    value: 'CREDENCIAIS_EMPRESA_ADMIN',
    label: 'Credenciais de empresa',
    group: 'Empresas',
  },
  { value: 'PLANO_ATIVADO', label: 'Plano ativado', group: 'Planos' },
  {
    value: 'PLANO_PAGAMENTO_RECUSADO',
    label: 'Pagamento de plano recusado',
    group: 'Planos',
  },
  { value: 'PLANO_UPGRADE', label: 'Upgrade de plano', group: 'Planos' },
  { value: 'PLANO_DOWNGRADE', label: 'Downgrade de plano', group: 'Planos' },
  {
    value: 'CURSO_PAGAMENTO_PENDENTE',
    label: 'Curso - pagamento pendente',
    group: 'Cursos',
  },
  {
    value: 'CURSO_PAGAMENTO_PROCESSANDO',
    label: 'Curso - pagamento processando',
    group: 'Cursos',
  },
  {
    value: 'CURSO_PAGAMENTO_APROVADO',
    label: 'Curso - pagamento aprovado',
    group: 'Cursos',
  },
  {
    value: 'CURSO_PAGAMENTO_RECUSADO',
    label: 'Curso - pagamento recusado',
    group: 'Cursos',
  },
  {
    value: 'CURSO_PAGAMENTO_CANCELADO',
    label: 'Curso - pagamento cancelado',
    group: 'Cursos',
  },
  {
    value: 'CURSO_PAGAMENTO_ESTORNADO',
    label: 'Curso - pagamento estornado',
    group: 'Cursos',
  },
  {
    value: 'CURSO_PAGAMENTO_CONTESTADO',
    label: 'Curso - pagamento contestado',
    group: 'Cursos',
  },
  {
    value: 'ESTAGIO_CONVOCACAO',
    label: 'Convocação/confirmação de estágio',
    group: 'Estágios',
  },
  {
    value: 'ESTAGIO_ENCERRAMENTO',
    label: 'Aviso de encerramento de estágio',
    group: 'Estágios',
  },
  { value: 'USUARIO_BLOQUEADO', label: 'Usuário bloqueado', group: 'Bloqueios' },
  {
    value: 'USUARIO_DESBLOQUEADO',
    label: 'Usuário desbloqueado',
    group: 'Bloqueios',
  },
];

const ROUTINE_SET = new Set<SandboxEmailRotina>(SANDBOX_EMAIL_ROTINAS.map((item) => item.value));

function createHttpError(message: string, code: string, statusCode: number) {
  return Object.assign(new Error(message), { code, statusCode });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRotina(value?: string): SandboxEmailRotina {
  const normalized = String(value || '')
    .trim()
    .toUpperCase() as SandboxEmailRotina;
  if (!ROUTINE_SET.has(normalized)) {
    throw createHttpError('Rotina de sandbox inválida', 'INVALID_SANDBOX_ROUTINE', 400);
  }
  return normalized;
}

function courseStatusFromRotina(rotina: SandboxEmailRotina): CoursePaymentEmailStatus {
  return rotina.replace('CURSO_PAGAMENTO_', '') as CoursePaymentEmailStatus;
}

export class EmailSandboxService {
  private readonly emailService = new EmailService();
  private readonly config = BrevoConfigManager.getInstance();
  private readonly auditoriaService = new AuditoriaService();
  private readonly log = logger.child({ module: 'EmailSandboxService' });

  listRotinas(): SandboxEmailRotinaCatalogItem[] {
    return SANDBOX_EMAIL_ROTINAS;
  }

  async sendSandboxEmail(
    actorId: string | undefined,
    payload: SendSandboxEmailPayload,
    context?: { ip?: string; userAgent?: string },
  ): Promise<SendSandboxEmailResult> {
    if (!actorId) {
      throw createHttpError('Usuário autenticado não encontrado', 'AUTH_USER_REQUIRED', 401);
    }

    const rotina = normalizeRotina(payload.rotina);
    const recipient = String(payload.destinatarioEmail || '')
      .trim()
      .toLowerCase();
    const senha = String(payload.senha || '');

    if (!recipient) {
      throw createHttpError('Email é obrigatório', 'MISSING_EMAIL', 400);
    }

    if (!isValidEmail(recipient)) {
      throw createHttpError('Formato de email inválido', 'INVALID_EMAIL', 400);
    }

    if (!senha) {
      throw createHttpError('Senha é obrigatória', 'MISSING_PASSWORD', 400);
    }

    const actor = await prisma.usuarios.findUnique({
      where: { id: actorId },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        senha: true,
      },
    });

    if (!actor) {
      throw createHttpError('Usuário não encontrado', 'USER_NOT_FOUND', 404);
    }

    if (actor.role !== Roles.ADMIN) {
      throw createHttpError(
        'Acesso negado: permissões insuficientes',
        'INSUFFICIENT_PERMISSIONS',
        403,
      );
    }

    const passwordMatches = await bcrypt.compare(senha, actor.senha);
    if (!passwordMatches) {
      await this.recordAudit({
        actorId,
        rotina,
        recipient,
        status: 'FALHA',
        error: 'INVALID_PASSWORD',
        context,
      });
      throw createHttpError('Senha inválida', 'INVALID_PASSWORD', 403);
    }

    const template = await this.renderTemplate(rotina, recipient);
    const result = await this.emailService.sendGeneric(
      recipient,
      'Destinatário Sandbox',
      template.subject,
      template.html,
      template.text,
    );

    if (!result.success) {
      await this.recordAudit({
        actorId,
        rotina,
        recipient,
        status: 'FALHA',
        simulated: result.simulated,
        messageId: result.messageId,
        error: result.error || 'BREVO_DELIVERY_FAILED',
        context,
      });
      throw createHttpError(
        result.error || 'Não foi possível enviar o email de sandbox',
        'BREVO_DELIVERY_FAILED',
        502,
      );
    }

    await this.recordAudit({
      actorId,
      rotina,
      recipient,
      status: 'ENVIADO',
      simulated: result.simulated,
      messageId: result.messageId,
      context,
    });

    return {
      rotina,
      recipient,
      simulated: result.simulated,
      messageId: result.messageId,
    };
  }

  private async renderTemplate(
    rotina: SandboxEmailRotina,
    recipient: string,
  ): Promise<EmailTemplate> {
    const runtimeConfig = await this.config.getRuntimeConfig();
    const frontendUrl = runtimeConfig.urls.frontend.replace(/\/$/, '');
    const verificationUrl = `${runtimeConfig.urls.verification}?token=sandbox-confirmacao-conta`;
    const recoveryUrl = `${runtimeConfig.urls.passwordRecovery}?tp=sandbox-recuperacao-senha&ep=${encodeURIComponent(
      recipient,
    )}`;
    const nomeCompleto = 'Usuário Sandbox';
    const planData = {
      nomeCompleto,
      planName: 'Plano Profissional Sandbox',
      vagas: 25,
      supportUrl: `${frontendUrl}/dashboard/financeiro`,
    };

    if (rotina.startsWith('CURSO_PAGAMENTO_')) {
      return EmailTemplates.generateCoursePaymentStatusEmail({
        nomeCompleto,
        cursoNome: 'Curso Sandbox de Capacitação Profissional',
        turmaNome: 'Turma Sandbox 2026.2',
        status: courseStatusFromRotina(rotina),
        valorFormatado: 'R$ 249,90',
        metodoPagamento: 'PIX',
        expiraEmFormatada: '25/07/2026 23:59',
        paymentUrl: `${frontendUrl}/dashboard/cursos/pagamentos?tab=pendentes`,
        courseUrl: `${frontendUrl}/dashboard/cursos/alunos/cursos/curso-sandbox/turma-sandbox`,
      });
    }

    switch (rotina) {
      case 'NOVO_CADASTRO':
        return EmailTemplates.generateAccountConfirmationEmail({
          nomeCompleto,
          email: recipient,
          tipoUsuario: 'PESSOA_FISICA',
          verificationUrl,
          token: 'sandbox-confirmacao-conta',
          expirationHours: 72,
          frontendUrl,
        });
      case 'RECUPERACAO_SENHA':
        return EmailTemplates.generatePasswordRecoveryEmail({
          nomeCompleto,
          token: 'sandbox-recuperacao-senha',
          linkRecuperacao: recoveryUrl,
          expiracaoHoras: 72,
          maxTentativas: 3,
        });
      case 'CREDENCIAIS_EMPRESA_ADMIN':
        return EmailTemplates.generateAdminEmpresaCredentialsEmail({
          nomeCompleto: 'Empresa Sandbox',
          email: recipient,
          senha: 'SenhaTemporariaSandbox123!',
          loginUrl: `${frontendUrl}/login`,
          cnpj: '12345678000199',
        });
      case 'PLANO_ATIVADO':
        return EmailTemplates.generatePlanActivatedEmail(planData);
      case 'PLANO_PAGAMENTO_RECUSADO':
        return EmailTemplates.generatePlanPaymentRejectedEmail(planData);
      case 'PLANO_UPGRADE':
        return EmailTemplates.generatePlanUpgradedEmail(planData);
      case 'PLANO_DOWNGRADE':
        return EmailTemplates.generatePlanDowngradedEmail(planData);
      case 'ESTAGIO_CONVOCACAO':
        return EmailTemplates.generateEstagioConvocacaoEmail({
          nomeCompleto,
          cursoNome: 'Curso Sandbox de Enfermagem',
          turmaNome: 'Turma Sandbox Noturna',
          estagioNome: 'Estágio Supervisionado Sandbox',
          dataInicio: '01/08/2026',
          dataFim: '30/09/2026',
          confirmacaoUrl: `${frontendUrl}/dashboard/cursos/alunos/estagios`,
          obrigatorio: true,
          empresaPrincipal: 'Clínica Sandbox',
          cargaHoraria: 120,
          observacoes: 'Email gerado pelo sandbox de produção.',
          locais: [
            {
              empresaNome: 'Clínica Sandbox',
              endereco: 'Av. Exemplo, 100 - Maceió/AL',
              horarios: 'Segunda a sexta, 08:00 às 12:00',
              diasSemana: ['Segunda', 'Quarta', 'Sexta'],
              pontoReferencia: 'Próximo ao ponto de referência sandbox',
              observacoes: 'Apresentar documento com foto.',
            },
          ],
        });
      case 'ESTAGIO_ENCERRAMENTO':
        return EmailTemplates.generateEstagioEncerramentoEmail({
          adminNome: 'Administrador Sandbox',
          alunoNome: nomeCompleto,
          cursoNome: 'Curso Sandbox de Enfermagem',
          turmaNome: 'Turma Sandbox Noturna',
          estagioNome: 'Estágio Supervisionado Sandbox',
          dataFim: '30/09/2026',
          diasRestantes: 7,
          observacoes: 'Email gerado pelo sandbox de produção.',
        });
      case 'USUARIO_BLOQUEADO':
        return EmailTemplates.generateUserBlockedEmail({
          nomeCompleto,
          motivo: 'Teste de template pelo sandbox',
          fim: new Date('2026-07-25T23:59:59.000Z'),
          descricao: 'Este é um exemplo seguro sem alteração real na conta.',
          tipo: 'TEMPORARIO',
        });
      case 'USUARIO_DESBLOQUEADO':
        return EmailTemplates.generateUserUnblockedEmail({ nomeCompleto });
      default:
        throw createHttpError('Rotina de sandbox inválida', 'INVALID_SANDBOX_ROUTINE', 400);
    }
  }

  private async recordAudit(params: {
    actorId: string;
    rotina: SandboxEmailRotina;
    recipient: string;
    status: 'ENVIADO' | 'FALHA';
    simulated?: boolean;
    messageId?: string;
    error?: string;
    context?: { ip?: string; userAgent?: string };
  }) {
    try {
      await this.auditoriaService.registrarLog({
        categoria: AuditoriaCategoria.SISTEMA,
        tipo: 'BREVO_SANDBOX_EMAIL_ENVIADO',
        acao: 'ENVIAR_EMAIL_SANDBOX',
        usuarioId: params.actorId,
        entidadeId: params.rotina,
        entidadeTipo: 'BREVO_EMAIL_SANDBOX',
        descricao: `Envio de email sandbox ${params.status.toLowerCase()} para ${params.recipient}`,
        dadosNovos: {
          rotina: params.rotina,
          recipient: params.recipient,
          status: params.status,
          simulated: params.simulated ?? false,
          messageId: params.messageId ?? null,
          error: params.error ?? null,
        },
        metadata: {
          origem: 'CONFIGURACOES_GERAIS_SANDBOX',
          rotina: params.rotina,
          recipient: params.recipient,
          status: params.status,
        },
        ip: params.context?.ip,
        userAgent: params.context?.userAgent,
      });
    } catch (error) {
      this.log.warn(
        { err: error, rotina: params.rotina, recipient: params.recipient },
        'Erro ao registrar auditoria do sandbox de email',
      );
    }
  }
}

export const emailSandboxService = new EmailSandboxService();
