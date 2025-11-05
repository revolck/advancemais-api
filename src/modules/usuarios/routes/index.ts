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
// Rotas de estatísticas removidas

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

// Rotas de estatísticas removidas (não utilizadas)

// =============================================
// REGISTRO DE SUB-ROTAS - ORDEM IMPORTANTE
// =============================================

// Rotas de estatísticas removidas

/**
 * Rotas básicas de usuário - ÚLTIMO (mais genéricas)
 */
if (usuarioRoutes) {
  router.use('/', usuarioRoutes);
  usuarioModuleLogger.info('✅ Rotas básicas de usuário registradas');
} else {
  usuarioModuleLogger.error('❌ CRÍTICO: usuario-routes não disponível');
}

/**
 * Rotas administrativas incorporadas ao caminho principal
 * (substitui /admin/* por rotas sob /)
 */
if (adminRoutes) {
  router.use('/', adminRoutes);
  usuarioModuleLogger.info('✅ Rotas administrativas centralizadas no caminho principal');
}

export { router as usuarioRoutes };
export default router;
