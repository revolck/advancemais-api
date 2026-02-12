import { Router } from 'express';

import { publicCache } from '../../../middlewares/cache-control';
import { WebsiteSiteDataController } from '../controllers/site-data.controller';

const router = Router();

router.get('/', publicCache, WebsiteSiteDataController.get);

export { router as websiteSiteDataRoutes };
