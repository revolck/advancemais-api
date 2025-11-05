import { Router } from 'express';
import { logsRoutes } from './logs.routes';
import { usuariosRoutes } from './usuarios.routes';
import { scriptsRoutes } from './scripts.routes';
import { assinaturasRoutes } from './assinaturas.routes';
import { transacoesRoutes } from './transacoes.routes';

const auditoriaRoutes = Router();

// Registrar todas as sub-rotas
auditoriaRoutes.use('/logs', logsRoutes);
auditoriaRoutes.use('/usuarios', usuariosRoutes);
auditoriaRoutes.use('/scripts', scriptsRoutes);
auditoriaRoutes.use('/assinaturas', assinaturasRoutes);
auditoriaRoutes.use('/transacoes', transacoesRoutes);

export { auditoriaRoutes };
