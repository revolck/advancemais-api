/**
 * Interfaces simplificadas para o módulo Brevo
 *
 * @author Sistema AdvanceMais
 * @version 5.0.0 - Simplificação
 */

/**
 * Resultado padrão de operações
 */
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  messageId?: string;
  simulated?: boolean;
  timestamp?: string;
}

/**
 * Dados básicos de usuário para templates
 */
export interface UserTemplateData {
  id: string;
  email: string;
  nomeCompleto: string;
  tipoUsuario: string;
}

/**
 * Configuração do módulo Brevo
 */
export interface BrevoConfiguration {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  maxRetries: number;
  timeout: number;
  isConfigured: boolean;
}

/**
 * Status de health check
 */
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  module: string;
  configured: boolean;
  simulated: boolean;
  operational: boolean;
}

/**
 * Dados para email de boas-vindas
 */
export interface WelcomeEmailData {
  nomeCompleto: string;
  tipoUsuario: string;
  email: string;
  frontendUrl: string;
}

/**
 * Dados para email de recuperação de senha
 */
export interface PasswordRecoveryData {
  nomeCompleto: string;
  token: string;
  linkRecuperacao: string;
  expiracaoMinutos: number;
}

/**
 * Dados para SMS
 */
export interface SMSData {
  to: string;
  message: string;
  sender?: string;
}

/**
 * Resultado de operação de SMS
 */
export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
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
 * Enums para tipos de SMS
 */
export enum SMSType {
  VERIFICATION = "VERIFICACAO",
  NOTIFICATION = "NOTIFICACAO",
  MARKETING = "MARKETING",
}
