export type ConfigCategory =
  | 'mercadopago'
  | 'emails'
  | 'agenda'
  | 'logs'
  | 'uploads'
  | 'integracoes';

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'url' | 'email' | 'csv' | 'cron';

export type ConfigSource = 'DB' | 'ENV' | 'DEFAULT' | 'EMPTY';

export interface ConfigDefinition {
  category: ConfigCategory;
  key: string;
  label: string;
  type: ConfigValueType;
  envKeys: string[];
  secret?: boolean;
  required?: boolean;
  defaultValue?: string | number | boolean;
  description?: string;
  restartRequired?: boolean;
}

export interface ConfigCategoryMeta {
  category: ConfigCategory;
  label: string;
  description: string;
}

export const CONFIG_CATEGORIES: ConfigCategoryMeta[] = [
  {
    category: 'mercadopago',
    label: 'Mercado Pago',
    description: 'Credenciais, URLs de retorno e regras operacionais de pagamentos.',
  },
  {
    category: 'emails',
    label: 'E-mails',
    description: 'Servidor SMTP, remetente e regras de verificação e recuperação de senha.',
  },
  {
    category: 'agenda',
    label: 'Agenda',
    description: 'Crons de notificações de aulas, provas e entrevistas.',
  },
  {
    category: 'logs',
    label: 'Logs',
    description: 'Nível de log e flags operacionais de auditoria/diagnóstico.',
  },
  {
    category: 'uploads',
    label: 'Uploads',
    description: 'Tamanho máximo e MIME types aceitos pela API.',
  },
  {
    category: 'integracoes',
    label: 'Integrações',
    description: 'Google OAuth e integrações externas usadas pela plataforma.',
  },
];

