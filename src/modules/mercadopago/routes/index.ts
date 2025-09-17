import { Router } from 'express';
import { assinaturasRoutes } from '@/modules/mercadopago/assinaturas/routes';

const router = Router();

router.use('/assinaturas', assinaturasRoutes);

export { router as mercadopagoRoutes };

