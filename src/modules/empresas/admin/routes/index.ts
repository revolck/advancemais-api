import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { AdminEmpresasController } from '@/modules/empresas/admin/controllers/admin-empresas.controller';

const router = Router();
const adminRoles = [Roles.ADMIN, Roles.MODERADOR];

/**
 * @openapi
 * /api/v1/empresas/admin:
 *   post:
 *     summary: (Admin) Criar empresa
 *     description: "Cria uma nova empresa (Pessoa Jurídica) e permite opcionalmente vincular um plano ativo no momento da criação. Endpoint restrito aos perfis ADMIN e MODERADOR."
 *     operationId: adminEmpresasCreate
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminEmpresaCreateInput'
 *           examples:
 *             default:
 *               summary: Cadastro completo com plano vinculado
 *               value:
 *                 nome: Advance Tech Consultoria
 *                 email: contato@advancetech.com.br
 *                 telefone: '11987654321'
 *                 senha: SenhaForte123!
 *                 supabaseId: supabase-user-id
 *                 cnpj: '12345678000190'
 *                 cidade: São Paulo
 *                 estado: SP
 *                 descricao: Consultoria especializada em recrutamento e seleção.
 *                 aceitarTermos: true
 *                 plano:
 *                   planoEmpresarialId: b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e
 *                   tipo: 30_dias
 *     responses:
 *       201:
 *         description: Empresa criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaDetailResponse'
 *             examples:
 *               created:
 *                 summary: Empresa criada
 *                 value:
 *                   empresa:
 *                     id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                     codUsuario: EMP-123456
 *                     nome: Advance Tech Consultoria
 *                     email: contato@advance.com.br
 *                     telefone: '+55 11 99999-0000'
 *                     status: ATIVO
 *                     criadoEm: '2024-01-05T12:00:00Z'
 *                     plano:
 *                       id: 38f73d2d-40fa-47a6-9657-6a4f7f1bb610
 *                       tipo: assinatura_mensal
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
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Plano empresarial informado não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Dados duplicados
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
 *   get:
 *     summary: (Admin) Listar empresas
 *     description: "Retorna empresas (Pessoa Jurídica) com dados resumidos do plano ativo. Endpoint restrito aos perfis ADMIN e MODERADOR."
 *     operationId: adminEmpresasList
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página atual da paginação
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Quantidade de registros por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: "Filtro por nome, código da empresa, e-mail ou CNPJ (mínimo 3 caracteres)"
 *     responses:
 *       200:
 *         description: Empresas listadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresasListResponse'
 *             examples:
 *               default:
 *                 summary: Lista paginada de empresas
 *                 value:
 *                   data:
 *                     - id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                       codUsuario: EMP-123456
 *                       nome: Advance Tech Consultoria
 *                       email: contato@advance.com.br
 *                       telefone: '+55 11 99999-0000'
 *                       ativa: true
 *                       parceira: true
 *                       vagasPublicadas: 8
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 1
 *                     totalPages: 1
 *       400:
 *         description: Parâmetros inválidos
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
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.create);
router.get('/', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.list);

/**
 * @openapi
 * /api/v1/empresas/admin/{id}:
 *   put:
 *     summary: (Admin) Atualizar empresa
 *     description: "Atualiza dados cadastrais da empresa e permite gerenciar o plano vinculado. Endpoint restrito aos perfis ADMIN e MODERADOR."
 *     operationId: adminEmpresasUpdate
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminEmpresaUpdateInput'
 *           examples:
 *             default:
 *               summary: Atualização de dados cadastrais e plano
 *               value:
 *                 telefone: '11912345678'
 *                 descricao: Consultoria especializada em tecnologia e inovação.
 *                 status: ATIVO
 *                 plano:
 *                   planoEmpresarialId: b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e
 *                   tipo: 60_dias
 *     responses:
 *       200:
 *         description: Empresa atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaDetailResponse'
 *             examples:
 *               updated:
 *                 summary: Empresa atualizada
 *                 value:
 *                   empresa:
 *                     id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                     nome: Advance Tech Consultoria LTDA
 *                     telefone: '+55 11 91234-5678'
 *                     status: ATIVO
 *                     plano:
 *                       id: 38f73d2d-40fa-47a6-9657-6a4f7f1bb610
 *                       tipo: 60_dias
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
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Empresa ou plano não encontrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Dados duplicados
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
 *   get:
 *     summary: (Admin) Detalhes completos da empresa
 *     description: "Retorna informações completas da empresa incluindo plano ativo, pagamentos e métricas. Endpoint restrito aos perfis ADMIN e MODERADOR."
 *     operationId: adminEmpresasGet
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Empresa encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaDetailResponse'
 *             examples:
 *               default:
 *                 summary: Empresa detalhada
 *                 value:
 *                   empresa:
 *                     id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                     codUsuario: EMP-123456
 *                     nome: Advance Tech Consultoria
 *                     email: contato@advance.com.br
 *                     vagas:
 *                       publicadas: 8
 *                       limitePlano: 10
 *       400:
 *         description: Parâmetros inválidos
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
 *       404:
 *         description: Empresa não encontrada
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
 */
