import { Router } from 'express';
import { assinaturasRoutes } from '@/modules/mercadopago/assinaturas/routes';
import { logsRoutes } from '@/modules/mercadopago/logs';

const router = Router();

router.use('/assinaturas', assinaturasRoutes);
router.use('/logs', logsRoutes);

export { router as mercadopagoRoutes };
