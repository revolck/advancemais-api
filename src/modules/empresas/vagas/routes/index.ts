import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { VagasController } from '@/modules/empresas/vagas/controllers/vagas.controller';

const router = Router();
const protectedRoles = ['ADMIN', 'MODERADOR', 'EMPRESA', 'RECRUTADOR'];

/**
 * @openapi
 * /api/v1/empresas/vagas:
 *   get:
 *     summary: Listar vagas publicadas
 *     description: Retorna apenas as vagas com status PUBLICADO disponíveis para visualização pública.
 *     tags: [Empresas - Vagas]
 *     responses:
 *       200:
 *         description: Lista de vagas cadastradas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vaga'
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
 *           curl -X GET "http://localhost:3000/api/v1/empresas/vagas"
 */
router.get('/', publicCache, VagasController.list);

/**
 * @openapi
 * /api/v1/empresas/vagas/{id}:
 *   get:
 *     summary: Obter vaga por ID
 *     description: Recupera os detalhes de uma vaga PUBLICADA. O conteúdo é público e preserva o anonimato das empresas quando configurado.
 *     tags: [Empresas - Vagas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vaga encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vaga'
 *       404:
 *         description: Vaga não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *           curl -X GET "http://localhost:3000/api/v1/empresas/vagas/{id}"
 */
router.get('/:id', publicCache, VagasController.get);

/**
 * @openapi
 * /api/v1/empresas/vagas:
 *   post:
 *     summary: Criar uma nova vaga
 *     description: Disponível para administradores, moderadores, empresas e recrutadores autenticados. Permite cadastrar vagas vinculadas a uma empresa e envia automaticamente o registro para a fila de revisão com status EM_ANALISE.
 *     tags: [Empresas - Vagas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VagaCreateInput'
 *     responses:
 *       201:
 *         description: Vaga criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vaga'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       404:
 *         description: Empresa não encontrada para vinculação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *           curl -X POST "http://localhost:3000/api/v1/empresas/vagas" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "empresaId": "f1d7a9c2-4e0b-4f6d-90ad-8c6b84a0f1a1",
 *                  "modoAnonimo": true,
 *                  "regimeDeTrabalho": "CLT",
 *                  "modalidade": "PRESENCIAL",
 *                  "paraPcd": true,
 *                  "requisitos": "Experiência prévia com atendimento ao cliente e pacote Office.",
 *                  "atividades": "Atendimento ao público, abertura de chamados e acompanhamento de demandas.",
 *                  "beneficios": "Vale transporte, vale alimentação e plano de saúde.",
 *                  "observacoes": "Processo seletivo confidencial.",
 *                  "cargaHoraria": "44 horas semanais (segunda a sexta)",
 *                  "inscricoesAte": "2024-12-20T23:59:59.000Z"
 *                }'
 */
router.post('/', supabaseAuthMiddleware(protectedRoles), VagasController.create);

/**
 * @openapi
 * /api/v1/empresas/vagas/{id}:
 *   put:
 *     summary: Atualizar vaga
 *     description: Permite editar os dados de uma vaga existente, incluindo o status do fluxo (RASCUNHO, EM_ANALISE, PUBLICADO ou EXPIRADO). Requer autenticação com perfil autorizado.
 *     tags: [Empresas - Vagas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VagaUpdateInput'
 *     responses:
 *       200:
 *         description: Vaga atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vaga'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       404:
 *         description: Vaga ou empresa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *           curl -X PUT "http://localhost:3000/api/v1/empresas/vagas/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "modoAnonimo": false,
 *                  "beneficios": "Vale transporte, vale alimentação, plano de saúde e day-off no aniversário.",
 *                  "observacoes": "Processo seletivo com etapas online.",
 *                  "status": "PUBLICADO"
 *                }'
 */
router.put('/:id', supabaseAuthMiddleware(protectedRoles), VagasController.update);

/**
 * @openapi
 * /api/v1/empresas/vagas/{id}:
 *   delete:
 *     summary: Remover vaga
 *     description: Exclui uma vaga cadastrada. Requer autenticação com perfil autorizado.
 *     tags: [Empresas - Vagas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Vaga removida com sucesso
 *       404:
 *         description: Vaga não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *           curl -X DELETE "http://localhost:3000/api/v1/empresas/vagas/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(protectedRoles), VagasController.remove);

export { router as vagasRoutes };
