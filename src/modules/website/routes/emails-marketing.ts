import { Router } from 'express';

import { jwtAuthMiddleware } from '@/modules/usuarios/auth/jwt-middleware';
import { WebsiteEmailsMarketingController } from '@/modules/website/controllers/emails-marketing.controller';

const router = Router();
const adminMarketingAuth = jwtAuthMiddleware(['ADMIN', 'MODERADOR']);

router.get('/', adminMarketingAuth, WebsiteEmailsMarketingController.list);
router.get('/options/filters', adminMarketingAuth, WebsiteEmailsMarketingController.filterOptions);
router.get(
  '/options/recipients',
  adminMarketingAuth,
  WebsiteEmailsMarketingController.recipientOptions,
);
router.get('/:id', adminMarketingAuth, WebsiteEmailsMarketingController.get);
router.post('/', adminMarketingAuth, WebsiteEmailsMarketingController.create);
router.put('/:id', adminMarketingAuth, WebsiteEmailsMarketingController.update);
router.delete('/:id', adminMarketingAuth, WebsiteEmailsMarketingController.remove);

export { router as websiteEmailsMarketingRoutes };
