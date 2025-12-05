import { Router } from 'express';

import { planosEmpresariaisRoutes } from '@/modules/empresas/planos-empresariais';
import { clientesRoutes } from '@/modules/empresas/clientes';
import { vagasRoutes } from '@/modules/empresas/vagas';
import { adminEmpresasRoutes } from '@/modules/empresas/admin';
import { vagasSolicitacoesRoutes } from '@/modules/empresas/vagas-solicitacoes/routes';

const router = Router();

router.use('/planos-empresariais', planosEmpresariaisRoutes);
// Rota oficial para clientes (empresas vinculadas a planos pagos)
router.use('/clientes', clientesRoutes);
router.use('/vagas', vagasRoutes);
// Rotas de solicitações de publicação de vagas
router.use('/vagas/solicitacoes', vagasSolicitacoesRoutes);
// Centraliza operações administrativas sob o caminho principal de empresas
router.use('/', adminEmpresasRoutes);

export { router as empresasRoutes };
