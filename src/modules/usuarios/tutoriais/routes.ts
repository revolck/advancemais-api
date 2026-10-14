import { Router } from 'express';
import { supabaseAuthMiddleware } from '../auth';
import {
  CHAVE_TUTORIAL,
  STATUS_TUTORIAL,
  listarTutoriais,
  registrarTutorial,
  type StatusTutorial,
} from './tutoriais.service';

/**
 * Estado dos tutoriais do assistente (ex.: tour de primeiro acesso).
 * Montado em /api/v1/usuarios/tutoriais. Fica no servidor para não repetir em outro aparelho.
 */
const router = Router();

/**
 * @openapi
 * /api/v1/usuarios/tutoriais:
 *   get:
 *     summary: Tutoriais do assistente já concluídos ou pulados pelo usuário logado
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Mapa chave → { status, em }"
 * /api/v1/usuarios/tutoriais/{chave}:
 *   put:
 *     summary: Marca um tutorial como CONCLUIDO ou PULADO
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [CONCLUIDO, PULADO] }
 *     responses:
 *       200:
 *         description: Registrado
 *       400:
 *         description: Chave ou status inválido
 */
router.get('/', supabaseAuthMiddleware(), async (req, res, next) => {
  try {
    res.json({ success: true, data: await listarTutoriais(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.put('/:chave', supabaseAuthMiddleware(), async (req, res, next) => {
  const { chave } = req.params;
  const status = req.body?.status as StatusTutorial;
  if (!CHAVE_TUTORIAL.test(chave) || !STATUS_TUTORIAL.includes(status)) {
    return res.status(400).json({
      success: false,
      code: 'TUTORIAL_INVALIDO',
      message: 'Chave ou status do tutorial inválido',
    });
  }
  try {
    res.json({ success: true, data: await registrarTutorial(req.user!.id, chave, status) });
  } catch (error) {
    next(error);
  }
});

export { router as tutoriaisRoutes };
