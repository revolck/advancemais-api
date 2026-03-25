import { Router } from 'express';

import { auditoriaAdminOnlyMiddleware } from './access';
import { logsController } from '../controllers/logs.controller';

const logsRoutes = Router();

logsRoutes.use(...auditoriaAdminOnlyMiddleware);

logsRoutes.get('/', logsController.list);
logsRoutes.get('/:id', logsController.get);

export { logsRoutes };
