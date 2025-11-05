import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';
import { supabaseAuthMiddleware, optionalSupabaseAuth } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { VagasCategoriasController } from '@/modules/empresas/vagas/controllers/categorias.controller';
import { VagasController } from '@/modules/empresas/vagas/controllers/vagas.controller';
import { vagasProcessosRoutes } from '@/modules/empresas/vagas-processos';

const router = Router();
const protectedRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.EMPRESA, Roles.SETOR_DE_VAGAS];
const updateRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS];
const categoriaAdminRoles = [Roles.ADMIN, Roles.MODERADOR];

/**
 * @openapi
 * /api/v1/empresas/vagas/categorias:
 *   get:
 *     summary: Listar categorias de vagas
 *     description: "Retorna todas as categorias de vagas disponíveis com suas subcategorias relacionadas. Endpoint público, não requer autenticação."
 *     tags: [Empresas]
 *     responses:
 *       200:
 *         description: Lista de categorias de vagas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmpresasVagaCategoria'
 *       500:
 *         description: Erro ao listar categorias
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/empresas/vagas/categorias"
 */
router.get('/categorias', publicCache, VagasCategoriasController.list);

/**
 * @openapi
 * /api/v1/empresas/vagas/categorias:
 *   post:
 *     summary: Criar categoria de vaga
 *     description: "Disponível apenas para administradores e moderadores. Permite cadastrar uma nova categoria para organização das vagas."
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresasVagaCategoriaCreateInput'
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresasVagaCategoria'
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
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       409:
 *         description: Categoria duplicada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro ao criar categoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/empresas/vagas/categorias" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"nome":"Tecnologia","descricao":"Vagas na área de TI"}'
 */
router.post(
  '/categorias',
  supabaseAuthMiddleware(categoriaAdminRoles),
  VagasCategoriasController.create,
);

/**
 * @openapi
 * /api/v1/empresas/vagas/categorias/{categoriaId}:
 *   get:
 *     summary: Obter categoria de vaga por ID
 *     description: Recupera os detalhes de uma categoria de vaga com suas subcategorias. Endpoint público.
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Categoria encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresasVagaCategoria'
 *       400:
 *         description: Identificador inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Categoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro ao buscar categoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/empresas/vagas/categorias/{categoriaId}"
 */
router.get('/categorias/:categoriaId', publicCache, VagasCategoriasController.get);

/**
 * @openapi
 * /api/v1/empresas/vagas/categorias/{categoriaId}:
 *   put:
 *     summary: Atualizar categoria de vaga
 *     description: "Disponível apenas para administradores e moderadores. Permite atualizar nome e descrição da categoria."
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresasVagaCategoriaUpdateInput'
 *     responses:
 *       200:
 *         description: Categoria atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresasVagaCategoria'
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
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Categoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Categoria em uso ou duplicada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro ao atualizar categoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/empresas/vagas/categorias/{categoriaId}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"nome":"Tecnologia e Inovação"}'
 */
router.put(
  '/categorias/:categoriaId',
  supabaseAuthMiddleware(categoriaAdminRoles),
  VagasCategoriasController.update,
);

/**
 * @openapi
 * /api/v1/empresas/vagas/categorias/{categoriaId}:
 *   delete:
 *     summary: Remover categoria de vaga
 *     description: "Disponível apenas para administradores e moderadores. Remove a categoria caso não existam vínculos ativos."
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Categoria removida com sucesso
 *       400:
 *         description: Identificador inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Categoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Categoria em uso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro ao remover categoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/empresas/vagas/categorias/{categoriaId}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  '/categorias/:categoriaId',
  supabaseAuthMiddleware(categoriaAdminRoles),
  VagasCategoriasController.remove,
);

/**
 * @openapi
 * /api/v1/empresas/vagas/categorias/{categoriaId}/subcategorias:
 *   post:
 *     summary: Criar subcategoria de vaga
 *     description: "Disponível apenas para administradores e moderadores. Permite cadastrar uma subcategoria vinculada à categoria informada."
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoriaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresasVagaSubcategoriaCreateInput'
 *     responses:
 *       201:
 *         description: Subcategoria criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresasVagaSubcategoria'
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
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Categoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Subcategoria duplicada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro ao criar subcategoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/empresas/vagas/categorias/{categoriaId}/subcategorias" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"nome":"Backend","descricao":"Desenvolvimento de APIs"}'
 */
