import { Router } from 'express';
import { z } from 'zod';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { prisma } from '@/config/prisma';

const router = Router();

const adminRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS];

const paramsSchema = z.object({
  recrutadorId: z.string().uuid(),
  vagaId: z.string().uuid().optional(),
});

const linkBodySchema = z.object({
  vagaId: z.string().uuid(),
});

/**
 * @openapi
 * /api/v1/usuarios/recrutadores/{recrutadorId}/vagas:
 *   get:
 *     summary: Listar vagas vinculadas ao recrutador (admin)
 *     tags: [Usuários, Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recrutadorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de vínculos recrutador↔vaga
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 */
router.get(
  '/recrutadores/:recrutadorId/vagas',
  supabaseAuthMiddleware(adminRoles),
  async (req, res) => {
    const { recrutadorId } = paramsSchema.parse(req.params);

    const vinculos = await prisma.usuariosVagasVinculos.findMany({
      where: { recrutadorId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        vagaId: true,
        criadoEm: true,
        atualizadoEm: true,
        EmpresasVagas: {
          select: {
            id: true,
            titulo: true,
            status: true,
            usuarioId: true,
            codigo: true,
            slug: true,
          },
        },
      },
    });

    return res.json({ success: true, data: vinculos });
  },
);

/**
 * @openapi
 * /api/v1/usuarios/recrutadores/{recrutadorId}/vagas:
 *   post:
 *     summary: Vincular recrutador a uma vaga (admin)
 *     description: |
 *       O recrutador precisa estar previamente vinculado à empresa dona da vaga.
 *       Este vínculo controla acesso do recrutador a candidatos/entrevistas/métricas daquela vaga.
 *     tags: [Usuários, Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recrutadorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vagaId]
 *             properties:
 *               vagaId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Vínculo criado/atualizado
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não vinculado à empresa da vaga
 *       404:
 *         description: Recrutador/vaga não encontrado
 */
router.post(
  '/recrutadores/:recrutadorId/vagas',
  supabaseAuthMiddleware(adminRoles),
  async (req, res) => {
    const { recrutadorId } = paramsSchema.parse(req.params);
    const payload = linkBodySchema.parse(req.body);

    const vinculo = await recrutadorVagasService.link({
      recrutadorId,
      vagaId: payload.vagaId,
    });

    return res.status(201).json({ success: true, vinculo });
  },
);

/**
 * @openapi
 * /api/v1/usuarios/recrutadores/{recrutadorId}/vagas/{vagaId}:
 *   delete:
 *     summary: Desvincular recrutador de uma vaga (admin)
 *     tags: [Usuários, Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recrutadorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Vínculo removido
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 */
router.delete(
  '/recrutadores/:recrutadorId/vagas/:vagaId',
  supabaseAuthMiddleware(adminRoles),
  async (req, res) => {
    const { recrutadorId, vagaId } = paramsSchema.parse(req.params);
    if (!vagaId) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR' });
    }

    await recrutadorVagasService.unlink({ recrutadorId, vagaId });
    return res.status(204).send();
  },
);

export default router;
