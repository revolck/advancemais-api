import { Router } from 'express';

import { VagasProcessosController } from '@/modules/empresas/vagas-processos/controllers/vagas-processos.controller';

const router = Router({ mergeParams: true });

/**
 * @openapi
 * /api/v1/empresas/vagas/{vagaId}/processos:
 *   get:
 *     summary: Listar processos seletivos da vaga
 *     description: "Retorna todos os processos seletivos vinculados a uma vaga específica. Permite filtrar por status, origem e candidato."
 *     tags: [Empresas - VagasProcessos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identificador da vaga.
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           example: RECEBIDA,EM_ANALISE
 *         description: Lista de status separados por vírgula.
 *       - in: query
 *         name: origem
 *         required: false
 *         schema:
 *           type: string
 *           example: SITE,DASHBOARD
 *         description: Lista de origens separados por vírgula.
 *       - in: query
 *         name: candidatoId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtra processos por candidato específico.
 *     responses:
 *       200:
 *         description: Lista de processos seletivos da vaga.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lista de processos seletivos vinculados à vaga.
 *                 vagaId:
 *                   type: string
 *                   format: uuid
 *                 total:
 *                   type: integer
 *                 processos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VagaProcesso'
 *       400:
 *         description: Parâmetros inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Token inválido ou ausente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       404:
 *         description: Vaga não encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao listar processos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/empresas/vagas/{vagaId}/processos" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/', VagasProcessosController.list);

/**
 * @openapi
 * /api/v1/empresas/vagas/{vagaId}/processos:
 *   post:
 *     summary: Criar novo processo seletivo para a vaga
 *     description: "Cria um processo seletivo para um candidato em uma vaga específica."
 *     tags: [Empresas - VagasProcessos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VagaProcessoCreateInput'
 *     responses:
 *       201:
 *         description: Processo criado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Processo seletivo criado com sucesso.
 *                 processo:
 *                   $ref: '#/components/schemas/VagaProcesso'
 *       400:
 *         description: Dados inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Token inválido ou ausente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       404:
 *         description: Vaga ou candidato não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Processo duplicado para o candidato na vaga.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao criar processo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/empresas/vagas/{vagaId}/processos" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "candidatoId": "candidate-uuid",
 *                  "status": "RECEBIDA",
 *                  "origem": "SITE"
 *                }'
 */
router.post('/', VagasProcessosController.create);

/**
 * @openapi
 * /api/v1/empresas/vagas/{vagaId}/processos/{processoId}:
 *   get:
 *     summary: Consultar processo seletivo específico
 *     description: Retorna os detalhes de um processo seletivo associado a uma vaga.
 *     tags: [Empresas - VagasProcessos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: processoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Processo retornado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Processo seletivo recuperado com sucesso.
 *                 processo:
 *                   $ref: '#/components/schemas/VagaProcesso'
 *       400:
 *         description: Parâmetros inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Token inválido ou ausente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       404:
 *         description: Processo não encontrado para a vaga.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao buscar processo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/empresas/vagas/{vagaId}/processos/{processoId}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/:processoId', VagasProcessosController.get);

/**
 * @openapi
 * /api/v1/empresas/vagas/{vagaId}/processos/{processoId}:
 *   patch:
 *     summary: Atualizar processo seletivo da vaga
 *     description: Atualiza status, origem ou observações de um processo seletivo existente.
 *     tags: [Empresas - VagasProcessos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: processoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VagaProcessoUpdateInput'
 *     responses:
 *       200:
 *         description: Processo atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Processo seletivo atualizado com sucesso.
 *                 processo:
 *                   $ref: '#/components/schemas/VagaProcesso'
 *       400:
 *         description: Dados inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Token inválido ou ausente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       404:
 *         description: Processo não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao atualizar processo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PATCH "http://localhost:3000/api/v1/empresas/vagas/{vagaId}/processos/{processoId}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "status": "ENTREVISTA",
 *                  "origem": "DASHBOARD",
 *                  "observacoes": "Entrevista agendada com o time de tecnologia."
 *                }'
 */
router.patch('/:processoId', VagasProcessosController.update);

/**
 * @openapi
 * /api/v1/empresas/vagas/{vagaId}/processos/{processoId}:
 *   delete:
 *     summary: Remover processo seletivo da vaga
 *     description: Remove definitivamente um processo seletivo vinculado à vaga.
 *     tags: [Empresas - VagasProcessos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: processoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Processo removido com sucesso.
 *       400:
 *         description: Parâmetros inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Token inválido ou ausente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       404:
 *         description: Processo não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao remover processo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/empresas/vagas/{vagaId}/processos/{processoId}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:processoId', VagasProcessosController.remove);

export { router as vagasProcessosRoutes };
