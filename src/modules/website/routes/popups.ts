import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';
import { jwtAuthMiddleware } from '@/modules/usuarios/auth/jwt-middleware';
import { WebsitePopupsController } from '@/modules/website/controllers/popups.controller';

const router = Router();
const adminMarketingAuth = jwtAuthMiddleware(['ADMIN', 'MODERADOR']);

/**
 * @openapi
 * /api/v1/website/popups/active:
 *   get:
 *     summary: Listar pop-ups publicados elegíveis para exibição
 *     tags: [Website]
 */
router.get('/active', publicCache, WebsitePopupsController.active);

/**
 * @openapi
 * /api/v1/website/popups/contacts:
 *   get:
 *     summary: Listar contatos capturados por pop-ups
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 */
router.get('/contacts', adminMarketingAuth, WebsitePopupsController.listContacts);
router.get('/contacts/:id', adminMarketingAuth, WebsitePopupsController.getContact);
router.get('/contacts/:id/history', adminMarketingAuth, WebsitePopupsController.getContactHistory);
router.get(
  '/contacts/:id/activity',
  adminMarketingAuth,
  WebsitePopupsController.getContactActivity,
);
router.put('/contacts/:id', adminMarketingAuth, WebsitePopupsController.updateContact);
router.delete('/contacts/:id', adminMarketingAuth, WebsitePopupsController.removeContact);
router.post('/contacts/:id/notes', adminMarketingAuth, WebsitePopupsController.createContactNote);
router.put(
  '/contacts/:id/notes/:noteId',
  adminMarketingAuth,
  WebsitePopupsController.updateContactNote,
);
router.delete(
  '/contacts/:id/notes/:noteId',
  adminMarketingAuth,
  WebsitePopupsController.removeContactNote,
);
router.post(
  '/contacts/:id/interests',
  adminMarketingAuth,
  WebsitePopupsController.createContactInterest,
);
router.delete(
  '/contacts/:id/interests/:interestId',
  adminMarketingAuth,
  WebsitePopupsController.removeContactInterest,
);
router.post(
  '/contacts/:id/opportunities',
  adminMarketingAuth,
  WebsitePopupsController.createContactOpportunity,
);
router.put(
  '/contacts/:id/opportunities/:opportunityId',
  adminMarketingAuth,
  WebsitePopupsController.updateContactOpportunity,
);
router.delete(
  '/contacts/:id/opportunities/:opportunityId',
  adminMarketingAuth,
  WebsitePopupsController.removeContactOpportunity,
);

/**
 * @openapi
 * /api/v1/website/popups:
 *   get:
 *     summary: Listar pop-ups para administração
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', adminMarketingAuth, WebsitePopupsController.list);

/**
 * @openapi
 * /api/v1/website/popups/{id}:
 *   get:
 *     summary: Buscar pop-up por ID
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', adminMarketingAuth, WebsitePopupsController.get);

/**
 * @openapi
 * /api/v1/website/popups:
 *   post:
 *     summary: Criar pop-up
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', adminMarketingAuth, WebsitePopupsController.create);

/**
 * @openapi
 * /api/v1/website/popups/{id}:
 *   put:
 *     summary: Atualizar pop-up
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', adminMarketingAuth, WebsitePopupsController.update);

/**
 * @openapi
 * /api/v1/website/popups/{id}:
 *   delete:
 *     summary: Remover pop-up
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', adminMarketingAuth, WebsitePopupsController.remove);

/**
 * @openapi
 * /api/v1/website/popups/{id}/contacts:
 *   post:
 *     summary: Registrar contato capturado por um pop-up
 *     tags: [Website]
 */
router.post('/:id/contacts', WebsitePopupsController.createContact);

export { router as websitePopupsRoutes };
