/**
 * Interfaces e tipos para o módulo Brevo
 * Centraliza todas as definições de tipos para melhor manutenibilidade
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1
 */

/**
 * Interface base para resposta de serviços
 */
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  messageId?: string;
  timestamp?: string;
}

/**
 * Interface para dados de email básico
 */
export interface EmailData {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateId?: number;
  templateParams?: Record<string, any>;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
}

/**
 * Interface para anexos de email
 */
export interface EmailAttachment {
  name: string;
  content: string; // base64
  contentType?: string;
}

/**
 * Interface para dados de SMS
 */
export interface SMSData {
  to: string;
  message: string;
  sender?: string;
  type?: "transactional" | "promotional";
}

/**
 * Interface para dados de usuário em templates
 */
export interface UserTemplateData {
  id: string;
  email: string;
  nomeCompleto: string;
  tipoUsuario: string;
}

/**
 * Interface para dados de template de boas-vindas
 */
export interface WelcomeTemplateData {
  nomeCompleto: string;
  tipoUsuario: string;
  frontendUrl: string;
  ano: number;
}

/**
 * Interface para dados de template de recuperação de senha
 */
export interface PasswordRecoveryTemplateData {
  nomeCompleto: string;
  linkRecuperacao: string;
  token: string;
  expiracaoMinutos: number;
  maxTentativas: number;
  frontendUrl: string;
  ano: number;
}

/**
 * Interface para configuração do módulo Brevo
 * RENOMEADA para evitar conflito com a classe
 */
export interface IBrevoConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

/**
 * Interface para health check
 */
export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  services: {
    client: ServiceStatus;
    email: ServiceStatus;
    sms: ServiceStatus;
  };
  metrics?: HealthMetrics;
}

/**
 * Interface para status de serviço
 */
export interface ServiceStatus {
  status: "up" | "down";
  responseTime?: number;
  error?: string;
  lastCheck?: string;
}

/**
 * Interface para métricas de health check
 */
export interface HealthMetrics {
  email: {
    totalSent: number;
    successRate: number;
    lastSent?: string;
  };
  sms: {
    totalSent: number;
    successRate: number;
    lastSent?: string;
  };
}

/**
 * Enums para tipos de email
 */
export enum EmailType {
  WELCOME = "BOAS_VINDAS",
  PASSWORD_RECOVERY = "RECUPERACAO_SENHA",
  VERIFICATION = "VERIFICACAO_EMAIL",
  NOTIFICATION = "NOTIFICACAO_SISTEMA",
}

/**
 * Enums para status de envio
 */
export enum SendStatus {
  SENT = "ENVIADO",
  FAILED = "FALHA",
  PENDING = "PENDENTE",
}

/**
 * Interface para log de envio
 */
export interface SendLog {
  id?: string;
  usuarioId?: string;
  type: EmailType;
  status: SendStatus;
  recipient: string;
  attempts: number;
  messageId?: string;
  error?: string;
  createdAt: Date;
}
