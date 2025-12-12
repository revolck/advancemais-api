/**
 * Módulo de Aulas - Exportações principais
 */

export { aulasService } from './services/aulas.service';
export { googleOAuthService } from './services/google-oauth.service';
export { googleCalendarService } from './services/google-calendar.service';
export { notificacoesHelper } from './services/notificacoes-helper.service';
export { agendaService } from './services/agenda.service';

export { AulasController } from './controllers/aulas.controller';
export { GoogleOAuthController } from './controllers/google-oauth.controller';
export { AgendaController } from './controllers/agenda.controller';

export { notificarAulasProximas } from './cron/notificar-aulas.cron';
export { notificarProvasProximas } from './cron/notificar-provas.cron';

export { default as aulasRoutes, agendaRoutes } from './routes';
