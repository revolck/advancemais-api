import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';

import { areasInteresseRoutes } from '../areas-interesse/routes';

const router = Router();

/**
 * @openapi
 * /api/v1/candidatos:
 *   get:
 *     summary: Informações do módulo de Candidatos
 *     tags: [Candidatos]
 *     responses:
 *       200:
 *         description: Detalhes do módulo de candidatos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatosModuleInfo'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/candidatos"
 */
router.get('/', publicCache, (_req, res) => {
  res.json({
    message: 'Candidatos Module API',
    version: 'v1',
    timestamp: new Date().toISOString(),
    endpoints: {
      areasInteresse: '/areas-interesse',
    },
    status: 'operational',
  });
});

router.use('/areas-interesse', areasInteresseRoutes);

export { router as candidatosRoutes };
