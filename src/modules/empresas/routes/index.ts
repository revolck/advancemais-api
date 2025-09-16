import { Router } from 'express';

import { planosEmpresariaisRoutes } from '@/modules/empresas/planos-empresarial';
import { planosParceiroRoutes } from '@/modules/empresas/planos-parceiro';
import { vagasRoutes } from '@/modules/empresas/vagas';

const router = Router();

router.use('/planos-empresarial', planosEmpresariaisRoutes);
router.use('/planos-parceiro', planosParceiroRoutes);
router.use('/vagas', vagasRoutes);

export { router as empresasRoutes };
