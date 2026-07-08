import { Router } from 'express';

import { jwtAuthMiddleware } from '@/modules/usuarios/auth/jwt-middleware';
import { WebsiteRecipientListsController } from '@/modules/website/controllers/recipient-lists.controller';

const router = Router();
const adminMarketingAuth = jwtAuthMiddleware(['ADMIN', 'MODERADOR']);

router.get('/', adminMarketingAuth, WebsiteRecipientListsController.list);
router.post('/', adminMarketingAuth, WebsiteRecipientListsController.create);
router.get('/status', adminMarketingAuth, WebsiteRecipientListsController.statuses);
router.get('/options/rules', adminMarketingAuth, WebsiteRecipientListsController.rulesOptions);
router.get(
  '/options/recipients',
  adminMarketingAuth,
  WebsiteRecipientListsController.recipientsOptions,
);
router.post('/:id/recalculate', adminMarketingAuth, WebsiteRecipientListsController.recalculate);
router.get('/:id', adminMarketingAuth, WebsiteRecipientListsController.get);
router.put('/:id', adminMarketingAuth, WebsiteRecipientListsController.update);
router.delete('/:id', adminMarketingAuth, WebsiteRecipientListsController.remove);

export { router as websiteRecipientListsRoutes };
