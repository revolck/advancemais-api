import { Router } from 'express';

import { planosEmpresariaisRoutes } from '@/modules/empresas/planos-empresarial';
import { vagasRoutes } from '@/modules/empresas/vagas';

const router = Router();

router.use('/planos-empresarial', planosEmpresariaisRoutes);
router.use('/vagas', vagasRoutes);

export { router as empresasRoutes };