router.put('/:id', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.update);
router.get('/:id', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.get);

/**
 * @openapi
 * /api/v1/empresas/admin/{id}/pagamentos:
 *   get:
 *     summary: (Admin) Histórico de pagamentos da empresa
 *     description: "Lista eventos de pagamento relacionados à empresa sem expor dados sensíveis de cartão. Apenas perfis ADMIN e MODERADOR podem acessar."
 *     operationId: adminEmpresasListPagamentos
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: Página atual da paginação
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Quantidade de registros por página
 *     responses:
 *       200:
 *         description: Histórico de pagamentos retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresasPagamentosResponse'
 *             examples:
 *               default:
 *                 summary: Histórico paginado
 *                 value:
 *                   data:
 *                     - id: 729480a9-8e05-4b42-b826-f8db7e5a4d2c
 *                       tipo: ASSINATURA
 *                       status: APROVADO
 *                       mensagem: Pagamento confirmado pelo provedor
 *                       criadoEm: '2024-02-10T12:00:00Z'
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 1
 *                     totalPages: 1
 *       400:
 *         description: Parâmetros inválidos
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
 *         description: Empresa não encontrada
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
 */
router.get(
  '/:id/pagamentos',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.listPagamentos,
);

/**
 * @openapi
 * /api/v1/empresas/admin/{id}/banimentos:
 *   get:
 *     summary: (Admin) Listar banimentos aplicados
 *     description: "Retorna o histórico de banimentos aplicados ao usuário da empresa, detalhando vigência, status e responsável."
 *     operationId: adminEmpresasListBanimentos
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: Histórico de banimentos retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUsuariosBanimentosResponse'
 *             examples:
 *               default:
 *                 summary: Banimentos da empresa
 *                 value:
 *                   data:
 *                     - id: ban_123456
 *                       alvo:
 *                         tipo: EMPRESA
 *                         id: cmp_112233
 *                         nome: Empresa XPTO
 *                         role: EMPRESA
 *                       banimento:
 *                         tipo: TEMPORARIO
 *                         motivo: VIOLACAO_POLITICAS
 *                         status: ATIVO
 *                         inicio: '2025-09-20T14:00:00Z'
 *                         fim: '2025-10-20T14:00:00Z'
 *                         observacoes: Uso indevido de dados pessoais de candidatos.
 *                       aplicadoPor:
 *                         id: adm_002
 *                         nome: Carlos Supervisor
 *                         role: ADMIN
 *                       auditoria:
 *                         criadoEm: '2025-09-20T14:05:00Z'
 *                         atualizadoEm: '2025-09-20T14:05:00Z'
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 1
 *                     totalPages: 1
 *       400:
 *         description: Parâmetros inválidos
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
 *         description: Empresa não encontrada
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
 *   post:
 *     summary: (Admin) Aplicar banimento à empresa
 *     description: "Centraliza o banimento do usuário da empresa, permitindo banimentos temporários ou permanentes com registro de auditoria."
 *     operationId: adminEmpresasAplicarBanimento
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUsuariosEmBanimentosCreate'
 *           examples:
 *             default:
 *               summary: Banimento de 30 dias com motivo
 *               value:
 *                 tipo: TEMPORARIO
 *                 motivo: VIOLACAO_POLITICAS
 *                 dias: 30
 *                 observacoes: Uso indevido de dados pessoais de candidatos.
 *     responses:
 *       201:
 *         description: Banimento aplicado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUsuariosEmBanimentosResponse'
 *             examples:
 *               created:
 *                 summary: Banimento registrado
 *                 value:
 *                   banimento:
 *                     id: ban_123456
 *                     alvo:
 *                       tipo: EMPRESA
 *                       id: cmp_112233
 *                       nome: Empresa XPTO
 *                       role: EMPRESA
 *                     banimento:
 *                       tipo: TEMPORARIO
 *                       motivo: VIOLACAO_POLITICAS
 *                       status: ATIVO
 *                       inicio: '2025-09-20T14:00:00Z'
 *                       fim: '2025-10-20T14:00:00Z'
 *                       observacoes: Uso indevido de dados pessoais de candidatos.
 *                     aplicadoPor:
 *                       id: adm_002
 *                       nome: Carlos Supervisor
 *                       role: ADMIN
 *                     auditoria:
 *                       criadoEm: '2025-09-20T14:05:00Z'
 *                       atualizadoEm: '2025-09-20T14:05:00Z'
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
 *         description: Empresa não encontrada
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
 */
