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
import { InstrutorController } from '../controllers/instrutor-controller';
import { asyncHandler } from '../../../utils/asyncHandler';
import { Roles } from '../enums/Roles';

const router = Router();
const adminController = new AdminController();
const adminRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO];
const curriculoViewerRoles: Roles[] = [
  Roles.ADMIN,
  Roles.MODERADOR,
  Roles.PEDAGOGICO,
  Roles.EMPRESA,
  Roles.SETOR_DE_VAGAS,
  Roles.RECRUTADOR,
  Roles.ALUNO_CANDIDATO,
];

// =============================================
// ROTAS COM ESCOPOS ESPECÍFICOS ANTES DO GUARD GLOBAL
// =============================================

/**
 * @openapi
 * /api/v1/usuarios/candidatos/dashboard:
 *   get:
 *     summary: Listar candidatos (visão de dashboard)
 *     description: |
 *       Retorna candidatos com role ALUNO_CANDIDATO e pelo menos um currículo ativo, limitado a 10 registros por página.
 *
 *       **ACESSO:** ADMIN, MODERADOR, SETOR_DE_VAGAS e PEDAGOGICO podem acessar esta rota.
 *     tags: [Usuários]
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
 *           enum: [ATIVO, INATIVO, BLOQUEADO, PENDENTE, SUSPENSO]
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
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/candidatos/dashboard" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get(
  '/candidatos/dashboard',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR', 'SETOR_DE_VAGAS', 'PEDAGOGICO']),
  asyncHandler(adminController.listarCandidatosDashboard),
);

// =============================================
// MIDDLEWARES DE SEGURANÇA GLOBAIS
// =============================================

/**
 * Todas as demais rotas admin requerem pelo menos role MODERADOR ou PEDAGOGICO
 * Nota: PEDAGOGICO terá validações específicas nos controllers/services
 */
router.use(supabaseAuthMiddleware(['ADMIN', 'MODERADOR', 'PEDAGOGICO']));

// =============================================
// ROTAS DE LISTAGEM E CONSULTA
// =============================================

/**
 * Área administrativa principal
 * GET /admin
 */
/**
 * @openapi
 * /api/v1/usuarios:
 *   get:
 *     summary: Informações do painel administrativo
 *     tags: [Usuários]
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
 *           curl -X GET "http://localhost:3000/api/v1/usuarios" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/', asyncHandler(adminController.getAdminInfo));

/**
 * Listar usuários com filtros
 * GET /admin/usuarios
 */
