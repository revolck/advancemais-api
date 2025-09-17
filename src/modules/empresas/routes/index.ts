import { Router } from 'express';

import { planosEmpresariaisRoutes } from '@/modules/empresas/planos-empresarial';
import { clientesRoutes } from '@/modules/empresas/clientes';
import { vagasRoutes } from '@/modules/empresas/vagas';

const router = Router();

router.use('/planos-empresarial', planosEmpresariaisRoutes);
// Rota oficial para clientes (empresas vinculadas a planos pagos)
router.use('/clientes', clientesRoutes);
router.use('/vagas', vagasRoutes);

export { router as empresasRoutes };
