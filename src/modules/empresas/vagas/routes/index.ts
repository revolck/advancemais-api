import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';
import { supabaseAuthMiddleware, optionalSupabaseAuth } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { VagasController } from '@/modules/empresas/vagas/controllers/vagas.controller';
import { vagasProcessosRoutes } from '@/modules/empresas/vagas-processos';

const router = Router();
const protectedRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.EMPRESA, Roles.RECRUTADOR];
const updateRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.RECRUTADOR];

/**
 * @openapi
 * /api/v1/empresas/vagas:
 *   get:
 *     summary: Listar vagas publicadas
 *     description: "Retorna as vagas disponíveis para visualização. Por padrão, apenas vagas PUBLICADAS são retornadas. É possível filtrar por status via query string. Consultas envolvendo os status RASCUNHO, EM_ANALISE, DESPUBLICADA, PAUSADA ou ENCERRADA exigem autenticação com roles válidas (ADMIN, MODERADOR, EMPRESA, RECRUTADOR ou ALUNO_CANDIDATO)."
 *     tags: [Empresas - EmpresasVagas]
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           example: PUBLICADO,EM_ANALISE
 *         description: "Filtra por um ou mais status separados por vírgula. Aceita RASCUNHO, EM_ANALISE, PUBLICADO, DESPUBLICADA, PAUSADA, ENCERRADA ou EXPIRADO. Use ALL/TODAS/TODOS para trazer todos os status."
 *       - in: query
 *         name: usuarioId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Filtra vagas por usuarioId (empresa responsável pela vaga)"
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         description: "Página de resultados (inicia em 1). Quando não informado, todos os registros elegíveis são retornados."
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 10
 *         description: "Quantidade de itens por página (máx. 100). Quando omitido, nenhuma paginação é aplicada."
 *     responses:
 *       200:
 *         description: Lista de vagas cadastradas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vaga'
 *       401:
 *         description: Token inválido ou ausente ao consultar vagas restritas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado ao consultar vagas restritas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
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
 *       - lang: cURL
 *         label: Consultar vagas EM_ANALISE (autenticado)
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/empresas/vagas?status=EM_ANALISE" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/', optionalSupabaseAuth(), publicCache, VagasController.list);

/**
 * @openapi
 * /api/v1/empresas/vagas/{id}:
 *   get:
 *     summary: Obter vaga por ID
 *     description: Recupera os detalhes de uma vaga PUBLICADA. O conteúdo é público e preserva o anonimato das empresas quando configurado.
 *     tags: [Empresas - EmpresasVagas]
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
router.use('/:vagaId/processos', supabaseAuthMiddleware(protectedRoles), vagasProcessosRoutes);

router.get('/:id', publicCache, VagasController.get);

/**
 * @openapi
 * /api/v1/empresas/vagas:
 *   post:
 *     summary: Criar uma nova vaga
 *     description: "Disponível para administradores, moderadores, empresas e recrutadores autenticados (roles: ADMIN, MODERADOR, EMPRESA, RECRUTADOR). Permite cadastrar vagas vinculadas a uma empresa, gera um código alfanumérico curto para facilitar a identificação e envia automaticamente o registro para a fila de revisão com status EM_ANALISE."
 *     tags: [Empresas - EmpresasVagas]
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
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       404:
 *         description: Empresa não encontrada para vinculação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Acesso negado (empresa sem plano ativo, plano sem suporte a destaque ou perfil sem permissão)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/EmpresaSemPlanoAtivoResponse'
 *                 - $ref: '#/components/schemas/PlanoSemRecursoDestaqueResponse'
 *                 - $ref: '#/components/schemas/ForbiddenResponse'
 *       409:
 *         description: Limite de vagas simultâneas ou vagas em destaque do plano atingido
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/PlanoClienteLimiteVagasResponse'
 *                 - $ref: '#/components/schemas/PlanoClienteLimiteVagasDestaqueResponse'
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
 *                  "usuarioId": "f1d7a9c2-4e0b-4f6d-90ad-8c6b84a0f1a1",
 *                  "areaInteresseId": 3,
 *                  "subareaInteresseId": 7,
 *                  "slug": "analista-sistemas-pleno-sao-paulo",
 *                  "modoAnonimo": true,
 *                  "regimeDeTrabalho": "CLT",
 *                  "modalidade": "PRESENCIAL",
 *                  "titulo": "Analista de Sistemas",
 *                  "paraPcd": true,
 *                  "numeroVagas": 2,
 *                  "descricao": "Responsável pelo suporte técnico e evolução dos sistemas internos da empresa.",
 *                  "requisitos": {
 *                    "obrigatorios": ["Experiência com suporte N2", "Conhecimento em ITIL"],
 *                    "desejaveis": ["Certificação COBIT"]
 *                  },
 *                  "atividades": {
 *                    "principais": [
 *                      "Monitorar chamados e garantir SLA",
 *                      "Atuar na análise de problemas técnicos"
 *                    ],
 *                    "extras": ["Apoiar treinamentos internos"]
 *                  },
 *                  "beneficios": {
 *                    "lista": ["Vale transporte", "Vale alimentação", "Plano de saúde"],
 *                    "observacoes": "Modelo híbrido com auxílio home office"
 *                  },
 *                  "observacoes": "Processo seletivo confidencial.",
 *                  "jornada": "INTEGRAL",
 *                  "senioridade": "PLENO",
 *                  "localizacao": {
 *                    "cidade": "São Paulo",
 *                    "estado": "SP"
 *                  },
 *                  "salarioMin": "4500.00",
 *                  "salarioMax": "6500.00",
 *                  "salarioConfidencial": false,
 *                  "maxCandidaturasPorUsuario": 1,
 *                  "inscricoesAte": "2024-12-20T23:59:59.000Z",
 *                  "vagaEmDestaque": true
 *                }'
 */