/**
 * @openapi
 * /api/v1/usuarios/usuarios:
 *   get:
 *     summary: Listar usuários
 *     description: |
 *       Lista usuários com filtros e paginação.
 *
 *       **ACESSO:** ADMIN, MODERADOR e PEDAGOGICO podem acessar esta rota.
 *
 *       **RESTRIÇÕES PARA PEDAGOGICO:**
 *       - PEDAGOGICO só pode visualizar usuários com role ALUNO_CANDIDATO ou INSTRUTOR
 *       - Tentativas de filtrar por outras roles retornarão lista vazia
 *
 *       **⚡ OTIMIZAÇÕES DE PERFORMANCE:**
 *       - ✅ Cache: 30 segundos de TTL (requisições repetidas < 10ms)
 *       - ✅ Índices otimizados: Filtros por cidade/estado 80-90% mais rápidos
 *       - ✅ Seleção otimizada: Apenas campos necessários (30-40% menos dados)
 *       - ✅ Suporta 10+ requisições simultâneas sem degradação
 *     tags: [Usuários]
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
 *         description: |
 *           Filtrar por role. Para PEDAGOGICO, apenas ALUNO_CANDIDATO e INSTRUTOR são permitidos.
 *       - in: query
 *         name: tipoUsuario
 *         schema:
 *           type: string
 *           example: PESSOA_FISICA
 *       - in: query
 *         name: cidade
 *         schema:
 *           type: string
 *           description: Filtrar por cidade do endereço
 *           example: "Maceió"
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           description: Filtrar por estado do endereço
 *           example: "AL"
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Lista de usuários"
 *                 usuarios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       codUsuario:
 *                         type: string
 *                         description: Código único do usuário
 *                         example: "USR-2024-001"
 *                       email:
 *                         type: string
 *                         format: email
 *                       nomeCompleto:
 *                         type: string
 *                       cpf:
 *                         type: string
 *                         nullable: true
 *                         description: CPF do usuário (para pessoa física)
 *                       cnpj:
 *                         type: string
 *                         nullable: true
 *                         description: CNPJ do usuário (para pessoa jurídica)
 *                       role:
 *                         type: string
 *                         enum: [ADMIN, MODERADOR, INSTRUTOR, ALUNO_CANDIDATO, EMPRESA]
 *                       status:
 *                         type: string
 *                         enum: [ATIVO, INATIVO, BLOQUEADO, PENDENTE]
 *                       tipoUsuario:
 *                         type: string
 *                         enum: [PESSOA_FISICA, PESSOA_JURIDICA]
 *                       telefone:
 *                         type: string
 *                         nullable: true
 *                       genero:
 *                         type: string
 *                         nullable: true
 *                       dataNasc:
 *                         type: string
 *                         format: date
 *                         nullable: true
 *                       descricao:
 *                         type: string
 *                         nullable: true
 *                       avatarUrl:
 *                         type: string
 *                         nullable: true
 *                       cidade:
 *                         type: string
 *                         nullable: true
 *                         description: Cidade do endereço mais recente
 *                       estado:
 *                         type: string
 *                         nullable: true
 *                         description: Estado do endereço mais recente
 *                       logradouro:
 *                         type: string
 *                         nullable: true
 *                         description: Logradouro do endereço mais recente
 *                       numero:
 *                         type: string
 *                         nullable: true
 *                         description: Número do endereço mais recente
 *                       bairro:
 *                         type: string
 *                         nullable: true
 *                         description: Bairro do endereço mais recente
 *                       cep:
 *                         type: string
 *                         nullable: true
 *                         description: CEP do endereço mais recente
 *                       criadoEm:
 *                         type: string
 *                         format: date-time
 *                       ultimoLogin:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 50
 *                     total:
 *                       type: integer
 *                       example: 150
 *                     pages:
 *                       type: integer
 *                       example: 3
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
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/usuarios" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/usuarios', asyncHandler(adminController.listarUsuarios));

/**
 * @openapi
 * /api/v1/usuarios/usuarios:
 *   post:
 *     summary: Criar usuário (admin/moderador/pedagógico)
 *     description: |
 *       Cria um usuário de pessoa física ou jurídica já com email validado, sem exigir confirmação de token.
 *
 *       **ACESSO:** ADMIN, MODERADOR e PEDAGOGICO podem acessar esta rota.
 *
 *       **REGRAS DE PERMISSÃO POR ROLE:**
 *
 *       **ADMIN:**
 *       - Pode criar usuários com QUALQUER role (sem restrições)
 *
 *       **MODERADOR:**
 *       - Pode criar usuários com qualquer role EXCETO ADMIN e MODERADOR
 *       - Pode criar: EMPRESA, ALUNO_CANDIDATO, INSTRUTOR, PEDAGOGICO, SETOR_DE_VAGAS, RECRUTADOR, FINANCEIRO
 *       - Tentativas de criar ADMIN ou MODERADOR retornarão erro 403
 *
 *       **PEDAGOGICO:**
 *       - Só pode criar usuários com role ALUNO_CANDIDATO ou INSTRUTOR
 *       - NÃO pode criar: ADMIN, MODERADOR, PEDAGOGICO, EMPRESA ou outras roles
 *       - Tentativas de criar outras roles retornarão erro 403
 *     tags: [Usuários]
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
 *         description: |
 *           Acesso negado. Para PEDAGOGICO, indica tentativa de criar usuário com role diferente de ALUNO_CANDIDATO ou INSTRUTOR.
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
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/usuarios" \
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
router.post('/usuarios', supabaseAuthMiddleware(adminRoles), asyncHandler(adminController.criarUsuario));

/**
 * Listar candidatos com filtros
 * GET /admin/candidatos
 */