router.get(
  '/:id/banimentos',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.listBanimentos,
);
router.post('/:id/banimentos', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.ban);
/**
 * @openapi
 * /api/v1/empresas/admin/{id}/banimentos/revogar:
 *   post:
 *     summary: (Admin) Revogar banimento ativo
 *     description: "Revoga o banimento ativo da empresa, restaura o status do usuário e notifica por email."
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observacoes: { type: string }
 *     responses:
 *       204:
 *         description: Revogado com sucesso
 */
router.post(
  '/:id/banimentos/revogar',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.unban,
);

/**
 * @openapi
 * /api/v1/empresas/admin/{id}/vagas:
 *   get:
 *     summary: (Admin) Histórico de vagas da empresa
 *     description: "Lista vagas criadas pela empresa com opção de filtrar por status, incluindo o código curto gerado automaticamente para cada vaga."
 *     operationId: adminEmpresasListVagas
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: "Lista de status separados por vírgula (RASCUNHO, EM_ANALISE, PUBLICADO, DESPUBLICADA, PAUSADA, ENCERRADA ou EXPIRADO)"
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
 *         description: Histórico de vagas retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresasVagasResponse'
 *             examples:
 *               default:
 *                 summary: Vagas publicadas e em análise
 *                 value:
 *                   data:
 *                     - id: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                       codigo: B24N56
 *                       titulo: Analista de Dados Pleno
 *                       status: PUBLICADO
 *                       inseridaEm: '2024-05-10T09:00:00Z'
 *                       atualizadoEm: '2024-05-12T11:30:00Z'
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 1
 *                     totalPages: 1
 *       400:
 *         description: Parâmetros inválidos
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
 *         description: Empresa não encontrada
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
 */
router.get('/:id/vagas', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.listVagas);

/**
 * @openapi
 * /api/v1/empresas/admin/{id}/vagas/em-analise:
 *   get:
 *     summary: (Admin) Vagas em análise da empresa
 *     description: "Retorna vagas da empresa com status EM_ANALISE aguardando aprovação."
 *     operationId: adminEmpresasListVagasAnalise
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: Vagas em análise retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresasVagasResponse'
 *             examples:
 *               default:
 *                 summary: Vaga aguardando aprovação
 *                 value:
 *                   data:
 *                     - id: 9b57ab89-0f8e-4bb6-9183-5a4b7bd6c001
 *                       codigo: K45L89
 *                       titulo: Coordenador de Projetos TI
 *                       status: EM_ANALISE
 *                       inseridaEm: '2024-05-15T09:30:00Z'
 *                       atualizadoEm: '2024-05-16T11:45:00Z'
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 1
 *                     totalPages: 1
 *       400:
 *         description: Parâmetros inválidos
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
 *         description: Empresa não encontrada
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
 */
router.get(
  '/:id/vagas/em-analise',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.listVagasEmAnalise,
);

/**
 * @openapi
 * /api/v1/empresas/admin/{id}/vagas/{vagaId}/aprovar:
 *   post:
 *     summary: (Admin) Aprovar vaga em análise
 *     description: "Altera o status da vaga para PUBLICADO caso esteja em análise."
 *     operationId: adminEmpresasAprovarVaga
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vaga aprovada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaVagaAprovacaoResponse'
 *             examples:
 *               approved:
 *                 summary: Vaga liberada para publicação
 *                 value:
 *                   vaga:
 *                     id: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                     codigo: B24N56
 *                     titulo: Analista de Dados Pleno
 *                     status: PUBLICADO
 *                     inseridaEm: '2024-05-10T09:00:00Z'
 *                     atualizadoEm: '2024-05-12T11:30:00Z'
 *       400:
 *         description: Dados inválidos ou vaga em status incorreto
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
 *         description: Empresa ou vaga não encontrada
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
 */
router.post(
  '/:id/vagas/:vagaId/aprovar',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.approveVaga,
);

export { router as adminEmpresasRoutes };