router.post(
  '/categorias/:categoriaId/subcategorias',
  supabaseAuthMiddleware(categoriaAdminRoles),
  VagasCategoriasController.createSubcategoria,
);

/**
 * @openapi
 * /api/v1/empresas/vagas/subcategorias/{subcategoriaId}:
 *   put:
 *     summary: Atualizar subcategoria de vaga
 *     description: "Disponível apenas para administradores e moderadores. Permite atualizar nome e descrição da subcategoria."
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subcategoriaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresasVagaSubcategoriaUpdateInput'
 *     responses:
 *       200:
 *         description: Subcategoria atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresasVagaSubcategoria'
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
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Subcategoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Subcategoria em uso ou duplicada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro ao atualizar subcategoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/empresas/vagas/subcategorias/{subcategoriaId}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"nome":"Desenvolvimento Backend"}'
 */
router.put(
  '/subcategorias/:subcategoriaId',
  supabaseAuthMiddleware(categoriaAdminRoles),
  VagasCategoriasController.updateSubcategoria,
);

/**
 * @openapi
 * /api/v1/empresas/vagas/subcategorias/{subcategoriaId}:
 *   delete:
 *     summary: Remover subcategoria de vaga
 *     description: "Disponível apenas para administradores e moderadores. Remove a subcategoria caso não existam vínculos ativos."
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subcategoriaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Subcategoria removida com sucesso
 *       400:
 *         description: Identificador inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Subcategoria não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Subcategoria em uso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro ao remover subcategoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/empresas/vagas/subcategorias/{subcategoriaId}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  '/subcategorias/:subcategoriaId',
  supabaseAuthMiddleware(categoriaAdminRoles),
  VagasCategoriasController.removeSubcategoria,
);

/**
 * @openapi
 * /api/v1/empresas/vagas:
 *   get:
 *     summary: Listar vagas publicadas
 *     description: "Retorna as vagas disponíveis para visualização. Por padrão, apenas vagas PUBLICADAS são retornadas. É possível filtrar por status via query string. Consultas envolvendo os status RASCUNHO, EM_ANALISE, DESPUBLICADA, PAUSADA ou ENCERRADA exigem autenticação com roles válidas (ADMIN, MODERADOR, EMPRESA, SETOR_DE_VAGAS ou ALUNO_CANDIDATO)."
 *     tags: [Empresas]
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
 *     tags: [Empresas]
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
 *     description: "Disponível para administradores, moderadores, empresas e setor de vagas autenticados (roles: ADMIN, MODERADOR, EMPRESA, SETOR_DE_VAGAS). Permite cadastrar vagas vinculadas a uma empresa, gera um código alfanumérico curto para facilitar a identificação e envia automaticamente o registro para a fila de revisão com status EM_ANALISE."
 *     tags: [Empresas]
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
 *     description: "Permite editar os dados de uma vaga existente, incluindo o status do fluxo (RASCUNHO, EM_ANALISE, PUBLICADO, DESPUBLICADA, PAUSADA, EXPIRADO ou ENCERRADA). Requer autenticação com perfil autorizado (roles: ADMIN, MODERADOR ou SETOR_DE_VAGAS)."
 *     tags: [Empresas]
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
 *     description: "Exclui uma vaga cadastrada. Requer autenticação com perfil autorizado (roles: ADMIN, MODERADOR, EMPRESA ou SETOR_DE_VAGAS)."
 *     tags: [Empresas]
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