/**
 * @openapi
 * /api/v1/usuarios/candidatos:
 *   get:
 *     summary: Listar candidatos
 *     description: "Retorna candidatos com role ALUNO_CANDIDATO que possuem ao menos um currículo ativo cadastrado."
 *     tags: [Usuários]
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
 *           enum: [ATIVO, INATIVO, BLOQUEADO, PENDENTE, SUSPENSO]
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
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/candidatos" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/candidatos', asyncHandler(adminController.listarCandidatos));

/**
 * Buscar usuário específico por ID
 * GET /admin/usuarios/:userId
 */
/**
 * @openapi
 * /api/v1/usuarios/usuarios/{userId}:
 *   get:
 *     summary: Buscar usuário por ID
 *     description: |
 *       Busca um usuário específico por ID com relações específicas baseadas na role.
 *
 *       **ACESSO:** ADMIN, MODERADOR e PEDAGOGICO podem acessar esta rota.
 *
 *       **RESTRIÇÕES PARA PEDAGOGICO:**
 *       - PEDAGOGICO só pode visualizar usuários com role ALUNO_CANDIDATO ou INSTRUTOR
 *       - Tentativas de visualizar usuários com outras roles retornarão erro 403
 *
 *       **Relações por role:**
 *       - ALUNO_CANDIDATO: curriculos, candidaturas, cursosInscricoes
 *       - EMPRESA: vagas
 *       - Outras roles: dados básicos apenas
 *     tags: [Usuários]
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
 *         description: |
 *           Usuário encontrado com relações específicas baseadas na role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Usuário encontrado"
 *                 usuario:
 *                   type: object
 *                   description: Usuário com todas as informações e relações conforme a role
 *       403:
 *         description: |
 *           Para PEDAGOGICO, indica tentativa de visualizar usuário com role diferente de ALUNO_CANDIDATO ou INSTRUTOR.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
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
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/usuarios/{userId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/usuarios/:userId', asyncHandler(adminController.buscarUsuario));

/**
 * @openapi
 * /api/v1/usuarios/usuarios/{userId}:
 *   put:
 *     summary: Atualizar usuário
 *     description: |
 *       Atualiza informações completas de um usuário.
 *
 *       **ACESSO:** ADMIN, MODERADOR e PEDAGOGICO podem acessar esta rota.
 *
 *       **RESTRIÇÕES PARA PEDAGOGICO:**
 *       - PEDAGOGICO só pode editar usuários com role ALUNO_CANDIDATO ou INSTRUTOR
 *       - PEDAGOGICO não pode alterar a role de um usuário
 *       - Tentativas de editar usuários com outras roles retornarão erro 403
 *
 *       Campos opcionais: nomeCompleto, email, senha, confirmarSenha, telefone, genero, dataNasc, descricao, avatarUrl, endereco, redesSociais
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nomeCompleto:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               senha:
 *                 type: string
 *                 minLength: 8
 *               confirmarSenha:
 *                 type: string
 *                 minLength: 8
 *               telefone:
 *                 type: string
 *                 nullable: true
 *               genero:
 *                 type: string
 *                 nullable: true
 *               dataNasc:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               descricao:
 *                 type: string
 *                 nullable: true
 *               avatarUrl:
 *                 type: string
 *                 nullable: true
 *               endereco:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   logradouro:
 *                     type: string
 *                   numero:
 *                     type: string
 *                   bairro:
 *                     type: string
 *                   cidade:
 *                     type: string
 *                   estado:
 *                     type: string
 *                   cep:
 *                     type: string
 *               redesSociais:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   linkedin:
 *                     type: string
 *                   instagram:
 *                     type: string
 *                   facebook:
 *                     type: string
 *                   youtube:
 *                     type: string
 *                   twitter:
 *                     type: string
 *                   tiktok:
 *                     type: string
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       400:
 *         description: ID inválido ou dados inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: |
 *           Acesso negado. Para PEDAGOGICO, indica tentativa de editar usuário com role diferente de ALUNO_CANDIDATO ou INSTRUTOR, ou tentativa de alterar role.
 *       404:
 *         description: Usuário não encontrado
 *       409:
 *         description: Email já está em uso
 *       500:
 *         description: Erro ao atualizar usuário
 */
router.put(
  '/usuarios/:userId',
  supabaseAuthMiddleware(adminRoles),
  asyncHandler(adminController.atualizarUsuario),
);

/**
 * Buscar candidato específico por ID
 * GET /admin/candidatos/:userId
 */
