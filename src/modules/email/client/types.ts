import type { EmailProviderName } from '@/config/env';

export type { EmailProviderName };

export type EmailChannel = 'transactional' | 'marketing';

export interface EmailSendInput {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
  /** Canal que entregou (ou o último tentado, em caso de falha) */
  provider?: EmailProviderName;
  failureReason?: string;
  /**
   * true quando não dá para saber se o provedor aceitou a mensagem
   * (ex.: timeout no meio do envio). Nesse caso não trocamos de canal,
   * para o destinatário não receber o mesmo e-mail duas vezes.
   */
  deliveryUncertain?: boolean;
}

export interface EmailProviderIssue {
  operation: 'health_check' | 'send_email';
  failureReason: string;
  message: string;
  responseCode?: number;
  code?: string;
  occurredAt: string;
}
