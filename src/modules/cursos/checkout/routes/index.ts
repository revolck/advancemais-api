import { Router } from 'express';
import { Roles } from '@prisma/client';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { CursosCheckoutController } from '../controllers/cursos-checkout.controller';

const router = Router();

/**
 * Rotas de checkout de cursos
 *
 * IMPORTANTE: Estas rotas são para pagamento ÚNICO de cursos
 * Para pagamentos recorrentes (planos empresariais), use /api/mercadopago/assinaturas
 */

// POST /api/cursos/checkout - Iniciar checkout de curso
router.post(
  '/checkout',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CursosCheckoutController.checkout,
);

// POST /api/cursos/checkout/webhook - Webhook do Mercado Pago
router.post('/checkout/webhook', CursosCheckoutController.webhook);

// GET /api/cursos/checkout/validar-token/:token - Validar token de acesso
router.get('/checkout/validar-token/:token', CursosCheckoutController.validarToken);

// GET /api/cursos/checkout/pagamento/:paymentId - Consultar status do pagamento
router.get(
  '/checkout/pagamento/:paymentId',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CursosCheckoutController.consultarPagamento,
);

// POST /api/cursos/checkout/pagamento/:paymentId/cancelar - Cancelar checkout pendente
router.post(
  '/checkout/pagamento/:paymentId/cancelar',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CursosCheckoutController.cancelarPagamento,
);

// GET /api/cursos/:cursoId/turmas/:turmaId/vagas - Verificar vagas disponíveis
router.get('/:cursoId/turmas/:turmaId/vagas', CursosCheckoutController.verificarVagas);

export default router;