/**
 * @openapi
 * /api/v1/usuarios/candidatos/{userId}:
 *   get:
 *     summary: Buscar candidato por ID
 *     tags: [Usuários]
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
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/candidatos/{userId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/candidatos/:userId', asyncHandler(adminController.buscarCandidato));
/**
 * @openapi
 * /api/v1/usuarios/candidatos/{userId}/logs:
 *   get:
 *     summary: Listar logs do candidato
 *     description: "Retorna o histórico de eventos relacionados ao candidato, incluindo criação, atualização e cancelamento de candidaturas."
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum:
 *             - CURRICULO_CRIADO
 *             - CURRICULO_ATUALIZADO
 *             - CURRICULO_REMOVIDO
 *             - CANDIDATO_ATIVADO
 *             - CANDIDATO_DESATIVADO
 *             - CANDIDATURA_CRIADA
 *             - CANDIDATURA_CANCELADA_CURRICULO
 *             - CANDIDATURA_CANCELADA_BLOQUEIO
 *     responses:
 *       200:
 *         description: Lista de logs do candidato
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminCandidateLogListResponse'
 *       404:
 *         description: Candidato não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro ao listar logs do candidato
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/candidatos/:userId/logs', asyncHandler(adminController.listarCandidatoLogs));

// =============================================
// ROTAS DE MODIFICAÇÃO (APENAS ADMIN)
// =============================================

/**
 * Atualizar status de usuário
 * PATCH /admin/usuarios/:userId/status
 */
/**
 * @openapi
 * /api/v1/usuarios/usuarios/{userId}/status:
 *   patch:
 *     summary: Atualizar status de usuário
 *     tags: [Usuários]
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
 *           curl -X PATCH "http://localhost:3000/api/v1/usuarios/usuarios/{userId}/status" \\
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
 * /api/v1/usuarios/usuarios/{userId}/role:
 *   patch:
 *     summary: Atualizar role de usuário
 *     tags: [Usuários]
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
 *           curl -X PATCH "http://localhost:3000/api/v1/usuarios/usuarios/{userId}/role" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"role":"MODERADOR"}'
 */
router.patch(
  '/usuarios/:userId/role',
  supabaseAuthMiddleware(['ADMIN']),
  asyncHandler(adminController.atualizarRole),
);

// =============================================
// ROTAS DE BLOQUEIO DE ALUNOS
// =============================================

/**
 * @openapi
 * /api/v1/usuarios/alunos/{userId}/bloqueios:
 *   get:
 *     summary: Listar bloqueios de um aluno
 *     description: Retorna histórico de bloqueios aplicados ao aluno
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *     responses:
 *       200:
 *         description: Histórico de bloqueios retornado com sucesso
 *       404:
 *         description: Aluno não encontrado
 *   post:
 *     summary: Aplicar bloqueio a um aluno
 *     description: Aplica bloqueio temporário ou permanente ao aluno
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo, motivo]
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [TEMPORARIO, PERMANENTE, RESTRICAO_DE_RECURSO]
 *               motivo:
 *                 type: string
 *                 enum: [SPAM, VIOLACAO_POLITICAS, FRAUDE, ABUSO_DE_RECURSOS, OUTROS]
 *               dias:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 3650
 *                 description: Dias de bloqueio (obrigatório para TEMPORARIO)
 *               observacoes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Bloqueio aplicado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Aluno não encontrado
 */
router.get('/alunos/:userId/bloqueios', asyncHandler(adminController.listarBloqueiosAluno));

router.post('/alunos/:userId/bloqueios', asyncHandler(adminController.aplicarBloqueioAluno));

/**
 * @openapi
 * /api/v1/usuarios/alunos/{userId}/bloqueios/revogar:
 *   post:
 *     summary: Revogar bloqueio de um aluno
 *     description: Revoga o bloqueio ativo do aluno
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observacoes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Bloqueio revogado com sucesso
 *       404:
 *         description: Aluno ou bloqueio não encontrado
 */
router.post(
  '/alunos/:userId/bloqueios/revogar',
  asyncHandler(adminController.revogarBloqueioAluno),
);

// =============================================
// ROTAS DE INSTRUTORES
// =============================================

