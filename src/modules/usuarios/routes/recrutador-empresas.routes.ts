import { Router } from 'express';
import { z } from 'zod';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { recrutadorEmpresasService } from '@/modules/usuarios/services/recrutador-empresas.service';

const router = Router();

const adminRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS];

const paramsSchema = z.object({
  recrutadorId: z.string().uuid(),
  empresaUsuarioId: z.string().uuid().optional(),
});

const linkBodySchema = z.object({
  empresaUsuarioId: z.string().uuid(),
});

/**
 * @openapi
 * /api/v1/usuarios/recrutadores/{recrutadorId}/empresas:
 *   get:
 *     summary: Listar empresas vinculadas ao recrutador (admin)
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
 *         description: Lista de empresas vinculadas
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 */
router.get(
  '/recrutadores/:recrutadorId/empresas',
  supabaseAuthMiddleware(adminRoles),
  async (req, res) => {
    const { recrutadorId } = paramsSchema.parse(req.params);
    const empresas = await recrutadorEmpresasService.listEmpresas(recrutadorId);
    return res.json({ success: true, data: empresas });
  },
);

/**
 * @openapi
 * /api/v1/usuarios/recrutadores/{recrutadorId}/empresas:
 *   post:
 *     summary: Vincular recrutador a uma empresa (admin)
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
 *             required: [empresaUsuarioId]
 *             properties:
 *               empresaUsuarioId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Vínculo criado/atualizado
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Recrutador/empresa não encontrado
 */
router.post(
  '/recrutadores/:recrutadorId/empresas',
  supabaseAuthMiddleware(adminRoles),
  async (req, res) => {
    const { recrutadorId } = paramsSchema.parse(req.params);
    const payload = linkBodySchema.parse(req.body);
    const vinculo = await recrutadorEmpresasService.link({
      recrutadorId,
      empresaUsuarioId: payload.empresaUsuarioId,
      criadoPor: (req as any).user?.id ?? null,
    });
    return res.status(201).json({ success: true, vinculo });
  },
);

/**
 * @openapi
 * /api/v1/usuarios/recrutadores/{recrutadorId}/empresas/{empresaUsuarioId}:
 *   delete:
 *     summary: Desvincular recrutador de uma empresa (admin)
 *     tags: [Usuários, Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recrutadorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: empresaUsuarioId
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
  '/recrutadores/:recrutadorId/empresas/:empresaUsuarioId',
  supabaseAuthMiddleware(adminRoles),
  async (req, res) => {
    const { recrutadorId, empresaUsuarioId } = paramsSchema.parse(req.params);
    if (!empresaUsuarioId) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR' });
    }
    await recrutadorEmpresasService.unlink({ recrutadorId, empresaUsuarioId });
    return res.status(204).send();
  },
);

export default router;
