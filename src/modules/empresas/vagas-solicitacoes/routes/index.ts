import { Router } from 'express';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { asyncHandler } from '@/utils/asyncHandler';
import { SolicitacoesController } from '../controllers/solicitacoes.controller';
import { MetricasController } from '../controllers/metricas.controller';

const router = Router();

const allowedRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS];

/**
 * @openapi
 * /api/v1/vagas/solicitacoes:
 *   get:
 *     summary: Listar solicitações de publicação de vagas
 *     description: |
 *       Lista solicitações de publicação de vagas pendentes de aprovação.
 *       As solicitações são vagas com status EM_ANALISE.
 *       Disponível para ADMIN, MODERADOR e SETOR_DE_VAGAS.
 *     tags: [Vagas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtro por status (PENDENTE, APROVADA, REJEITADA, CANCELADA) separados por vírgula
 *       - in: query
 *         name: empresaId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtro por empresa
 *       - in: query
 *         name: criadoDe
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data inicial de criação
 *       - in: query
 *         name: criadoAte
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data final de criação
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           minimum: 3
 *         description: Busca por título da vaga ou nome da empresa
 *     responses:
 *       200:
 *         description: Lista de solicitações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       codigo:
 *                         type: string
 *                         example: "SOL-001"
 *                       vaga:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           titulo:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                       empresa:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nome:
 *                             type: string
 *                           codigo:
 *                             type: string
 *                       solicitante:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           nome:
 *                             type: string
 *                       status:
 *                         type: string
 *                         enum: [PENDENTE, APROVADA, REJEITADA, CANCELADA]
 *                       dataSolicitacao:
 *                         type: string
 *                         format: date-time
 *                       dataResposta:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       motivoRejeicao:
 *                         type: string
 *                         nullable: true
 *                       observacoes:
 *                         type: string
 *                         nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro interno
 */
/**
 * @openapi
 * /api/v1/vagas/solicitacoes/{id}:
 *   get:
 *     summary: Visualizar detalhes completos de uma solicitação
 *     description: |
 *       Retorna todos os detalhes da solicitação de publicação de vaga, incluindo:
 *       - Informações completas da vaga (título, descrição, requisitos, atividades, benefícios, localização, salário, etc.)
 *       - Informações completas da empresa (CNPJ, avatar, localização, endereços, redes sociais, etc.)
 *       - Candidaturas recebidas (se houver)
 *       - Processos seletivos vinculados (se houver)
 *       Disponível para ADMIN, MODERADOR e SETOR_DE_VAGAS.
 *     tags: [Vagas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da solicitação (ID da vaga)
 *     responses:
 *       200:
 *         description: Detalhes completos da solicitação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminVagaDetalhe'
 *       404:
 *         description: Solicitação não encontrada
 *       500:
 *         description: Erro interno
 */
router.get('/:id', supabaseAuthMiddleware(allowedRoles), asyncHandler(SolicitacoesController.get));

router.get('/', supabaseAuthMiddleware(allowedRoles), asyncHandler(SolicitacoesController.list));

/**
 * @openapi
 * /api/v1/vagas/solicitacoes/{id}/aprovar:
 *   put:
 *     summary: Aprovar solicitação de publicação
 *     description: |
 *       Aprova uma solicitação de publicação de vaga.
 *       Altera o status da vaga de EM_ANALISE para PUBLICADO.
 *       Disponível para ADMIN, MODERADOR e SETOR_DE_VAGAS.
 *     tags: [Vagas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da solicitação (ID da vaga)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observacoes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Observações opcionais do aprovador
 *     responses:
 *       200:
 *         description: Solicitação aprovada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Solicitação aprovada com sucesso"
 *       400:
 *         description: Solicitação não está pendente
 *       404:
 *         description: Solicitação não encontrada
 *       500:
 *         description: Erro interno
 */
router.put('/:id/aprovar', supabaseAuthMiddleware(allowedRoles), SolicitacoesController.aprovar);

/**
 * @openapi
 * /api/v1/vagas/solicitacoes/{id}/rejeitar:
 *   put:
 *     summary: Rejeitar solicitação de publicação
 *     description: |
 *       Rejeita uma solicitação de publicação de vaga.
 *       Altera o status da vaga de EM_ANALISE para DESPUBLICADA.
 *       Disponível para ADMIN, MODERADOR e SETOR_DE_VAGAS.
 *     tags: [Vagas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da solicitação (ID da vaga)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - motivoRejeicao
 *             properties:
 *               motivoRejeicao:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Solicitação rejeitada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Solicitação rejeitada"
 *       400:
 *         description: Solicitação não está pendente ou dados inválidos
 *       404:
 *         description: Solicitação não encontrada
 *       500:
 *         description: Erro interno
 */
router.put('/:id/rejeitar', supabaseAuthMiddleware(allowedRoles), SolicitacoesController.rejeitar);

export { router as vagasSolicitacoesRoutes };
