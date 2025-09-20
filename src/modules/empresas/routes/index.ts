import { Router } from 'express';

import { planosEmpresariaisRoutes } from '@/modules/empresas/planos-empresariais';
import { clientesRoutes } from '@/modules/empresas/clientes';
import { vagasRoutes } from '@/modules/empresas/vagas';
import { adminEmpresasRoutes } from '@/modules/empresas/admin';

const router = Router();

router.use('/planos-empresariais', planosEmpresariaisRoutes);
// Rota oficial para clientes (empresas vinculadas a planos pagos)
router.use('/clientes', clientesRoutes);
router.use('/vagas', vagasRoutes);
router.use('/admin', adminEmpresasRoutes);

export { router as empresasRoutes };