router.post('/', supabaseAuthMiddleware(protectedRoles), VagasController.create);

/**
 * @openapi
 * /api/v1/empresas/vagas/{id}:
 *   put:
 *     summary: Atualizar vaga
 *     description: "Permite editar os dados de uma vaga existente, incluindo o status do fluxo (RASCUNHO, EM_ANALISE, PUBLICADO, DESPUBLICADA, PAUSADA, EXPIRADO ou ENCERRADA). Requer autenticação com perfil autorizado (roles: ADMIN, MODERADOR ou RECRUTADOR)."
 *     tags: [Empresas - EmpresasVagas]
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
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       404:
 *         description: Vaga ou empresa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       409:
 *         description: Limite de vagas em destaque do plano atingido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanoClienteLimiteVagasDestaqueResponse'
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
 *                  "titulo": "Analista de Sistemas Pleno",
 *                  "areaInteresseId": 3,
 *                  "subareaInteresseId": 8,
 *                  "slug": "analista-sistemas-pleno-sao-paulo",
 *                  "numeroVagas": 3,
 *                  "descricao": "Atuação no planejamento e na evolução dos sistemas corporativos.",
 *                  "requisitos": {
 *                    "obrigatorios": ["Experiência com bancos de dados relacionais"],
 *                    "desejaveis": ["Vivência com cloud"]
 *                  },
 *                  "atividades": {
 *                    "principais": [
 *                      "Acompanhar roadmap de produtos",
 *                      "Conduzir diagnósticos técnicos"
 *                    ]
 *                  },
 *                  "beneficios": {
 *                    "lista": ["Vale refeição", "Plano odontológico"]
 *                  },
 *                  "salarioMin": "5000.00",
 *                  "salarioMax": "7000.00",
 *                  "salarioConfidencial": false,
 *                  "maxCandidaturasPorUsuario": 1,
 *                  "status": "PUBLICADO",
 *                  "inseridaEm": "2024-10-10T09:00:00Z",
 *                  "vagaEmDestaque": false
 *                }'
 */
router.put('/:id', supabaseAuthMiddleware(updateRoles), VagasController.update);

/**
 * @openapi
 * /api/v1/empresas/vagas/{id}:
 *   delete:
 *     summary: Remover vaga
 *     description: "Exclui uma vaga cadastrada. Requer autenticação com perfil autorizado (roles: ADMIN, MODERADOR, EMPRESA ou RECRUTADOR)."
 *     tags: [Empresas - EmpresasVagas]
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
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
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
