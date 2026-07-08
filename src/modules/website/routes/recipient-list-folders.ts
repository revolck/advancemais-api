import { Router } from 'express';

import { jwtAuthMiddleware } from '@/modules/usuarios/auth/jwt-middleware';
import { WebsiteRecipientListsController } from '@/modules/website/controllers/recipient-lists.controller';

const router = Router();
const adminMarketingAuth = jwtAuthMiddleware(['ADMIN', 'MODERADOR']);

router.get('/', adminMarketingAuth, WebsiteRecipientListsController.listFolders);
router.post('/', adminMarketingAuth, WebsiteRecipientListsController.createFolder);
router.put('/:id', adminMarketingAuth, WebsiteRecipientListsController.updateFolder);
router.delete('/:id', adminMarketingAuth, WebsiteRecipientListsController.removeFolder);

export { router as websiteRecipientListFoldersRoutes };