/**
 * @openapi
 * /api/v1/usuarios/instrutores:
 *   get:
 *     summary: Listar instrutores
 *     description: |
 *       Retorna lista paginada de instrutores com filtros.
 *
 *       **ACESSO:** ADMIN, MODERADOR e PEDAGOGICO podem acessar.
 *
 *       **⚡ OTIMIZAÇÕES DE PERFORMANCE:**
 *       - ✅ Cache: 30 segundos de TTL (requisições repetidas < 10ms)
 *       - ✅ Índices otimizados: Busca por nome/email 30-40% mais rápida
 *       - ✅ Seleção otimizada: Apenas campos necessários (inclui redes sociais)
 *       - ✅ Suporta 10+ requisições simultâneas sem degradação
 *     tags: [Usuários]
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
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome, email, CPF ou código (mínimo 3 caracteres)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ATIVO, INATIVO, BLOQUEADO, PENDENTE, SUSPENSO]
 *     responses:
 *       200:
 *         description: Lista de instrutores
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro ao listar instrutores
 */
router.get(
  '/instrutores',
  supabaseAuthMiddleware(adminRoles),
  asyncHandler(InstrutorController.listarInstrutores),
);

/**
 * @openapi
 * /api/v1/usuarios/instrutores/{instrutorId}:
 *   get:
 *     summary: Buscar instrutor por ID
 *     description: |
 *       Retorna detalhes completos de um instrutor específico.
 *       Apenas ADMIN e MODERADOR podem acessar.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instrutorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalhes do instrutor
 *       400:
 *         description: ID inválido
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Instrutor não encontrado
 *       500:
 *         description: Erro ao buscar instrutor
 *   put:
 *     summary: Atualizar instrutor
 *     description: |
 *       Atualiza informações de um instrutor específico.
 *       Apenas ADMIN e MODERADOR podem atualizar.
 *       Campos opcionais: nomeCompleto, email, senha, confirmarSenha, telefone, genero, dataNasc, descricao, avatarUrl, endereco, redesSociais
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instrutorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nomeCompleto:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               senha:
 *                 type: string
 *                 minLength: 8
 *               confirmarSenha:
 *                 type: string
 *                 minLength: 8
 *               telefone:
 *                 type: string
 *                 nullable: true
 *               genero:
 *                 type: string
 *                 nullable: true
 *               dataNasc:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               descricao:
 *                 type: string
 *                 nullable: true
 *               avatarUrl:
 *                 type: string
 *                 nullable: true
 *               endereco:
 *                 type: object
 *                 nullable: true
 *               redesSociais:
 *                 type: object
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Instrutor atualizado com sucesso
 *       400:
 *         description: ID inválido ou dados inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Instrutor não encontrado
 *       409:
 *         description: Email já está em uso
 *       500:
 *         description: Erro ao atualizar instrutor
 */
router.get(
  '/instrutores/:instrutorId',
  supabaseAuthMiddleware(adminRoles),
  asyncHandler(InstrutorController.getInstrutorById),
);

router.put(
  '/instrutores/:instrutorId',
  supabaseAuthMiddleware(adminRoles),
  asyncHandler(InstrutorController.atualizarInstrutorById),
);

/**
 * @openapi
 * /api/v1/usuarios/instrutores/{userId}/bloqueios:
 *   get:
 *     summary: Listar bloqueios de um instrutor
 *     description: Retorna histórico de bloqueios aplicados ao instrutor
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *     responses:
 *       200:
 *         description: Histórico de bloqueios retornado com sucesso
 *       404:
 *         description: Instrutor não encontrado
 *   post:
 *     summary: Aplicar bloqueio a um instrutor
 *     description: Aplica bloqueio temporário ou permanente ao instrutor
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo, motivo]
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [TEMPORARIO, PERMANENTE, RESTRICAO_DE_RECURSO]
 *               motivo:
 *                 type: string
 *                 enum: [SPAM, VIOLACAO_POLITICAS, FRAUDE, ABUSO_DE_RECURSOS, OUTROS]
 *               dias:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 3650
 *                 description: Dias de bloqueio (obrigatório para TEMPORARIO)
 *               observacoes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Bloqueio aplicado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Instrutor não encontrado
 */
router.get(
  '/instrutores/:userId/bloqueios',
  asyncHandler(adminController.listarBloqueiosInstrutor),
);

