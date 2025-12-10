import { Router } from 'express';

import { planosEmpresariaisRoutes } from '@/modules/empresas/planos-empresariais';
import { clientesRoutes } from '@/modules/empresas/clientes';
import { vagasRoutes } from '@/modules/empresas/vagas';
import { adminEmpresasRoutes } from '@/modules/empresas/admin';
import { vagasSolicitacoesRoutes } from '@/modules/empresas/vagas-solicitacoes/routes';
import { visaoGeralRoutes } from '@/modules/empresas/visao-geral';
import { pagamentosRoutes } from '@/modules/empresas/pagamentos';
import { cartoesRoutes } from '@/modules/empresas/cartoes';
import { MinhaEmpresaController } from '@/modules/empresas/controllers/minha-empresa.controller';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';

const router = Router();

/**
 * @openapi
 * /api/v1/empresas/minha:
 *   get:
 *     summary: Obter dados da minha empresa (empresa autenticada)
 *     description: |
 *       Retorna os dados da empresa autenticada, incluindo informações do plano ativo,
 *       limites de vagas e dados cadastrais. O empresaId é extraído automaticamente do token JWT.
 *       Este endpoint é exclusivo para role EMPRESA - admins devem usar /api/v1/admin/empresas/{id}
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados da empresa retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 empresa:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     nome:
 *                       type: string
 *                     email:
 *                       type: string
 *                     cnpj:
 *                       type: string
 *                       nullable: true
 *                     telefone:
 *                       type: string
 *                       nullable: true
 *                     cidade:
 *                       type: string
 *                       nullable: true
 *                     estado:
 *                       type: string
 *                       nullable: true
 *                     plano:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         nome:
 *                           type: string
 *                         status:
 *                           type: string
 *                         quantidadeVagas:
 *                           type: integer
 *                     vagas:
 *                       type: object
 *                       properties:
 *                         publicadas:
 *                           type: integer
 *                         limitePlano:
 *                           type: integer
 *                           nullable: true
 *                         disponiveis:
 *                           type: integer
 *                           nullable: true
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado (role não é EMPRESA)
 *       404:
 *         description: Empresa não encontrada
 *       500:
 *         description: Erro interno do servidor
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Obter meus dados
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/empresas/minha" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/minha', supabaseAuthMiddleware([Roles.EMPRESA]), MinhaEmpresaController.get);

router.use('/planos-empresariais', planosEmpresariaisRoutes);
// Rota oficial para clientes (empresas vinculadas a planos pagos)
router.use('/clientes', clientesRoutes);
router.use('/vagas', vagasRoutes);
// Rotas de solicitações de publicação de vagas
router.use('/vagas/solicitacoes', vagasSolicitacoesRoutes);
// Rota de visão geral da empresa
router.use('/visao-geral', visaoGeralRoutes);
// Rota de histórico de pagamentos
router.use('/pagamentos', pagamentosRoutes);
// Rota de gerenciamento de cartões
router.use('/cartoes', cartoesRoutes);
// Centraliza operações administrativas sob o caminho principal de empresas
router.use('/', adminEmpresasRoutes);

export { router as empresasRoutes };
