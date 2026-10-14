import { Router, type NextFunction, type Response } from 'express';
import { Roles } from '@prisma/client';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import {
  aplicarBonificacao,
  marcarBonificacaoExibida,
  previsualizarBonificacao,
  situacaoDaEmpresa,
} from './bonificacao-inauguracao.service';

/**
 * Bonificação de inauguração (1 mês grátis para as empresas).
 * Montado em /api/v1/empresas/bonificacao.
 */
const router = Router();

function responderErro(res: Response, next: NextFunction, error: unknown) {
  const { statusCode, code, message } = (error ?? {}) as {
    statusCode?: number;
    code?: string;
    message?: string;
  };
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ success: false, code, message });
  }
  return next(error);
}

/**
 * @openapi
 * /api/v1/empresas/bonificacao/minha:
 *   get:
 *     summary: Bonificação e plano gratuito da empresa logada
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ bonificacao, gratuitoExpirado }"
 * /api/v1/empresas/bonificacao/minha/exibida:
 *   post:
 *     summary: Marca o aviso da bonificação como exibido
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Marcado
 * /api/v1/empresas/bonificacao/inauguracao:
 *   get:
 *     summary: Prévia da bonificação de inauguração (quantas empresas recebem)
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prévia
 * /api/v1/empresas/bonificacao/inauguracao/aplicar:
 *   post:
 *     summary: Aplica a bonificação (idempotente; pode rodar de novo para empresas novas)
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quantos planos foram criados e convertidos
 *       409:
 *         description: Já está sendo aplicada ou a campanha terminou
 */
router.get('/minha', supabaseAuthMiddleware([Roles.EMPRESA]), async (req, res, next) => {
  try {
    res.json({ success: true, data: await situacaoDaEmpresa(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/minha/exibida', supabaseAuthMiddleware([Roles.EMPRESA]), async (req, res, next) => {
  try {
    res.json({ success: true, data: await marcarBonificacaoExibida(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.get('/inauguracao', supabaseAuthMiddleware([Roles.ADMIN]), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await previsualizarBonificacao() });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/inauguracao/aplicar',
  supabaseAuthMiddleware([Roles.ADMIN]),
  async (req, res, next) => {
    try {
      res.json({ success: true, data: await aplicarBonificacao({ actorId: req.user?.id }) });
    } catch (error) {
      responderErro(res, next, error);
    }
  },
);

export { router as bonificacaoRoutes };
