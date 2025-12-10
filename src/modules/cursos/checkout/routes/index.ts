import { Router } from 'express';
import { CursosCheckoutController } from '../controllers/cursos-checkout.controller';

const router = Router();

/**
 * Rotas de checkout de cursos
 *
 * IMPORTANTE: Estas rotas são para pagamento ÚNICO de cursos
 * Para pagamentos recorrentes (planos empresariais), use /api/mercadopago/assinaturas
 */

// POST /api/cursos/checkout - Iniciar checkout de curso
router.post('/checkout', CursosCheckoutController.checkout);

// POST /api/cursos/checkout/webhook - Webhook do Mercado Pago
router.post('/checkout/webhook', CursosCheckoutController.webhook);

// GET /api/cursos/checkout/validar-token/:token - Validar token de acesso
router.get('/checkout/validar-token/:token', CursosCheckoutController.validarToken);

// GET /api/cursos/checkout/pagamento/:paymentId - Consultar status do pagamento
router.get('/checkout/pagamento/:paymentId', CursosCheckoutController.consultarPagamento);

// GET /api/cursos/:cursoId/turmas/:turmaId/vagas - Verificar vagas disponíveis
router.get('/:cursoId/turmas/:turmaId/vagas', CursosCheckoutController.verificarVagas);

export default router;
