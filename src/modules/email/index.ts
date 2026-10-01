/**
 * Módulo de e-mail (SMTP + Brevo) - Exportações principais
 * Sistema completo de email e verificação
 */

// Serviços principais
export { EmailService } from './services/email-service';

// Cliente e configuração
export { SmtpClient } from './client/smtp-client';
export { BrevoClient } from './client/brevo-client';
export { EmailDispatcher } from './client/email-dispatcher';
export { EmailConfigManager } from './config/email-config';

// Templates
export { EmailTemplates } from './templates/email-templates';

// Middlewares
export { WelcomeEmailMiddleware } from './middlewares/welcome-email-middleware';

// Controllers
export { EmailController } from './controllers/email-controller';
export { EmailVerificationController } from './controllers/email-verification-controller';

// Rotas
export { emailRoutes } from './routes';

// Tipos e interfaces
export * from './types/interfaces';
