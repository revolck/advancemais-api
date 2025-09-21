/**
 * Rotas administrativas - Gestão de usuários
 * Responsabilidade única: operações administrativas
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { Router } from 'express';
import { supabaseAuthMiddleware } from '../auth';
import { AdminController } from '../controllers/admin-controller';
import { asyncHandler } from '../../../utils/asyncHandler';

const router = Router();
const adminController = new AdminController();

// =============================================
// ROTAS COM ESCOPOS ESPECÍFICOS ANTES DO GUARD GLOBAL
// =============================================

/**
 * @openapi
 * /api/v1/usuarios/admin/candidatos/dashboard:
 *   get:
 *     summary: Listar candidatos (visão de dashboard)
 *     description: "Retorna candidatos com role ALUNO_CANDIDATO, limitado a 10 registros por página."
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ATIVO, INATIVO, BANIDO, PENDENTE, SUSPENSO]
 *           example: ATIVO
 *       - in: query
 *         name: tipoUsuario
 *         schema:
 *           type: string
 *           enum: [PESSOA_FISICA, PESSOA_JURIDICA]
 *           example: PESSOA_FISICA
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: Maria Silva
 *         description: "Busca por nome, e-mail, CPF ou código do candidato (mínimo 3 caracteres)."
 *     responses:
 *       200:
 *         description: Lista de candidatos para dashboard
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminCandidateListResponse'
 *       400:
 *         description: Requisição inválida (ex. busca com menos de 3 caracteres)
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
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       500:
 *         description: Erro ao listar candidatos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin/candidatos/dashboard" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get(
  '/candidatos/dashboard',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR', 'RECRUTADOR']),
  asyncHandler(adminController.listarCandidatosDashboard),
);

// =============================================
// MIDDLEWARES DE SEGURANÇA GLOBAIS
// =============================================

/**
 * Todas as demais rotas admin requerem pelo menos role MODERADOR
 */
router.use(supabaseAuthMiddleware(['ADMIN', 'MODERADOR']));

// =============================================
// ROTAS DE LISTAGEM E CONSULTA
// =============================================

/**
 * Área administrativa principal
 * GET /admin
 */
/**
 * @openapi
 * /api/v1/usuarios/admin:
 *   get:
 *     summary: Informações do painel administrativo
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detalhes do painel
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminModuleInfo'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/', asyncHandler(adminController.getAdminInfo));

/**
 * Listar usuários com filtros
 * GET /admin/usuarios
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios:
 *   get:
 *     summary: Listar usuários
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 50
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: ATIVO
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           example: ADMIN
 *       - in: query
 *         name: tipoUsuario
 *         schema:
 *           type: string
 *           example: PESSOA_FISICA
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserListResponse'
 *       500:
 *         description: Erro ao listar usuários
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin/usuarios" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/usuarios', asyncHandler(adminController.listarUsuarios));

/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios:
 *   post:
 *     summary: Criar usuário (admin/moderador)
 *     description: Cria um usuário de pessoa física ou jurídica já com email validado, sem exigir confirmação de token.
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminCreateUserRequest'
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso e com email marcado como verificado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminCreateUserResponse'
 *       400:
 *         description: Dados inválidos para criação do usuário
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
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       409:
 *         description: Usuário já cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/admin/usuarios" \
 *            -H "Content-Type: application/json" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -d '{
 *                 "nomeCompleto": "Maria Souza",
 *                 "telefone": "559999999999",
 *                 "email": "maria@example.com",
 *                 "senha": "SenhaForte123",
 *                 "confirmarSenha": "SenhaForte123",
 *                 "tipoUsuario": "PESSOA_FISICA",
 *                 "cpf": "11122233344",
 *                 "role": "ALUNO_CANDIDATO"
 *               }'
 */
router.post('/usuarios', asyncHandler(adminController.criarUsuario));

/**
 * Listar candidatos com filtros
 * GET /admin/candidatos
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/candidatos:
 *   get:
 *     summary: Listar candidatos
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *           example: 50
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ATIVO, INATIVO, BANIDO, PENDENTE, SUSPENSO]
 *           example: ATIVO
 *       - in: query
 *         name: tipoUsuario
 *         schema:
 *           type: string
 *           enum: [PESSOA_FISICA, PESSOA_JURIDICA]
 *           example: PESSOA_FISICA
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: Joao da Silva
 *         description: "Busca por nome, e-mail, CPF ou código do candidato. Necessário no mínimo 3 caracteres."
 *     responses:
 *       200:
 *         description: Lista de candidatos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminCandidateListResponse'
 *       400:
 *         description: Requisição inválida (ex. busca com menos de 3 caracteres)
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
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       500:
 *         description: Erro ao listar candidatos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin/candidatos" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/candidatos', asyncHandler(adminController.listarCandidatos));

/**
 * Buscar usuário específico por ID
 * GET /admin/usuarios/:userId
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios/{userId}:
 *   get:
 *     summary: Buscar usuário por ID
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserDetailResponse'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin/usuarios/{userId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/usuarios/:userId', asyncHandler(adminController.buscarUsuario));

/**
 * Buscar candidato específico por ID
 * GET /admin/candidatos/:userId
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/candidatos/{userId}:
 *   get:
 *     summary: Buscar candidato por ID
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Candidato encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminCandidateDetailResponse'
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
 *         description: Candidato não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin/candidatos/{userId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/candidatos/:userId', asyncHandler(adminController.buscarCandidato));

// =============================================
// ROTAS DE MODIFICAÇÃO (APENAS ADMIN)
// =============================================

/**
 * Atualizar status de usuário
 * PATCH /admin/usuarios/:userId/status
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios/{userId}/status:
 *   patch:
 *     summary: Atualizar status de usuário
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminStatusUpdateRequest'
 *     responses:
 *       200:
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminStatusUpdateResponse'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PATCH "http://localhost:3000/api/v1/usuarios/admin/usuarios/{userId}/status" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"status":"ATIVO"}'
 */
router.patch(
  '/usuarios/:userId/status',
  supabaseAuthMiddleware(['ADMIN']),
  asyncHandler(adminController.atualizarStatus),
);

/**
 * Atualizar role de usuário
 * PATCH /admin/usuarios/:userId/role
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios/{userId}/role:
 *   patch:
 *     summary: Atualizar role de usuário
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminRoleUpdateRequest'
 *     responses:
 *       200:
 *         description: Role atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminRoleUpdateResponse'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PATCH "http://localhost:3000/api/v1/usuarios/admin/usuarios/{userId}/role" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"role":"MODERADOR"}'
 */
router.patch(
  '/usuarios/:userId/role',
  supabaseAuthMiddleware(['ADMIN']),
  asyncHandler(adminController.atualizarRole),
);

export { router as adminRoutes };