router.post(
  '/instrutores/:userId/bloqueios',
  asyncHandler(adminController.aplicarBloqueioInstrutor),
);

/**
 * @openapi
 * /api/v1/usuarios/instrutores/{userId}/bloqueios/revogar:
 *   post:
 *     summary: Revogar bloqueio de um instrutor
 *     description: Revoga o bloqueio ativo do instrutor
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observacoes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Bloqueio revogado com sucesso
 *       404:
 *         description: Instrutor ou bloqueio não encontrado
 */
router.post(
  '/instrutores/:userId/bloqueios/revogar',
  asyncHandler(adminController.revogarBloqueioInstrutor),
);

// =============================================
// ROTAS DE BLOQUEIO DE USUÁRIOS GERAIS
// =============================================

/**
 * @openapi
 * /api/v1/usuarios/usuarios/{userId}/bloqueios:
 *   get:
 *     summary: Listar bloqueios de um usuário
 *     description: Retorna histórico de bloqueios aplicados ao usuário (qualquer role)
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *     responses:
 *       200:
 *         description: Histórico de bloqueios retornado com sucesso
 *       404:
 *         description: Usuário não encontrado
 *   post:
 *     summary: Aplicar bloqueio a um usuário
 *     description: Aplica bloqueio temporário ou permanente ao usuário (qualquer role)
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo, motivo]
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [TEMPORARIO, PERMANENTE, RESTRICAO_DE_RECURSO]
 *               motivo:
 *                 type: string
 *                 enum: [SPAM, VIOLACAO_POLITICAS, FRAUDE, ABUSO_DE_RECURSOS, OUTROS]
 *               dias:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 3650
 *                 description: Dias de bloqueio (obrigatório para TEMPORARIO)
 *               observacoes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Bloqueio aplicado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 */
router.get('/usuarios/:userId/bloqueios', asyncHandler(adminController.listarBloqueiosUsuario));

router.post('/usuarios/:userId/bloqueios', asyncHandler(adminController.aplicarBloqueioUsuario));

/**
 * @openapi
 * /api/v1/usuarios/usuarios/{userId}/bloqueios/revogar:
 *   post:
 *     summary: Revogar bloqueio de um usuário
 *     description: Revoga o bloqueio ativo do usuário (qualquer role)
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observacoes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Bloqueio revogado com sucesso
 *       404:
 *         description: Usuário ou bloqueio não encontrado
 */
router.post(
  '/usuarios/:userId/bloqueios/revogar',
  asyncHandler(adminController.revogarBloqueioUsuario),
);

/**
 * @openapi
 * /api/v1/usuarios/curriculos/{curriculoId}:
 *   get:
 *     summary: Buscar currículo por ID (todos exceto Financeiro/Instrutor)
 *     description: |
 *       Retorna um currículo específico com todos os campos.
 *       **ACESSO:** ADMIN, MODERADOR, PEDAGOGICO, EMPRESA, SETOR_DE_VAGAS, RECRUTADOR e ALUNO_CANDIDATO.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: curriculoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Currículo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Currículo encontrado"
 *                 curriculo:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     titulo:
 *                       type: string
 *                     resumo:
 *                       type: string
 *                     objetivo:
 *                       type: string
 *                     principal:
 *                       type: boolean
 *                     areasInteresse:
 *                       type: object
 *                     preferencias:
 *                       type: object
 *                     habilidades:
 *                       type: object
 *                     idiomas:
 *                       type: object
 *                     experiencias:
 *                       type: object
 *                     formacao:
 *                       type: object
 *                     cursosCertificacoes:
 *                       type: object
 *                     premiosPublicacoes:
 *                       type: object
 *                     acessibilidade:
 *                       type: object
 *                     consentimentos:
 *                       type: object
 *                     criadoEm:
 *                       type: string
 *                       format: date-time
 *                     atualizadoEm:
 *                       type: string
 *                       format: date-time
 *                     ultimaAtualizacao:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Currículo não encontrado
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/curriculos/{curriculoId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get(
  '/curriculos/:curriculoId',
  supabaseAuthMiddleware(curriculoViewerRoles),
  asyncHandler(adminController.buscarCurriculoPorId),
);

export { router as adminRoutes };
export default router;
