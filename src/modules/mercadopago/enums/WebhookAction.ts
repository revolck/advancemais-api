/**
 * Ações possíveis em webhooks
 */
export enum WebhookAction {
  PAYMENT_CREATED = "payment.created",
  PAYMENT_UPDATED = "payment.updated",
  ORDER_UPDATED = "order.updated",
  SUBSCRIPTION_CREATED = "subscription.created",
  SUBSCRIPTION_UPDATED = "subscription.updated",
  SUBSCRIPTION_CANCELLED = "subscription.cancelled",
  INVOICE_CREATED = "invoice.created",
  INVOICE_UPDATED = "invoice.updated",
}
