import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';

import { entrevistasManageController } from '../controllers/manage.controller';
import { entrevistasOverviewController } from '../controllers/overview.controller';

const router = Router();

router.use(
  supabaseAuthMiddleware([
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.SETOR_DE_VAGAS,
    Roles.EMPRESA,
    Roles.RECRUTADOR,
  ]),
);

router.get('/overview', entrevistasOverviewController.list);
router.get('/opcoes/empresas', entrevistasManageController.listEmpresas);
router.get('/opcoes/vagas', entrevistasManageController.listVagas);
router.get('/opcoes/candidatos', entrevistasManageController.listCandidatos);
router.post('/', entrevistasManageController.create);

export { router as entrevistasRoutes };
