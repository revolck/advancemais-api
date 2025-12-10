import { Router } from 'express';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { MetricasController } from '@/modules/empresas/vagas-solicitacoes/controllers/metricas.controller';

const router = Router();

const allowedRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS];

/**
 * @openapi
 * /api/v1/dashboard/setor-de-vagas/metricas:
 *   get:
 *     summary: Métricas consolidadas do Setor de Vagas
 *     description: |
 *       Retorna métricas consolidadas para o dashboard do Setor de Vagas.
 *       Inclui informações sobre empresas, vagas, candidatos e solicitações.
 *       Disponível para ADMIN, MODERADOR e SETOR_DE_VAGAS.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metricasGerais:
 *                   type: object
 *                   properties:
 *                     totalEmpresas:
 *                       type: integer
 *                       example: 45
 *                     empresasAtivas:
 *                       type: integer
 *                       example: 38
 *                     totalVagas:
 *                       type: integer
 *                       example: 127
 *                     vagasAbertas:
 *                       type: integer
 *                       example: 42
 *                     vagasPendentes:
 *                       type: integer
 *                       example: 8
 *                     vagasEncerradas:
 *                       type: integer
 *                       example: 77
 *                     totalCandidatos:
 *                       type: integer
 *                       example: 892
 *                     candidatosEmProcesso:
 *                       type: integer
 *                       example: 156
 *                     candidatosContratados:
 *                       type: integer
 *                       example: 234
 *                     solicitacoesPendentes:
 *                       type: integer
 *                       example: 8
 *                     solicitacoesAprovadasHoje:
 *                       type: integer
 *                       example: 5
 *                     solicitacoesRejeitadasHoje:
 *                       type: integer
 *                       example: 2
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro interno
 */
router.get(
  '/setor-de-vagas/metricas',
  supabaseAuthMiddleware(allowedRoles),
  MetricasController.getMetricas,
);

export default router;