export const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  // Mercado Pago - conta/aplicação
  {
    category: 'mercadopago',
    key: 'mp_active_mode',
    label: 'Modo do Mercado Pago',
    type: 'string',
    envKeys: [],
    defaultValue: 'production',
    required: true,
  },
  {
    category: 'mercadopago',
    key: 'mp_user_id',
    label: 'User ID de produção',
    type: 'string',
    envKeys: ['MP_USER_ID'],
  },
  {
    category: 'mercadopago',
    key: 'mp_application_id',
    label: 'Application ID de produção',
    type: 'string',
    envKeys: ['MP_APPLICATION_ID'],
  },
  {
    category: 'mercadopago',
    key: 'mp_webhook_secret',
    label: 'Webhook secret de produção',
    type: 'string',
    envKeys: ['MP_WEBHOOK_SECRET'],
    secret: true,
  },
  // Mercado Pago - teste
  {
    category: 'mercadopago',
    key: 'mp_test_user_id',
    label: 'User ID de teste',
    type: 'string',
    envKeys: ['MP_TEST_USER_ID', 'MERCADOPAGO_TEST_USER_ID'],
  },
  {
    category: 'mercadopago',
    key: 'mp_test_application_id',
    label: 'Application ID de teste',
    type: 'string',
    envKeys: ['MP_TEST_APPLICATION_ID', 'MERCADOPAGO_TEST_APPLICATION_ID'],
  },
  {
    category: 'mercadopago',
    key: 'mp_test_webhook_secret',
    label: 'Webhook secret de teste',
    type: 'string',
    envKeys: ['MP_TEST_WEBHOOK_SECRET', 'MERCADOPAGO_TEST_WEBHOOK_SECRET'],
    secret: true,
  },
  {
    category: 'mercadopago',
    key: 'mp_test_public_key',
    label: 'Public key de teste',
    type: 'string',
    envKeys: ['MP_TEST_PUBLIC_KEY', 'MERCADOPAGO_TEST_PUBLIC_KEY'],
  },
  {
    category: 'mercadopago',
    key: 'mp_test_access_token',
    label: 'Access token de teste',
    type: 'string',
    envKeys: ['MP_TEST_ACCESS_TOKEN', 'MERCADOPAGO_TEST_ACCESS_TOKEN'],
    secret: true,
  },
  // Mercado Pago - produção
  {
    category: 'mercadopago',
    key: 'mp_public_key',
    label: 'Public key de produção',
    type: 'string',
    envKeys: ['MP_PUBLIC_KEY', 'MERCADOPAGO_PUBLIC_KEY'],
  },
  {
    category: 'mercadopago',
    key: 'mp_access_token',
    label: 'Access token de produção',
    type: 'string',
    envKeys: ['MP_ACCESS_TOKEN', 'MERCADOPAGO_ACCESS_TOKEN'],
    secret: true,
  },
  {
    category: 'mercadopago',
    key: 'mp_client_id',
    label: 'Client ID',
    type: 'string',
    envKeys: ['MP_CLIENT_ID'],
  },
  {
    category: 'mercadopago',
    key: 'mp_client_secret',
    label: 'Client secret',
    type: 'string',
    envKeys: ['MP_CLIENT_SECRET'],
    secret: true,
  },
  // Mercado Pago - URLs e regras
  {
    category: 'mercadopago',
    key: 'mp_return_success_url',
    label: 'URL sucesso',
    type: 'url',
    envKeys: ['MP_RETURN_SUCCESS_URL'],
  },
  {
    category: 'mercadopago',
    key: 'mp_return_failure_url',
    label: 'URL falha',
    type: 'url',
    envKeys: ['MP_RETURN_FAILURE_URL'],
  },
  {
    category: 'mercadopago',
    key: 'mp_return_pending_url',
    label: 'URL pendente',
    type: 'url',
    envKeys: ['MP_RETURN_PENDING_URL'],
  },
  {
    category: 'mercadopago',
    key: 'mp_billing_portal_url',
    label: 'URL portal de cobrança',
    type: 'url',
    envKeys: ['MP_BILLING_PORTAL_URL'],
  },
  {
    category: 'mercadopago',
    key: 'cursos_installments_enabled',
    label: 'Ativar parcelamento para cursos e turmas',
    type: 'boolean',
    envKeys: ['CURSOS_INSTALLMENTS_ENABLED'],
    defaultValue: false,
  },
  {
    category: 'mercadopago',
    key: 'course_payment_methods',
    label: 'Métodos de pagamento para cursos e turmas',
    type: 'csv',
    envKeys: ['COURSE_PAYMENT_METHODS'],
    defaultValue: 'pix,boleto,card',
    required: true,
  },
  {
    category: 'mercadopago',
    key: 'subscription_payment_methods',
    label: 'Métodos de pagamento para assinaturas',
    type: 'csv',
    envKeys: ['SUBSCRIPTION_PAYMENT_METHODS'],
    defaultValue: 'pix,boleto,card',
    required: true,
  },
  {
    category: 'mercadopago',
    key: 'cursos_installments_max',
    label: 'Máximo de parcelas',
    type: 'number',
    envKeys: ['CURSOS_INSTALLMENTS_MAX'],
    defaultValue: 1,
  },
  {
    category: 'mercadopago',
    key: 'assinaturas_default_currency',
    label: 'Moeda padrão',
    type: 'string',
    envKeys: ['ASSINATURAS_DEFAULT_CURRENCY'],
    defaultValue: 'BRL',
  },
  {
    category: 'mercadopago',
    key: 'assinaturas_recorrencia_padrao',
    label: 'Recorrência padrão',
    type: 'string',
    envKeys: ['ASSINATURAS_RECURRENCIA_PADRAO'],
    defaultValue: 'ASSINATURA',
  },
  {
    category: 'mercadopago',
    key: 'assinaturas_grace_days',
    label: 'Dias de tolerância',
    type: 'number',
    envKeys: ['ASSINATURAS_GRACE_DAYS'],
    defaultValue: 5,
  },
  {
    category: 'mercadopago',
    key: 'assinaturas_emails_enabled',
    label: 'Enviar e-mails de assinaturas',
    type: 'boolean',
    envKeys: ['ASSINATURAS_EMAILS_ENABLED'],
    defaultValue: true,
  },
  {
    category: 'mercadopago',
    key: 'assinaturas_assistida_pix_boleto',
    label: 'PIX/Boleto assistido',
    type: 'boolean',
    envKeys: ['ASSINATURAS_ASSISTIDA_PIX_BOLETO'],
    defaultValue: true,
  },
  {
    category: 'mercadopago',
    key: 'assinaturas_boleto_grace_days',
    label: 'Dias de tolerância boleto',
    type: 'number',
    envKeys: ['ASSINATURAS_BOLETO_GRACE_DAYS'],
    defaultValue: 5,
  },
  {
    category: 'mercadopago',
    key: 'cron_boleto_enabled',
    label: 'Cron de boletos ativo',
    type: 'boolean',
    envKeys: ['CRON_BOLETO_ENABLED'],
    defaultValue: false,
  },
  {
    category: 'mercadopago',
    key: 'cron_boleto_schedule',
    label: 'Agenda do cron de boletos',
    type: 'cron',
    envKeys: ['CRON_BOLETO_SCHEDULE'],
    defaultValue: '60',
  },
  {
    category: 'mercadopago',
    key: 'cron_boleto_max_days',
    label: 'Dias máximos de boleto',
    type: 'number',
    envKeys: ['CRON_BOLETO_MAX_DAYS'],
    defaultValue: 5,
  },
  {
    category: 'mercadopago',
    key: 'cron_reconciliation_enabled',
    label: 'Cron de reconciliação ativo',
    type: 'boolean',
    envKeys: ['CRON_RECONCILIATION_ENABLED'],
    defaultValue: false,
  },
  {
    category: 'mercadopago',
    key: 'cron_reconciliation_schedule',
    label: 'Agenda do cron de reconciliação',
    type: 'cron',
    envKeys: ['CRON_RECONCILIATION_SCHEDULE'],
    defaultValue: '120',
  },
  {
    category: 'mercadopago',
    key: 'cron_cobranca_enabled',
    label: 'Cron de cobrança ativo',
    type: 'boolean',
    envKeys: ['CRON_COBRANCA_ENABLED'],
    defaultValue: true,
  },
  {
    category: 'mercadopago',
    key: 'cron_cobranca_schedule',
    label: 'Agenda do cron de cobrança',
    type: 'cron',
    envKeys: ['CRON_COBRANCA_SCHEDULE'],
    defaultValue: '360',
  },

  // E-mails / SMTP
  {
    category: 'emails',
    key: 'smtp_host',
    label: 'SMTP host',
    type: 'string',
    envKeys: ['SMTP_HOST'],
    defaultValue: 'smtp.hostinger.com',
  },
  {
    category: 'emails',
    key: 'smtp_port',
    label: 'SMTP porta',
    type: 'number',
    envKeys: ['SMTP_PORT'],
    defaultValue: 465,
    description: '465 usa SSL direto; 587 usa STARTTLS.',
  },
  {
    category: 'emails',
    key: 'smtp_user',
    label: 'SMTP usuário',
    type: 'string',
    envKeys: ['SMTP_USER'],
    defaultValue: 'noreply@advancemais.com',
  },
  {
    category: 'emails',
    key: 'smtp_password',
    label: 'SMTP senha',
    type: 'string',
    envKeys: ['SMTP_PASSWORD'],
    secret: true,
    required: true,
  },
  {
    category: 'emails',
    key: 'smtp_from_email',
    label: 'E-mail remetente',
    type: 'email',
    envKeys: ['SMTP_FROM_EMAIL'],
    defaultValue: 'noreply@advancemais.com',
  },
  {
    category: 'emails',
    key: 'smtp_from_name',
    label: 'Nome remetente',
    type: 'string',
    envKeys: ['SMTP_FROM_NAME'],
    defaultValue: 'Advance+',
  },
  {
    category: 'emails',
    key: 'smtp_timeout',
    label: 'Timeout SMTP (ms)',
    type: 'number',
    envKeys: ['SMTP_TIMEOUT'],
    defaultValue: 15000,
  },
  {
    category: 'emails',
    key: 'password_recovery_expiration_hours',
    label: 'Expiração recuperação (horas)',
    type: 'number',
    envKeys: ['PASSWORD_RECOVERY_EXPIRATION_HOURS'],
    defaultValue: 72,
  },
  {
    category: 'emails',
    key: 'password_recovery_max_attempts',
    label: 'Tentativas recuperação',
    type: 'number',
    envKeys: ['PASSWORD_RECOVERY_MAX_ATTEMPTS'],
    defaultValue: 3,
  },
  {
    category: 'emails',
    key: 'password_recovery_cooldown_minutes',
    label: 'Cooldown recuperação (min)',
    type: 'number',
    envKeys: ['PASSWORD_RECOVERY_COOLDOWN_MINUTES'],
    defaultValue: 15,
  },
  {
    category: 'emails',
    key: 'email_verification_required',
    label: 'Verificação de e-mail obrigatória',
    type: 'boolean',
    envKeys: ['EMAIL_VERIFICATION_REQUIRED'],
    defaultValue: true,
  },
  {
    category: 'emails',
    key: 'email_verification_expiration_hours',
    label: 'Expiração verificação (horas)',
    type: 'number',
    envKeys: ['EMAIL_VERIFICATION_EXPIRATION_HOURS'],
    defaultValue: 72,
  },
  {
    category: 'emails',
    key: 'email_verification_max_resend',
    label: 'Máximo reenvios verificação',
    type: 'number',
    envKeys: ['EMAIL_VERIFICATION_MAX_RESEND'],
    defaultValue: 3,
  },
  {
    category: 'emails',
    key: 'email_verification_cooldown_minutes',
    label: 'Cooldown verificação (min)',
    type: 'number',
    envKeys: ['EMAIL_VERIFICATION_COOLDOWN_MINUTES'],
    defaultValue: 5,
  },

  // Agenda
  {
    category: 'agenda',
    key: 'agenda_cron_aulas_enabled',
    label: 'Cron aulas ativo',
    type: 'boolean',
    envKeys: ['AGENDA_CRON_AULAS_ENABLED'],
    defaultValue: true,
  },
  {
    category: 'agenda',
    key: 'agenda_cron_aulas_schedule',
    label: 'Agenda cron aulas',
    type: 'cron',
    envKeys: ['AGENDA_CRON_AULAS_SCHEDULE'],
    defaultValue: '15',
  },
  {
    category: 'agenda',
    key: 'agenda_cron_provas_enabled',
    label: 'Cron provas ativo',
    type: 'boolean',
    envKeys: ['AGENDA_CRON_PROVAS_ENABLED'],
    defaultValue: true,
  },
  {
    category: 'agenda',
    key: 'agenda_cron_provas_schedule',
    label: 'Agenda cron provas',
    type: 'cron',
    envKeys: ['AGENDA_CRON_PROVAS_SCHEDULE'],
    defaultValue: '15',
  },
  {
    category: 'agenda',
    key: 'agenda_cron_entrevistas_enabled',
    label: 'Cron entrevistas ativo',
    type: 'boolean',
    envKeys: ['AGENDA_CRON_ENTREVISTAS_ENABLED'],
    defaultValue: true,
  },
  {
    category: 'agenda',
    key: 'agenda_cron_entrevistas_schedule',
    label: 'Agenda cron entrevistas',
    type: 'cron',
    envKeys: ['AGENDA_CRON_ENTREVISTAS_SCHEDULE'],
    defaultValue: '15',
  },
  {
    category: 'agenda',
    key: 'agenda_cron_gravacoes_enabled',
    label: 'Cron de sincronização de gravações ativo',
    type: 'boolean',
    envKeys: ['AGENDA_CRON_GRAVACOES_ENABLED'],
    defaultValue: true,
  },
  {
    category: 'agenda',
    key: 'agenda_cron_gravacoes_schedule',
    label: 'Agenda cron gravações',
    type: 'cron',
    envKeys: ['AGENDA_CRON_GRAVACOES_SCHEDULE'],
    defaultValue: '60',
  },

  // Logs
  {
    category: 'logs',
    key: 'log_level',
    label: 'Nível de log',
    type: 'string',
    envKeys: ['LOG_LEVEL'],
    defaultValue: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  {
    category: 'logs',
    key: 'enable_console_log',
    label: 'Log em console',
    type: 'boolean',
    envKeys: ['ENABLE_CONSOLE_LOG'],
    defaultValue: true,
  },
  {
    category: 'logs',
    key: 'enable_file_log',
    label: 'Log em arquivo',
    type: 'boolean',
    envKeys: ['ENABLE_FILE_LOG'],
    defaultValue: false,
    restartRequired: true,
  },

  // Uploads
  {
    category: 'uploads',
    key: 'max_file_size',
    label: 'Tamanho máximo por arquivo (bytes)',
    type: 'number',
    envKeys: ['MAX_FILE_SIZE'],
    defaultValue: 10485760,
  },
  {
    category: 'uploads',
    key: 'allowed_mime_types',
    label: 'MIME types permitidos',
    type: 'csv',
    envKeys: ['ALLOWED_MIME_TYPES'],
    defaultValue: 'image/jpeg,image/png,image/gif,application/pdf',
    required: true,
  },

  // Integrações
  {
    category: 'integracoes',
    key: 'google_client_id',
    label: 'Google Client ID',
    type: 'string',
    envKeys: ['GOOGLE_CLIENT_ID'],
  },
  {
    category: 'integracoes',
    key: 'google_client_secret',
    label: 'Google Client Secret',
    type: 'string',
    envKeys: ['GOOGLE_CLIENT_SECRET'],
    secret: true,
  },
  {
    category: 'integracoes',
    key: 'google_meet_institutional_admin_emails',
    label: 'E-mails institucionais administradores das salas do Meet',
    type: 'csv',
    envKeys: ['GOOGLE_MEET_INSTITUTIONAL_ADMIN_EMAILS'],
    defaultValue: 'aulas@advancerh.page,pedagogico@advancerh.com.br',
  },
];

const definitionsByCategory = new Map<ConfigCategory, ConfigDefinition[]>();
const definitionsByKey = new Map<string, ConfigDefinition>();

for (const definition of CONFIG_DEFINITIONS) {
  const categoryDefinitions = definitionsByCategory.get(definition.category) ?? [];
  categoryDefinitions.push(definition);
  definitionsByCategory.set(definition.category, categoryDefinitions);
  definitionsByKey.set(`${definition.category}.${definition.key}`, definition);
}

export function getDefinitionsByCategory(category: ConfigCategory): ConfigDefinition[] {
  return definitionsByCategory.get(category) ?? [];
}

export function getDefinition(category: ConfigCategory, key: string): ConfigDefinition | undefined {
  return definitionsByKey.get(`${category}.${key}`);
}

export function isConfigCategory(value: string): value is ConfigCategory {
  return CONFIG_CATEGORIES.some((item) => item.category === value);
}
