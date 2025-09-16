/**
 * Router principal do módulo de usuários - ESTRUTURA ORIGINAL
 * Centraliza e organiza todas as sub-rotas
 *
 * @author Sistema Advance+
 * @version 3.0.4 - ESTRUTURA ORIGINAL com verificações de segurança
 */
import { Router } from 'express';
import { logger } from '@/utils/logger';

const router = Router();
const usuarioModuleLogger = logger.child({ module: 'UsuariosRouter' });

/**
 * Informações do módulo de usuários
 * GET /usuarios
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Módulo de Usuários - Advance+ API',
    version: '3.0.4',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: 'POST /login, POST /registrar, POST /logout',
      profile: 'GET /perfil',
      admin: '/admin/*',
      stats: '/stats/*',
      recovery: '/recuperar-senha/*',
    },
    status: 'operational',
  });
});

// =============================================
// IMPORTS SEGUROS DAS SUB-ROTAS
// =============================================

let usuarioRoutes: Router | undefined;
let adminRoutes: Router | undefined;
let statsRoutes: Router | undefined;

// Import das rotas básicas (ESSENCIAL)
try {
  const { default: routes } = require('./usuario-routes');
  usuarioRoutes = routes;
  usuarioModuleLogger.info('✅ usuario-routes carregado');
} catch (error) {
  usuarioModuleLogger.error({ err: error }, '❌ Erro ao carregar usuario-routes');
}

// Import das rotas administrativas (OPCIONAL)
try {
  const { default: routes } = require('./admin-routes');
  adminRoutes = routes;
  usuarioModuleLogger.info('✅ admin-routes carregado');
} catch (error) {
  usuarioModuleLogger.warn({ err: error }, '⚠️ admin-routes não disponível');
}

// Import das rotas de estatísticas (OPCIONAL)
try {
  const { default: routes } = require('./stats-routes');
  statsRoutes = routes;
  usuarioModuleLogger.info('✅ stats-routes carregado');
} catch (error) {
  usuarioModuleLogger.warn({ err: error }, '⚠️ stats-routes não disponível');
}

// =============================================
// REGISTRO DE SUB-ROTAS - ORDEM IMPORTANTE
// =============================================

/**
 * Rotas administrativas - PRIMEIRO (mais específicas)
 */
if (adminRoutes) {
  router.use('/admin', adminRoutes);
  usuarioModuleLogger.info('✅ Rotas administrativas registradas');
}

/**
 * Rotas de estatísticas
 */
if (statsRoutes) {
  router.use('/stats', statsRoutes);
  usuarioModuleLogger.info('✅ Rotas de estatísticas registradas');
}

/**
 * Rotas básicas de usuário - ÚLTIMO (mais genéricas)
 */
if (usuarioRoutes) {
  router.use('/', usuarioRoutes);
  usuarioModuleLogger.info('✅ Rotas básicas de usuário registradas');
} else {
  usuarioModuleLogger.error('❌ CRÍTICO: usuario-routes não disponível');
}

export { router as usuarioRoutes };
export default router;
