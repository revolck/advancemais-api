import { Router } from 'express';
import { Roles } from '@prisma/client';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { ConfiguracoesGeraisController } from '../controllers/configuracoes-gerais.controller';

const router = Router();
const adminRoles = [Roles.ADMIN, Roles.MODERADOR];

router.get('/publicas/mercadopago', ConfiguracoesGeraisController.publicMercadoPago);

router.get('/geral', supabaseAuthMiddleware(adminRoles), ConfiguracoesGeraisController.list);
router.get(
  '/geral/historico',
  supabaseAuthMiddleware(adminRoles),
  ConfiguracoesGeraisController.history,
);
router.patch(
  '/geral/:categoria',
  supabaseAuthMiddleware(adminRoles),
  ConfiguracoesGeraisController.updateCategory,
);
router.post(
  '/geral/:categoria/testar',
  supabaseAuthMiddleware(adminRoles),
  ConfiguracoesGeraisController.testCategory,
);

export { router as configuracoesGeraisRoutes };
