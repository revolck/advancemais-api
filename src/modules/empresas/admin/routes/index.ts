import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { AdminEmpresasController } from '@/modules/empresas/admin/controllers/admin-empresas.controller';
import { AdminVagasController } from '@/modules/empresas/admin/controllers/admin-vagas.controller';
import { AdminCandidatosController } from '@/modules/empresas/admin/controllers/admin-candidatos.controller';

const router = Router();
const adminRoles = [Roles.ADMIN, Roles.MODERADOR];
const dashboardRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.RECRUTADOR];

/**
 * @openapi
 * /api/v1/empresas/admin/candidato:
 *   get:
 *     summary: (Admin/Moderador) Listar candidatos com árvore completa
 *     description: "Retorna candidatos que possuem pelo menos um currículo cadastrado, incluindo currículos, candidaturas e as vagas com suas respectivas empresas."
 *     operationId: adminCandidatosList
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
 *         name: status
 *         schema:
 *           type: string
 *           description: Lista de status separados por vírgula (ex.: ATIVO,BLOQUEADO)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Busca por nome, e-mail, CPF ou código do candidato (mínimo 3 caracteres)
 *     responses:
 *       200:
 *         description: Candidatos listados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminCandidatosListResponse'
 *             examples:
 *               default:
 *                 summary: Lista de candidatos com relacionamentos
 *                 value:
 *                   data:
 *                     - id: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                       codUsuario: CAND-332211
 *                       nomeCompleto: João da Silva
 *                       email: joao.silva@example.com
 *                       cpf: '12345678901'
 *                       role: ALUNO_CANDIDATO
 *                       tipoUsuario: PESSOA_FISICA
 *                       status: ATIVO
 *                       criadoEm: '2023-11-02T12:00:00Z'
 *                       ultimoLogin: '2024-05-18T09:30:00Z'
 *                       telefone: '+55 11 98888-7777'
 *                       genero: MASCULINO
 *                       dataNasc: '1995-08-12T00:00:00Z'
 *                       inscricao: null
 *                       avatarUrl: https://cdn.advance.com.br/avatars/joao.png
 *                       descricao: Analista de dados com 5 anos de experiência.
 *                       aceitarTermos: true
 *                       cidade: São Paulo
 *                       estado: SP
 *                       enderecos:
 *                         - id: cand-end-1
 *                           logradouro: Rua das Flores
 *                           numero: '200'
 *                           bairro: Centro
 *                           cidade: São Paulo
 *                           estado: SP
 *                           cep: '01010000'
 *                       socialLinks:
 *                         linkedin: https://linkedin.com/in/joaodasilva
 *                         instagram: null
 *                         facebook: null
 *                         youtube: null
 *                         twitter: null
 *                         tiktok: null
 *                       informacoes:
 *                         telefone: '+55 11 98888-7777'
 *                         genero: MASCULINO
 *                         dataNasc: '1995-08-12T00:00:00Z'
 *                         inscricao: null
 *                         avatarUrl: https://cdn.advance.com.br/avatars/joao.png
 *                         descricao: Analista de dados com 5 anos de experiência.
 *                         aceitarTermos: true
 *                       curriculos:
 *                         - id: 6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10
 *                           usuarioId: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                           titulo: Currículo principal
 *                           resumo: Profissional com experiência em analytics e BI.
 *                           objetivo: Atuar como analista de dados pleno.
 *                           principal: true
 *                           areasInteresse:
 *                             primaria: Tecnologia
 *                           preferencias: null
 *                           habilidades:
 *                             tecnicas:
 *                               - SQL
 *                               - Python
 *                           idiomas:
 *                             - idioma: Inglês
 *                               nivel: Avançado
 *                           experiencias: []
 *                           formacao: []
 *                           cursosCertificacoes: []
 *                           premiosPublicacoes: []
 *                           acessibilidade: null
 *                           consentimentos: null
 *                           ultimaAtualizacao: '2024-04-30T15:00:00Z'
 *                           criadoEm: '2023-11-02T12:05:00Z'
 *                           atualizadoEm: '2024-04-30T15:00:00Z'
 *                       candidaturas:
 *                         - id: 9f5c2be1-8b1f-4a24-8a55-df0f3ccf13c0
 *                           vagaId: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                           candidatoId: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                           curriculoId: 6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10
 *                           empresaUsuarioId: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                           status: RECEBIDA
 *                           origem: SITE
 *                           aplicadaEm: '2024-05-11T10:00:00Z'
 *                           atualizadaEm: '2024-05-11T10:00:00Z'
 *                           consentimentos:
 *                             lgpd: true
 *                           curriculo:
 *                             id: 6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10
 *                             usuarioId: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                             titulo: Currículo principal
 *                             resumo: Profissional com experiência em analytics e BI.
 *                             objetivo: Atuar como analista de dados pleno.
 *                             principal: true
 *                             areasInteresse:
 *                               primaria: Tecnologia
 *                             preferencias: null
 *                             habilidades:
 *                               tecnicas:
 *                                 - SQL
 *                                 - Python
 *                             idiomas:
 *                               - idioma: Inglês
 *                                 nivel: Avançado
 *                             experiencias: []
 *                             formacao: []
 *                             cursosCertificacoes: []
 *                             premiosPublicacoes: []
 *                             acessibilidade: null
 *                             consentimentos: null
 *                             ultimaAtualizacao: '2024-04-30T15:00:00Z'
 *                             criadoEm: '2023-11-02T12:05:00Z'
 *                             atualizadoEm: '2024-04-30T15:00:00Z'
 *                           empresa:
 *                             id: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                             codUsuario: EMP-123456
 *                             nomeCompleto: Advance Tech Consultoria
 *                             email: contato@advance.com.br
 *                             cnpj: '12345678000190'
 *                             role: EMPRESA
 *                             tipoUsuario: PESSOA_JURIDICA
 *                             status: ATIVO
 *                             criadoEm: '2024-01-05T12:00:00Z'
 *                             ultimoLogin: '2024-05-20T08:15:00Z'
 *                             telefone: '+55 11 99999-0000'
 *                             avatarUrl: https://cdn.advance.com.br/logo.png
 *                             descricao: Consultoria especializada em recrutamento e seleção.
 *                             aceitarTermos: true
 *                             cidade: São Paulo
 *                             estado: SP
 *                             enderecos:
 *                               - id: end-1
 *                                 logradouro: Av. Paulista
 *                                 numero: '1000'
 *                                 bairro: Bela Vista
 *                                 cidade: São Paulo
 *                                 estado: SP
 *                                 cep: '01310000'
 *                             socialLinks:
 *                               linkedin: https://linkedin.com/company/advance
 *                               instagram: null
 *                               facebook: null
 *                               youtube: null
 *                               twitter: null
 *                               tiktok: null
 *                             informacoes:
 *                               telefone: '+55 11 99999-0000'
 *                               genero: null
 *                               dataNasc: null
 *                               inscricao: null
 *                               avatarUrl: https://cdn.advance.com.br/logo.png
 *                               descricao: Consultoria especializada em recrutamento e seleção.
 *                               aceitarTermos: true
 *                           vaga:
 *                             id: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                             codigo: B24N56
 *                             slug: analista-dados-pleno-sao-paulo
 *                             usuarioId: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                             titulo: Analista de Dados Pleno
 *                             status: PUBLICADO
 *                             inseridaEm: '2024-05-10T09:00:00Z'
 *                             atualizadoEm: '2024-05-12T11:30:00Z'
 *                             inscricoesAte: '2024-06-01T23:59:59Z'
 *                             modoAnonimo: false
 *                             modalidade: REMOTO
 *                             regimeDeTrabalho: CLT
 *                             paraPcd: false
 *                             senioridade: PLENO
 *                             jornada: INTEGRAL
 *                             numeroVagas: 2
 *                             descricao: Oportunidade focada em análises preditivas e governança de dados.
 *                             requisitos:
 *                               obrigatorios:
 *                                 - Experiência com SQL
 *                                 - Vivência com Python
 *                               desejaveis:
 *                                 - Conhecimento em Power BI
 *                             atividades:
 *                               principais:
 *                                 - Construir dashboards executivos
 *                                 - Garantir qualidade dos dados
 *                               extras:
 *                                 - Atuar com stakeholders de negócios
 *                             beneficios:
 *                               lista:
 *                                 - Vale alimentação
 *                                 - Plano de saúde
 *                               observacoes: Auxílio home office de R$ 150,00
 *                             observacoes: Processo seletivo com etapas remotas e presenciais.
 *                             localizacao:
 *                               cidade: São Paulo
 *                               estado: SP
 *                             salarioMin: '4500.00'
 *                             salarioMax: '6500.00'
 *                             salarioConfidencial: false
 *                             areaInteresseId: 3
 *                             subareaInteresseId: 7
 *                             areaInteresse:
 *                               id: 3
 *                               categoria: Tecnologia da Informação
 *                             subareaInteresse:
 *                               id: 7
 *                               nome: Desenvolvimento Front-end
 *                               areaId: 3
 *                             empresa:
 *                               id: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                               codUsuario: EMP-123456
 *                               nomeCompleto: Advance Tech Consultoria
 *                               email: contato@advance.com.br
 *                               cnpj: '12345678000190'
 *                               role: EMPRESA
 *                               tipoUsuario: PESSOA_JURIDICA
 *                               status: ATIVO
 *                               criadoEm: '2024-01-05T12:00:00Z'
 *                               ultimoLogin: '2024-05-20T08:15:00Z'
 *                               telefone: '+55 11 99999-0000'
 *                               genero: null
 *                               dataNasc: null
 *                               inscricao: null
 *                               avatarUrl: https://cdn.advance.com.br/logo.png
 *                               descricao: Consultoria especializada em recrutamento e seleção.
 *                               aceitarTermos: true
 *                               cidade: São Paulo
 *                               estado: SP
 *                               enderecos:
 *                                 - id: end-1
 *                                   logradouro: Av. Paulista
 *                                   numero: '1000'
 *                                   bairro: Bela Vista
 *                                   cidade: São Paulo
 *                                   estado: SP
 *                                   cep: '01310000'
 *                               socialLinks:
 *                                 linkedin: https://linkedin.com/company/advance
 *                                 instagram: null
 *                                 facebook: null
 *                                 youtube: null
 *                                 twitter: null
 *                                 tiktok: null
 *                               informacoes:
 *                                 telefone: '+55 11 99999-0000'
 *                                 genero: null
 *                                 dataNasc: null
 *                                 inscricao: null
 *                                 avatarUrl: https://cdn.advance.com.br/logo.png
 *                                 descricao: Consultoria especializada em recrutamento e seleção.
 *                                 aceitarTermos: true
 *                       curriculosResumo:
 *                         total: 1
 *                         principais: 1
 *                       candidaturasResumo:
 *                         total: 1
 *                         porStatus:
 *                           RECEBIDA: 1
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
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/candidato', supabaseAuthMiddleware(adminRoles), AdminCandidatosController.list);

/**
 * @openapi
 * /api/v1/empresas/admin/candidato/{id}:
 *   get:
 *     summary: (Admin/Moderador) Detalhar candidato com árvore completa
 *     description: "Retorna todas as informações do candidato selecionado, incluindo currículos, candidaturas e as vagas aplicadas com suas empresas."
 *     operationId: adminCandidatosGet
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
 *         description: Identificador do candidato
 *     responses:
 *       200:
 *         description: Candidato retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminCandidatoDetalhe'
 *             examples:
 *               default:
 *                 summary: Candidato com currículos e candidaturas
 *                 value:
 *                   id: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                   codUsuario: CAND-332211
 *                   nomeCompleto: João da Silva
 *                   email: joao.silva@example.com
 *                   cpf: '12345678901'
 *                   cnpj: null
 *                   role: ALUNO_CANDIDATO
 *                   tipoUsuario: PESSOA_FISICA
 *                   status: ATIVO
 *                   criadoEm: '2023-11-02T12:00:00Z'
 *                   ultimoLogin: '2024-05-18T09:30:00Z'
 *                   telefone: '+55 11 98888-7777'
 *                   genero: MASCULINO
 *                   dataNasc: '1995-08-12T00:00:00Z'
 *                   inscricao: null
 *                   avatarUrl: https://cdn.advance.com.br/avatars/joao.png
 *                   descricao: Analista de dados com 5 anos de experiência.
 *                   aceitarTermos: true
 *                   cidade: São Paulo
 *                   estado: SP
 *                   enderecos:
 *                     - id: cand-end-1
 *                       logradouro: Rua das Flores
 *                       numero: '200'
 *                       bairro: Centro
 *                       cidade: São Paulo
 *                       estado: SP
 *                       cep: '01010000'
 *                   socialLinks:
 *                     linkedin: https://linkedin.com/in/joaodasilva
 *                     instagram: null
 *                     facebook: null
 *                     youtube: null
 *                     twitter: null
 *                     tiktok: null
 *                   informacoes:
 *                     telefone: '+55 11 98888-7777'
 *                     genero: MASCULINO
 *                     dataNasc: '1995-08-12'
 *                     inscricao: null
 *                     avatarUrl: https://cdn.advance.com.br/avatars/joao.png
 *                     descricao: Analista de dados com 5 anos de experiência.
 *                     aceitarTermos: true
 *                   curriculos:
 *                     - id: 6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10
 *                       usuarioId: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                       titulo: Currículo principal
 *                       resumo: Profissional com experiência em analytics e BI.
 *                       objetivo: Atuar como analista de dados pleno.
 *                       principal: true
 *                       areasInteresse:
 *                         primaria: Tecnologia
 *                       preferencias: null
 *                       habilidades:
 *                         tecnicas:
 *                           - SQL
 *                           - Python
 *                       idiomas:
 *                         - idioma: Inglês
 *                           nivel: Avançado
 *                       experiencias: []
 *                       formacao: []
 *                       cursosCertificacoes: []
 *                       premiosPublicacoes: []
 *                       acessibilidade: null
 *                       consentimentos: null
 *                       ultimaAtualizacao: '2024-04-30T15:00:00Z'
 *                       criadoEm: '2023-11-02T12:05:00Z'
 *                       atualizadoEm: '2024-04-30T15:00:00Z'
 *                   candidaturas:
 *                     - id: 9f5c2be1-8b1f-4a24-8a55-df0f3ccf13c0
 *                       vagaId: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                       candidatoId: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                       curriculoId: 6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10
 *                       empresaUsuarioId: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                       status: RECEBIDA
 *                       origem: SITE
 *                       aplicadaEm: '2024-05-11T10:00:00Z'
 *                       atualizadaEm: '2024-05-11T10:00:00Z'
 *                       consentimentos:
 *                         lgpd: true
 *                       curriculo: null
 *                       vaga:
 *                         id: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                         codigo: B24N56
 *                         slug: analista-dados-pleno-sao-paulo
 *                         usuarioId: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                         titulo: Analista de Dados Pleno
 *                         status: PUBLICADO
 *                         inseridaEm: '2024-05-10T09:00:00Z'
 *                         atualizadoEm: '2024-05-12T11:30:00Z'
 *                         inscricoesAte: '2024-06-01T23:59:59Z'
 *                         modoAnonimo: false
 *                         modalidade: REMOTO
 *                         regimeDeTrabalho: CLT
 *                         paraPcd: false
 *                         senioridade: PLENO
 *                         jornada: INTEGRAL
 *                         numeroVagas: 2
 *                         descricao: null
 *                         requisitos: null
 *                         atividades: null
 *                         beneficios: null
 *                         observacoes: null
 *                         localizacao: null
 *                         salarioMin: null
 *                         salarioMax: null
 *                         salarioConfidencial: false
 *                         areaInteresseId: null
 *                         subareaInteresseId: null
 *                         areaInteresse: null
 *                         subareaInteresse: null
 *                         empresa: null
 *                       empresa: null
 *                   curriculosResumo:
 *                     total: 1
 *                     principais: 1
 *                   candidaturasResumo:
 *                     total: 1
 *                     porStatus:
 *                       RECEBIDA: 1
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
 */
router.get('/candidato/:id', supabaseAuthMiddleware(adminRoles), AdminCandidatosController.get);

/**
 * @openapi
 * /api/v1/empresas/admin/vagas:
 *   get:
 *     summary: (Admin/Moderador) Listar vagas com árvore completa
 *     description: "Retorna uma visão administrativa completa de todas as vagas cadastradas, incluindo informações da empresa responsável, candidaturas recebidas e processos vinculados."
 *     operationId: adminVagasList
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
 *         name: status
 *         schema:
 *           type: string
 *           description: Lista de status separados por vírgula (ex.: PUBLICADO,EM_ANALISE)
 *       - in: query
 *         name: empresaId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtra vagas pertencentes à empresa informada
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Termo para busca por título, código ou slug da vaga
 *     responses:
 *       200:
 *         description: Vagas listadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminVagasListResponse'
 *             examples:
 *               default:
 *                 summary: Listagem de vagas com relacionamentos
 *                 value:
 *                   data:
 *                     - id: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                       codigo: B24N56
 *                       slug: analista-dados-pleno-sao-paulo
 *                       usuarioId: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                       titulo: Analista de Dados Pleno
 *                       status: PUBLICADO
 *                       inseridaEm: '2024-05-10T09:00:00Z'
 *                       atualizadoEm: '2024-05-12T11:30:00Z'
 *                       inscricoesAte: '2024-06-01T23:59:59Z'
 *                       modoAnonimo: false
 *                       modalidade: REMOTO
 *                       regimeDeTrabalho: CLT
 *                       paraPcd: false
 *                       senioridade: PLENO
 *                       jornada: INTEGRAL
 *                       numeroVagas: 2
 *                       descricao: Oportunidade focada em análises preditivas e governança de dados.
 *                       requisitos:
 *                         obrigatorios:
 *                           - Experiência com SQL
 *                           - Vivência com Python
 *                         desejaveis:
 *                           - Conhecimento em Power BI
 *                       atividades:
 *                         principais:
 *                           - Construir dashboards executivos
 *                           - Garantir qualidade dos dados
 *                         extras:
 *                           - Atuar com stakeholders de negócios
 *                       beneficios:
 *                         lista:
 *                           - Vale alimentação
 *                           - Plano de saúde
 *                         observacoes: Auxílio home office de R$ 150,00
 *                       observacoes: Processo seletivo com etapas remotas e presenciais.
 *                       localizacao:
 *                         cidade: São Paulo
 *                         estado: SP
 *                       salarioMin: '4500.00'
 *                       salarioMax: '6500.00'
 *                       salarioConfidencial: false
 *                       areaInteresseId: 3
 *                       subareaInteresseId: 7
 *                       areaInteresse:
 *                         id: 3
 *                         categoria: Tecnologia da Informação
 *                       subareaInteresse:
 *                         id: 7
 *                         nome: Desenvolvimento Front-end
 *                         areaId: 3
 *                       vagaEmDestaque: true
 *                       destaqueInfo:
 *                         empresasPlanoId: 8c5e0d56-4f2b-4c8f-9a18-91b3f4d2c7a1
 *                         ativo: true
 *                         ativadoEm: '2024-05-10T09:00:00Z'
 *                         desativadoEm: null
 *                       empresa:
 *                         id: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                         codUsuario: EMP-123456
 *                         nomeCompleto: Advance Tech Consultoria
 *                         email: contato@advance.com.br
 *                         cnpj: '12345678000190'
 *                         role: EMPRESA
 *                         tipoUsuario: PESSOA_JURIDICA
 *                         status: ATIVO
 *                         criadoEm: '2024-01-05T12:00:00Z'
 *                         ultimoLogin: '2024-05-20T08:15:00Z'
 *                         telefone: '+55 11 99999-0000'
 *                         avatarUrl: https://cdn.advance.com.br/logo.png
 *                         descricao: Consultoria especializada em recrutamento e seleção.
 *                         aceitarTermos: true
 *                         cidade: São Paulo
 *                         estado: SP
 *                         enderecos:
 *                           - id: end-1
 *                             logradouro: Av. Paulista
 *                             numero: '1000'
 *                             bairro: Bela Vista
 *                             cidade: São Paulo
 *                             estado: SP
 *                             cep: '01310000'
 *                         socialLinks:
 *                           linkedin: https://linkedin.com/company/advance
 *                           instagram: null
 *                           facebook: null
 *                           youtube: null
 *                           twitter: null
 *                           tiktok: null
 *                         informacoes:
 *                           telefone: '+55 11 99999-0000'
 *                           genero: null
 *                           dataNasc: null
 *                           inscricao: null
 *                           avatarUrl: https://cdn.advance.com.br/logo.png
 *                           descricao: Consultoria especializada em recrutamento e seleção.
 *                           aceitarTermos: true
 *                       candidaturas:
 *                         - id: 9f5c2be1-8b1f-4a24-8a55-df0f3ccf13c0
 *                           vagaId: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                           candidatoId: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                           curriculoId: 6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10
 *                           empresaUsuarioId: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                           status: RECEBIDA
 *                           origem: SITE
 *                           aplicadaEm: '2024-05-11T10:00:00Z'
 *                           atualizadaEm: '2024-05-11T10:00:00Z'
 *                           consentimentos:
 *                             lgpd: true
 *                           candidato:
 *                             id: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                             codUsuario: CAND-332211
 *                             nomeCompleto: João da Silva
 *                             email: joao.silva@example.com
 *                             cpf: '12345678901'
 *                             role: ALUNO_CANDIDATO
 *                             tipoUsuario: PESSOA_FISICA
 *                             status: ATIVO
 *                             criadoEm: '2023-11-02T12:00:00Z'
 *                             ultimoLogin: '2024-05-18T09:30:00Z'
 *                             telefone: '+55 11 98888-7777'
 *                             genero: MASCULINO
 *                             dataNasc: '1995-08-12T00:00:00Z'
 *                             inscricao: null
 *                             avatarUrl: https://cdn.advance.com.br/avatars/joao.png
 *                             descricao: Analista de dados com 5 anos de experiência.
 *                             aceitarTermos: true
 *                             cidade: São Paulo
 *                             estado: SP
 *                             enderecos:
 *                               - id: cand-end-1
 *                                 logradouro: Rua das Flores
 *                                 numero: '200'
 *                                 bairro: Centro
 *                                 cidade: São Paulo
 *                                 estado: SP
 *                                 cep: '01010000'
 *                             socialLinks:
 *                               linkedin: https://linkedin.com/in/joaodasilva
 *                               instagram: null
 *                               facebook: null
 *                               youtube: null
 *                               twitter: null
 *                               tiktok: null
 *                             informacoes:
 *                               telefone: '+55 11 98888-7777'
 *                               genero: MASCULINO
 *                               dataNasc: '1995-08-12T00:00:00Z'
 *                               inscricao: null
 *                               avatarUrl: https://cdn.advance.com.br/avatars/joao.png
 *                               descricao: Analista de dados com 5 anos de experiência.
 *                               aceitarTermos: true
 *                           curriculo:
 *                             id: 6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10
 *                             usuarioId: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                             titulo: Currículo principal
 *                             resumo: Profissional com experiência em analytics e BI.
 *                             objetivo: Atuar como analista de dados pleno.
 *                             principal: true
 *                             areasInteresse:
 *                               primaria: Tecnologia
 *                             preferencias: null
 *                             habilidades:
 *                               tecnicas:
 *                                 - SQL
 *                                 - Python
 *                             idiomas:
 *                               - idioma: Inglês
 *                                 nivel: Avançado
 *                             experiencias: []
 *                             formacao: []
 *                             cursosCertificacoes: []
 *                             premiosPublicacoes: []
 *                             acessibilidade: null
 *                             consentimentos: null
 *                             ultimaAtualizacao: '2024-04-30T15:00:00Z'
 *                             criadoEm: '2023-11-02T12:05:00Z'
 *                             atualizadoEm: '2024-04-30T15:00:00Z'
 *                       processos:
 *                         - id: 8fd4c1e2-5f11-4a5c-9ab2-bc401ea77e10
 *                           vagaId: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                           candidatoId: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                           status: ENTREVISTA
 *                           origem: SITE
 *                           observacoes: Entrevista técnica agendada.
 *                           agendadoEm: '2024-05-18T14:00:00Z'
 *                           criadoEm: '2024-05-15T10:00:00Z'
 *                           atualizadoEm: '2024-05-16T16:30:00Z'
 *                           candidato:
 *                             id: 8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20
 *                             codUsuario: CAND-332211
 *                             nomeCompleto: João da Silva
 *                             email: joao.silva@example.com
 *                             cpf: '12345678901'
 *                             role: ALUNO_CANDIDATO
 *                             tipoUsuario: PESSOA_FISICA
 *                             status: ATIVO
 *                             criadoEm: '2023-11-02T12:00:00Z'
 *                             ultimoLogin: '2024-05-18T09:30:00Z'
 *                             telefone: '+55 11 98888-7777'
 *                             genero: MASCULINO
 *                             dataNasc: '1995-08-12T00:00:00Z'
 *                             inscricao: null
 *                             avatarUrl: https://cdn.advance.com.br/avatars/joao.png
 *                             descricao: Analista de dados com 5 anos de experiência.
 *                             aceitarTermos: true
 *                             cidade: São Paulo
 *                             estado: SP
 *                             enderecos:
 *                               - id: cand-end-1
 *                                 logradouro: Rua das Flores
 *                                 numero: '200'
 *                                 bairro: Centro
 *                                 cidade: São Paulo
 *                                 estado: SP
 *                                 cep: '01010000'
 *                             socialLinks:
 *                               linkedin: https://linkedin.com/in/joaodasilva
 *                               instagram: null
 *                               facebook: null
 *                               youtube: null
 *                               twitter: null
 *                               tiktok: null
 *                             informacoes:
 *                               telefone: '+55 11 98888-7777'
 *                               genero: MASCULINO
 *                               dataNasc: '1995-08-12T00:00:00Z'
 *                               inscricao: null
 *                               avatarUrl: https://cdn.advance.com.br/avatars/joao.png
 *                               descricao: Analista de dados com 5 anos de experiência.
 *                               aceitarTermos: true
 *                       candidaturasResumo:
 *                         total: 1
 *                         porStatus:
 *                           RECEBIDA: 1
 *                       processosResumo:
 *                         total: 1
 *                         porStatus:
 *                           ENTREVISTA: 1
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
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/vagas', supabaseAuthMiddleware(adminRoles), AdminVagasController.list);

/**
 * @openapi
 * /api/v1/empresas/admin/vagas/{id}:
 *   get:
 *     summary: (Admin/Moderador) Detalhar vaga com relacionamentos
 *     description: "Retorna todos os dados da vaga selecionada, incluindo empresa, candidaturas, candidatos derivados das inscrições e processos ligados ao fluxo seletivo."
 *     operationId: adminVagasGet
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
 *         description: Identificador da vaga
 *     responses:
 *       200:
 *         description: Vaga retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminVagaDetalhe'
 *             examples:
 *               default:
 *                 summary: Detalhe completo da vaga
 *                 value:
 *                   id: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                   codigo: B24N56
 *                   slug: analista-dados-pleno-sao-paulo
 *                   usuarioId: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                   titulo: Analista de Dados Pleno
 *                   status: PUBLICADO
 *                   inseridaEm: '2024-05-10T09:00:00Z'
 *                   atualizadoEm: '2024-05-12T11:30:00Z'
 *                   inscricoesAte: '2024-06-01T23:59:59Z'
 *                   modoAnonimo: false
 *                   modalidade: REMOTO
 *                   regimeDeTrabalho: CLT
 *                   paraPcd: false
 *                   senioridade: PLENO
 *                   jornada: INTEGRAL
 *                   numeroVagas: 2
 *                   descricao: Oportunidade focada em análises preditivas e governança de dados.
 *                   requisitos:
 *                     obrigatorios:
 *                       - Experiência com SQL
 *                     desejaveis:
 *                       - Conhecimento em Power BI
 *                   atividades:
 *                     principais:
 *                       - Construir dashboards executivos
 *                     extras: []
 *                   beneficios:
 *                     lista:
 *                       - Vale alimentação
 *                       - Plano de saúde
 *                     observacoes: Auxílio home office de R$ 150,00
 *                   observacoes: Processo seletivo com etapas remotas e presenciais.
 *                   localizacao:
 *                     cidade: São Paulo
 *                     estado: SP
 *                   salarioMin: '4500.00'
 *                   salarioMax: '6500.00'
 *                   salarioConfidencial: false
 *                   areaInteresseId: 3
 *                   subareaInteresseId: 7
 *                   areaInteresse:
 *                     id: 3
 *                     categoria: Tecnologia da Informação
 *                   subareaInteresse:
 *                     id: 7
 *                     nome: Desenvolvimento Front-end
 *                     areaId: 3
 *                   vagaEmDestaque: true
 *                   destaqueInfo:
 *                     empresasPlanoId: 8c5e0d56-4f2b-4c8f-9a18-91b3f4d2c7a1
 *                     ativo: true
 *                     ativadoEm: '2024-05-10T09:00:00Z'
 *                     desativadoEm: null
 *                   empresa:
 *                     id: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                     codUsuario: EMP-123456
 *                     nomeCompleto: Advance Tech Consultoria
 *                     email: contato@advance.com.br
 *                     cnpj: '12345678000190'
 *                     role: EMPRESA
 *                     tipoUsuario: PESSOA_JURIDICA
 *                     status: ATIVO
 *                     criadoEm: '2024-01-05T12:00:00Z'
 *                     ultimoLogin: '2024-05-20T08:15:00Z'
 *                     telefone: '+55 11 99999-0000'
 *                     avatarUrl: https://cdn.advance.com.br/logo.png
 *                     descricao: Consultoria especializada em recrutamento e seleção.
 *                     aceitarTermos: true
 *                     cidade: São Paulo
 *                     estado: SP
 *                     enderecos:
 *                       - id: end-1
 *                         logradouro: Av. Paulista
 *                         numero: '1000'
 *                         bairro: Bela Vista
 *                         cidade: São Paulo
 *                         estado: SP
 *                         cep: '01310000'
 *                     socialLinks:
 *                       linkedin: https://linkedin.com/company/advance
 *                       instagram: null
 *                       facebook: null
 *                       youtube: null
 *                       twitter: null
 *                       tiktok: null
 *                     informacoes:
 *                       telefone: '+55 11 99999-0000'
 *                       genero: null
 *                       dataNasc: null
 *                       inscricao: null
 *                       avatarUrl: https://cdn.advance.com.br/logo.png
 *                       descricao: Consultoria especializada em recrutamento e seleção.
 *                       aceitarTermos: true
 *                   candidaturas: []
 *                   candidatos:
 *                     - id: 1c2d3e4f-5678-90ab-cdef-1234567890ab
 *                       codUsuario: CAND-987654
 *                       nomeCompleto: Maria Fernanda Lima
 *                       email: maria.lima@email.com
 *                       cpf: '98765432100'
 *                       cnpj: null
 *                       role: CANDIDATO
 *                       tipoUsuario: PESSOA_FISICA
 *                       status: ATIVO
 *                       criadoEm: '2024-03-01T10:00:00Z'
 *                       ultimoLogin: '2024-05-22T14:30:00Z'
 *                       telefone: '+55 11 98888-7777'
 *                       genero: FEMININO
 *                       dataNasc: '1995-07-20'
 *                       inscricao: null
 *                       avatarUrl: https://cdn.advance.com.br/candidatos/maria.png
 *                       descricao: Analista de dados com 5 anos de experiência em BI.
 *                       aceitarTermos: true
 *                       cidade: São Paulo
 *                       estado: SP
 *                       enderecos:
 *                         - id: end-cand-1
 *                           logradouro: Rua das Flores
 *                           numero: '250'
 *                           bairro: Centro
 *                           cidade: São Paulo
 *                           estado: SP
 *                           cep: '01020000'
 *                       socialLinks:
 *                         linkedin: https://linkedin.com/in/marialima
 *                         instagram: null
 *                         facebook: null
 *                         youtube: null
 *                         twitter: null
 *                         tiktok: null
 *                       informacoes:
 *                         telefone: '+55 11 98888-7777'
 *                         genero: FEMININO
 *                         dataNasc: '1995-07-20'
 *                         inscricao: null
 *                         avatarUrl: https://cdn.advance.com.br/candidatos/maria.png
 *                         descricao: Analista de dados com 5 anos de experiência em BI.
 *                         aceitarTermos: true
 *                       candidaturas:
 *                         - id: 5f4e3d2c-1b0a-9876-5432-10fedcba0987
 *                           vagaId: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                           candidatoId: 1c2d3e4f-5678-90ab-cdef-1234567890ab
 *                           curriculoId: 4321abcd-5678-90ef-abcd-1234567890ef
 *                           empresaUsuarioId: 5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11
 *                           status: RECEBIDA
 *                           origem: SITE
 *                           aplicadaEm: '2024-05-12T09:30:00Z'
 *                           atualizadaEm: '2024-05-12T09:30:00Z'
 *                           consentimentos: null
 *                           candidato:
 *                             $ref: '#/components/schemas/AdminVagaUsuarioResumo/example'
 *                           curriculo:
 *                             id: 4321abcd-5678-90ef-abcd-1234567890ef
 *                             usuarioId: 1c2d3e4f-5678-90ab-cdef-1234567890ab
 *                             titulo: Currículo principal
 *                             resumo: Profissional especializada em análise de dados e BI.
 *                             objetivo: Atuar como Analista de Dados Pleno
 *                             principal: true
 *                             areasInteresse: ['Tecnologia', 'Business Intelligence']
 *                             preferencias: { regime: 'REMOTO' }
 *                             habilidades: ['SQL', 'Power BI', 'Python']
 *                             idiomas: ['Inglês avançado']
 *                             experiencias: []
 *                             formacao: []
 *                             cursosCertificacoes: []
 *                             premiosPublicacoes: []
 *                             acessibilidade: null
 *                             consentimentos: null
 *                             ultimaAtualizacao: '2024-05-10T18:00:00Z'
 *                             criadoEm: '2023-12-01T10:00:00Z'
 *                             atualizadoEm: '2024-05-10T18:00:00Z'
 *                   processos: []
 *                   candidaturasResumo:
 *                     total: 0
 *                     porStatus: {}
 *                   processosResumo:
 *                     total: 0
 *                     porStatus: {}
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
 *         description: Vaga não encontrada
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
router.get('/vagas/:id', supabaseAuthMiddleware(adminRoles), AdminVagasController.get);

/**
 * @openapi
 * /api/v1/empresas/admin/dashboard:
 *   get:
 *     summary: (Admin/Moderador/Recrutador) Listar empresas para dashboard
 *     description: "Retorna uma listagem paginada otimizada com até 10 empresas por página para exibição em dashboards administrativos. Disponível para ADMIN, MODERADOR e RECRUTADOR."
 *     operationId: adminEmpresasDashboardList
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
 *         description: Página atual da paginação (10 resultados por página)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           minimum: 3
 *         description: Filtra resultados por nome, código, e-mail ou CNPJ
 *     responses:
 *       200:
 *         description: Lista paginada de empresas para o dashboard
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresasDashboardListResponse'
 *             examples:
 *               default:
 *                 summary: Página inicial do dashboard
 *                 value:
 *                   data:
 *                     - id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                       codUsuario: EMP-123456
 *                       nome: Advance Tech Consultoria
 *                       email: contato@advance.com.br
 *                       telefone: '+55 11 99999-0000'
 *                       avatarUrl: https://cdn.advance.com.br/logo.png
 *                       cnpj: '12345678000190'
 *                       status: ATIVO
 *                       criadoEm: '2024-01-05T12:00:00Z'
 *                       vagasPublicadas: 8
 *                       limiteVagasPlano: 10
 *                       plano:
 *                         id: 38f73d2d-40fa-47a6-9657-6a4f7f1bb610
 *                         nome: Plano Avançado
 *                         modo: PARCEIRO
 *                         status: ATIVO
 *                         inicio: '2024-01-10T12:00:00Z'
 *                         fim: null
 *                         modeloPagamento: ASSINATURA
 *                         metodoPagamento: PIX
 *                         statusPagamento: APROVADO
 *                         valor: '249.90'
 *                         quantidadeVagas: 10
 *                         duracaoEmDias: null
 *                         diasRestantes: 18
 *                       bloqueada: false
 *                       bloqueioAtivo: null
 *                   pagination:
 *                     page: 1
 *                     pageSize: 10
 *                     total: 42
 *                     totalPages: 5
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
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/dashboard',
  supabaseAuthMiddleware(dashboardRoles),
  AdminEmpresasController.listDashboard,
);

/**
 * @openapi
 * /api/v1/empresas/admin/validate-cnpj:
 *   get:
 *     summary: (Admin/Moderador) Validar CNPJ de empresa
 *     description: "Verifica se um CNPJ é válido e identifica se já está cadastrado na plataforma."
 *     operationId: adminEmpresasValidateCnpj
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cnpj
 *         required: true
 *         schema:
 *           type: string
 *         description: CNPJ a ser validado (com ou sem máscara)
 *     responses:
 *       200:
 *         description: Resultado da validação do CNPJ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaValidateCnpjResponse'
 *             examples:
 *               disponivel:
 *                 summary: CNPJ válido e disponível
 *                 value:
 *                   success: true
 *                   cnpj:
 *                     input: '11.000.000/0001-00'
 *                     normalized: '11000000000100'
 *                     formatted: '11.000.000/0001-00'
 *                     valid: true
 *                   exists: false
 *                   available: true
 *                   empresa: null
 *               emUso:
 *                 summary: CNPJ já vinculado a uma empresa
 *                 value:
 *                   success: true
 *                   cnpj:
 *                     input: '12.345.678/0001-90'
 *                     normalized: '12345678000190'
 *                     formatted: '12.345.678/0001-90'
 *                     valid: true
 *                   exists: true
 *                   available: false
 *                   empresa:
 *                     id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10'
 *                     nome: 'Advance Tech Consultoria'
 *                     email: 'contato@advance.com.br'
 *                     telefone: '+55 11 99999-0000'
 *                     codUsuario: 'EMP-123456'
 *                     status: 'ATIVO'
 *                     role: 'EMPRESA'
 *                     tipoUsuario: 'PESSOA_JURIDICA'
 *                     criadoEm: '2024-01-05T12:00:00Z'
 *                     atualizadoEm: '2024-05-20T08:15:00Z'
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
router.get(
  '/validate-cnpj',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.validateCnpj,
);

/**
 * @openapi
 * /api/v1/empresas/admin/validate-cpf:
 *   get:
 *     summary: (Admin/Moderador) Validar CPF de usuário
 *     description: "Verifica se um CPF é válido e identifica se já está cadastrado na plataforma."
 *     operationId: adminEmpresasValidateCpf
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cpf
 *         required: true
 *         schema:
 *           type: string
 *         description: CPF a ser validado (com ou sem máscara)
 *     responses:
 *       200:
 *         description: Resultado da validação do CPF
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaValidateCpfResponse'
 *             examples:
 *               disponivel:
 *                 summary: CPF válido e disponível
 *                 value:
 *                   success: true
 *                   cpf:
 *                     input: '123.456.789-09'
 *                     normalized: '12345678909'
 *                     formatted: '123.456.789-09'
 *                     valid: true
 *                   exists: false
 *                   available: true
 *                   usuario: null
 *               emUso:
 *                 summary: CPF já vinculado a um usuário
 *                 value:
 *                   success: true
 *                   cpf:
 *                     input: '987.654.321-00'
 *                     normalized: '98765432100'
 *                     formatted: '987.654.321-00'
 *                     valid: true
 *                   exists: true
 *                   available: false
 *                   usuario:
 *                     id: '0d7cda92-8ee9-4d9b-9b98-2f5fb2f6d125'
 *                     nome: 'Maria Souza'
 *                     email: 'maria.souza@example.com'
 *                     telefone: '+55 21 98888-0000'
 *                     codUsuario: 'USR-789012'
 *                     status: 'ATIVO'
 *                     role: 'CANDIDATO'
 *                     tipoUsuario: 'PESSOA_FISICA'
 *                     criadoEm: '2024-02-10T10:30:00Z'
 *                     atualizadoEm: '2024-05-18T15:45:00Z'
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
router.get(
  '/validate-cpf',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.validateCpf,
);

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
 *                   planosEmpresariaisId: b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e
 *                   modo: teste
 *                   diasTeste: 30
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
 *                       nome: Plano Avançado
 *                       modo: PARCEIRO
 *                       status: ATIVO
 *                       inicio: '2024-01-10T12:00:00Z'
 *                       fim: null
 *                       modeloPagamento: ASSINATURA
 *                       metodoPagamento: PIX
 *                       statusPagamento: APROVADO
 *                       valor: '249.90'
 *                       quantidadeVagas: 10
 *                       duracaoEmDias: null
 *                       diasRestantes: 30
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
 *                       avatarUrl: https://cdn.advance.com.br/logo.png
 *                       cnpj: '12345678000190'
 *                       cidade: São Paulo
 *                       estado: SP
 *                       enderecos:
 *                         - id: end-uuid
 *                           logradouro: Av. Paulista
 *                           numero: '1578'
 *                           bairro: Bela Vista
 *                           cidade: São Paulo
 *                           estado: SP
 *                           cep: '01310-200'
 *                       criadoEm: '2024-01-05T12:00:00Z'
 *                       informacoes:
 *                         telefone: '+55 11 99999-0000'
 *                         descricao: Consultoria especializada em tecnologia e recrutamento.
 *                         avatarUrl: https://cdn.advance.com.br/logo.png
 *                         aceitarTermos: true
 *                       ativa: true
 *                       parceira: true
 *                       diasTesteDisponibilizados: 30
 *                       plano:
 *                         id: 38f73d2d-40fa-47a6-9657-6a4f7f1bb610
 *                         nome: Plano Avançado
 *                         modo: PARCEIRO
 *                         status: ATIVO
 *                         inicio: '2024-01-10T12:00:00Z'
 *                         fim: null
 *                         modeloPagamento: ASSINATURA
 *                         metodoPagamento: PIX
 *                         statusPagamento: APROVADO
 *                         valor: '249.90'
 *                         quantidadeVagas: 10
 *                         duracaoEmDias: null
 *                         diasRestantes: 18
 *                       vagasPublicadas: 8
 *                       limiteVagasPlano: 10
 *                       bloqueada: false
 *                       bloqueioAtivo: null
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
 * /api/v1/empresas/admin/{id}/plano:
 *   post:
 *     summary: (Admin/Moderador) Cadastrar plano manualmente para a empresa
 *     description: "Permite registrar manualmente um novo plano empresarial para a empresa selecionada. Qualquer plano ativo é automaticamente cancelado antes do novo vínculo. Quando informados, os campos de próxima cobrança ou período de carência definem automaticamente a data de término do plano. A ação é registrada na auditoria da empresa com descrição consolidada incluindo: nome do plano, tipo de vínculo (Cliente/Parceiro/Avaliação), método de pagamento, status do pagamento e período de teste em dias (quando for modo Avaliação). Endpoint restrito aos perfis ADMIN e MODERADOR."
 *     operationId: adminEmpresasAssignPlanoManual
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
 *         description: Identificador da empresa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminEmpresasPlanoManualAssignInput'
 *           examples:
 *             pagamentoConfirmado:
 *               summary: Cadastro com pagamento aprovado e dados financeiros
 *               value:
 *                 planosEmpresariaisId: 7d1c88e3-90e7-43df-9a29-b4096b5a79c4
 *                 modo: cliente
 *                 iniciarEm: '2024-05-10T12:00:00Z'
 *                 modeloPagamento: ASSINATURA
 *                 metodoPagamento: PIX
 *                 statusPagamento: APROVADO
 *             cortesiaTeste:
 *               summary: Concessão manual de período teste
 *               value:
 *                 planosEmpresariaisId: 6db3f1f2-5a8b-4cf7-9341-2bb6d78c9a10
 *                 modo: teste
 *                 diasTeste: 14
 *     responses:
 *       201:
 *         description: Plano cadastrado manualmente com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaDetailResponse'
 *             examples:
 *               cadastrado:
 *                 summary: Novo plano manual ativo
 *                 value:
 *                   empresa:
 *                     id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                     nome: Advance Tech Consultoria LTDA
 *                     status: ATIVO
 *                     plano:
 *                       id: 38f73d2d-40fa-47a6-9657-6a4f7f1bb610
 *                       nome: Plano Corporativo Premium
 *                       modo: CLIENTE
 *                       status: ATIVO
 *                       inicio: '2024-05-10T12:00:00Z'
 *                       fim: '2024-06-10T12:00:00Z'
 *                       modeloPagamento: ASSINATURA
 *                       metodoPagamento: PIX
 *                       statusPagamento: APROVADO
 *                       valor: '349.90'
 *                       quantidadeVagas: 20
 *                       duracaoEmDias: 31
 *                       diasRestantes: 12
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
 *         description: Empresa ou plano empresarial não encontrados
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
 *   put:
 *     summary: (Admin/Moderador) Atualizar plano da empresa
 *     description: "Atualiza ou atribui um novo plano empresarial para a empresa informada, permitindo também o ajuste de dados de cobrança manual (modelo, método, status, próximas cobranças e período de carência). A ação é registrada na auditoria da empresa com descrição consolidada incluindo: nome do plano anterior e novo, tipo de vínculo (Cliente/Parceiro/Avaliação), método de pagamento, status do pagamento e período de teste (quando aplicável). Endpoint restrito aos perfis ADMIN e MODERADOR."
 *     operationId: adminEmpresasUpdatePlano
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
 *         description: Identificador da empresa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminEmpresasPlanoUpdateInput'
 *           examples:
 *             manterPeriodo:
 *               summary: Atualização mantendo período vigente
 *               value:
 *                 planosEmpresariaisId: b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e
 *                 modo: parceiro
 *                 statusPagamento: APROVADO
 *                 proximaCobranca: '2024-06-15T12:00:00Z'
 *             resetarPeriodo:
 *               summary: Reiniciar vigência do plano
 *               value:
 *                 planosEmpresariaisId: 0f3b9e4c-1b2a-4d7f-9123-5a6b7c8d9e10
 *                 modo: cliente
 *                 resetPeriodo: true
 *                 modeloPagamento: ASSINATURA
 *                 metodoPagamento: PIX
 *             ajustarGracePeriod:
 *               summary: Ajustar dados financeiros sem trocar de plano
 *               value:
 *                 planosEmpresariaisId: b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e
 *                 modo: cliente
 *                 graceUntil: '2024-06-30T23:59:59Z'
 *     responses:
 *       200:
 *         description: Plano atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaDetailResponse'
 *             examples:
 *               atualizado:
 *                 summary: Plano redefinido com novo período
 *                 value:
 *                   empresa:
 *                     id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                     nome: Advance Tech Consultoria LTDA
 *                     status: ATIVO
 *                     plano:
 *                       id: 38f73d2d-40fa-47a6-9657-6a4f7f1bb610
 *                       nome: Plano Avançado
 *                       modo: PARCEIRO
 *                       status: ATIVO
 *                       inicio: '2024-05-01T12:00:00Z'
 *                       fim: '2024-08-01T12:00:00Z'
 *                       modeloPagamento: ASSINATURA
 *                       metodoPagamento: PIX
 *                       statusPagamento: APROVADO
 *                       proximaCobranca: '2024-06-15T12:00:00Z'
 *                       graceUntil: null
 *                       valor: '249.90'
 *                       quantidadeVagas: 10
 *                       duracaoEmDias: 92
 *                       diasRestantes: 65
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
 *         description: Empresa ou plano empresarial não encontrados
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
router.post(
  '/:id/plano',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.assignPlanoManual,
);
router.put('/:id/plano', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.updatePlano);

/**
 * @openapi
 * /api/v1/empresas/admin/{id}:
 *   put:
 *     summary: (Admin) Atualizar empresa
 *     description: "Atualiza dados cadastrais da empresa, permite redefinir a senha e gerenciar o plano vinculado. Apenas os campos enviados no payload são atualizados e auditados. O sistema registra automaticamente na auditoria apenas as alterações reais dos campos fornecidos: endereço (CEP, logradouro, número, bairro, cidade, estado), telefone, redes sociais (Instagram, LinkedIn, Facebook, YouTube, Twitter, TikTok), descrição da empresa e planos empresariais. Endpoint restrito aos perfis ADMIN e MODERADOR."
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
 *             atualizacaoCompleta:
 *               summary: Atualização completa com auditoria detalhada
 *               value:
 *                 telefone: '11912345678'
 *                 logradouro: 'Rua Manoel Pedro de Oliveira'
 *                 numero: '245'
 *                 bairro: 'Benedito Bentes'
 *                 cep: '57084028'
 *                 cidade: 'Maceió'
 *                 estado: 'AL'
 *                 descricao: Consultoria especializada em tecnologia e inovação.
 *                 instagram: '@advancetech'
 *                 linkedin: 'https://linkedin.com/company/advancetech'
 *                 senha: NovaSenhaForte123!
 *                 confirmarSenha: NovaSenhaForte123!
 *                 status: ATIVO
 *                 plano:
 *                   planosEmpresariaisId: b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e
 *                   modo: parceiro
 *                   resetPeriodo: false
 *             apenasEndereco:
 *               summary: Atualização apenas do endereço
 *               value:
 *                 logradouro: 'Av. Paulista'
 *                 numero: '1000'
 *                 bairro: 'Bela Vista'
 *                 cidade: 'São Paulo'
 *                 estado: 'SP'
 *                 cep: '01310000'
 *             apenasRedesSociais:
 *               summary: Atualização das redes sociais
 *               value:
 *                 instagram: '@novaempresa'
 *                 linkedin: 'https://linkedin.com/company/novaempresa'
 *                 facebook: 'https://facebook.com/novaempresa'
 *                 youtube: 'https://youtube.com/novaempresa'
 *             apenasDescricao:
 *               summary: Atualização da descrição da empresa
 *               value:
 *                 descricao: Nova descrição da empresa focada em inovação e tecnologia.
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
 *                       nome: Plano Avançado
 *                       modo: PARCEIRO
 *                       status: ATIVO
 *                       inicio: '2024-01-10T12:00:00Z'
 *                       fim: null
 *                       modeloPagamento: ASSINATURA
 *                       metodoPagamento: PIX
 *                       statusPagamento: APROVADO
 *                       valor: '249.90'
 *                       quantidadeVagas: 10
 *                       duracaoEmDias: null
 *                       diasRestantes: 12
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
 *     summary: (Admin) Visão completa da empresa
 *     description: "Retorna uma visão consolidada da empresa (Pessoa Jurídica) incluindo plano atual e histórico, vagas, candidaturas, pagamentos, bloqueios ativos e histórico de auditoria. O sistema de auditoria registra automaticamente apenas as alterações reais dos campos modificados, incluindo descrições consolidadas para planos (com vínculo, método de pagamento, status e período de teste quando aplicável). Apenas perfis ADMIN e MODERADOR podem acessar."
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
 *         description: Visão geral carregada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaOverviewResponse'
 *             examples:
 *               default:
 *                 summary: Dados consolidados da empresa
 *                 value:
 *                   empresa:
 *                     id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                     codUsuario: EMP-123456
 *                     nome: Advance Tech Consultoria
 *                     email: contato@advance.com.br
 *                     telefone: '+55 11 99999-0000'
 *                     avatarUrl: https://cdn.advance.com.br/logo.png
 *                     cnpj: '12345678000190'
 *                     descricao: Consultoria especializada em tecnologia e recrutamento.
 *                     socialLinks:
 *                       linkedin: https://linkedin.com/company/advancemais
 *                     cidade: São Paulo
 *                     estado: SP
 *                     criadoEm: '2023-11-01T08:30:00Z'
 *                     status: ATIVO
 *                     ultimoLogin: '2024-03-15T18:45:00Z'
 *                     ativa: true
 *                     parceira: true
 *                     diasTesteDisponibilizados: 30
 *                     planoAtual: null
 *                     bloqueada: false
 *                     bloqueioAtivo: null
 *                     informacoes:
 *                       telefone: null
 *                       descricao: null
 *                       avatarUrl: null
 *                       genero: null
 *                       dataNasc: null
 *                       inscricao: null
 *                       aceitarTermos: true
 *                   planos:
 *                     ativos:
 *                       - id: 38f73d2d-40fa-47a6-9657-6a4f7f1bb610
 *                         nome: Plano Avançado
 *                         modo: PARCEIRO
 *                         status: ATIVO
 *                         inicio: '2024-01-10T12:00:00Z'
 *                         fim: null
 *                         modeloPagamento: ASSINATURA
 *                         metodoPagamento: PIX
 *                         statusPagamento: APROVADO
 *                         valor: '249.90'
 *                         quantidadeVagas: 10
 *                         duracaoEmDias: null
 *                         diasRestantes: 12
 *                         origin: ADMIN
 *                         criadoEm: '2024-01-05T12:00:00Z'
 *                         atualizadoEm: '2024-03-01T12:00:00Z'
 *                         proximaCobranca: '2024-04-10T12:00:00Z'
 *                         graceUntil: null
 *                     historico:
 *                       - id: 28f73d2d-40fa-47a6-9657-6a4f7f1bb600
 *                         nome: Plano Essencial
 *                         modo: CLIENTE
 *                         status: EXPIRADO
 *                         inicio: '2023-08-10T12:00:00Z'
 *                         fim: '2023-11-10T12:00:00Z'
 *                         modeloPagamento: ASSINATURA
 *                         metodoPagamento: CARTAO
 *                         statusPagamento: EXPIRADO
 *                         valor: '149.90'
 *                         quantidadeVagas: 5
 *                         duracaoEmDias: 92
 *                         diasRestantes: 0
 *                         origin: CHECKOUT
 *                         criadoEm: '2023-08-05T12:00:00Z'
 *                         atualizadoEm: '2023-11-10T12:00:00Z'
 *                         proximaCobranca: null
 *                         graceUntil: null
 *                       - id: 18f73d2d-40fa-47a6-9657-6a4f7f1bb500
 *                         nome: Plano Básico
 *                         modo: CLIENTE
 *                         status: EXPIRADO
 *                         inicio: '2023-05-01T12:00:00Z'
 *                         fim: '2023-08-01T12:00:00Z'
 *                         modeloPagamento: ASSINATURA
 *                         metodoPagamento: CARTAO
 *                         statusPagamento: EXPIRADO
 *                         valor: '99.90'
 *                         quantidadeVagas: 2
 *                         duracaoEmDias: 92
 *                         diasRestantes: 0
 *                         origin: CHECKOUT
 *                         criadoEm: '2023-04-25T12:00:00Z'
 *                         atualizadoEm: '2023-08-01T12:00:00Z'
 *                         proximaCobranca: null
 *                         graceUntil: null
 *                       - id: 08f73d2d-40fa-47a6-9657-6a4f7f1bb400
 *                         nome: Plano Teste
 *                         modo: CLIENTE
 *                         status: EXPIRADO
 *                         inicio: '2023-02-01T12:00:00Z'
 *                         fim: '2023-05-01T12:00:00Z'
 *                         modeloPagamento: ASSINATURA
 *                         metodoPagamento: PIX
 *                         statusPagamento: EXPIRADO
 *                         valor: '49.90'
 *                         quantidadeVagas: 1
 *                         duracaoEmDias: 89
 *                         diasRestantes: 0
 *                         origin: ADMIN
 *                         criadoEm: '2023-01-25T12:00:00Z'
 *                         atualizadoEm: '2023-05-01T12:00:00Z'
 *                         proximaCobranca: null
 *                         graceUntil: null
 *                       - id: f8f73d2d-40fa-47a6-9657-6a4f7f1bb300
 *                         nome: Plano Inicial
 *                         modo: CLIENTE
 *                         status: CANCELADO
 *                         inicio: '2022-12-01T12:00:00Z'
 *                         fim: '2023-02-01T12:00:00Z'
 *                         modeloPagamento: ASSINATURA
 *                         metodoPagamento: CARTAO
 *                         statusPagamento: CANCELADO
 *                         valor: '29.90'
 *                         quantidadeVagas: 1
 *                         duracaoEmDias: 62
 *                         diasRestantes: 0
 *                         origin: CHECKOUT
 *                         criadoEm: '2022-11-25T12:00:00Z'
 *                         atualizadoEm: '2023-02-01T12:00:00Z'
 *                         proximaCobranca: null
 *                         graceUntil: null
 *                   pagamentos:
 *                     total: 12
 *                     recentes:
 *                       - id: 729480a9-8e05-4b42-b826-f8db7e5a4d2c
 *                         tipo: ASSINATURA
 *                         status: APROVADO
 *                         mensagem: Pagamento confirmado pelo provedor
 *                         externalRef: MP-123456789
 *                         mpResourceId: res_ABC123
 *                         criadoEm: '2024-02-10T12:00:00Z'
 *                         plano:
 *                           id: 38f73d2d-40fa-47a6-9657-6a4f7f1bb610
 *                           nome: Plano Avançado
 *                   vagas:
 *                     total: 18
 *                     porStatus:
 *                       PUBLICADO: 8
 *                       EM_ANALISE: 2
 *                       RASCUNHO: 3
 *                       EXPIRADO: 1
 *                       DESPUBLICADA: 0
 *                       PAUSADA: 2
 *                       ENCERRADA: 2
 *                     recentes:
 *                       - id: 7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91
 *                         codigo: B24N56
 *                         titulo: Analista de Dados Pleno
 *                         status: PUBLICADO
 *                         inseridaEm: '2024-05-10T09:00:00Z'
 *                         atualizadoEm: '2024-05-12T11:30:00Z'
 *                         modalidade: HIBRIDO
 *                         regimeDeTrabalho: CLT
 *                         numeroVagas: 2
 *                         jornada: PRESENCIAL
 *                         vagaEmDestaque: true
 *                   candidaturas:
 *                     total: 134
 *                     porStatus:
 *                       RECEBIDA: 80
 *                       EM_ANALISE: 20
 *                       ENTREVISTA: 10
 *                       DESAFIO: 6
 *                       DOCUMENTACAO: 5
 *                       CONTRATADO: 4
 *                       RECUSADO: 7
 *                       DESISTIU: 1
 *                       NAO_COMPARECEU: 1
 *                       EM_TRIAGEM: 0
 *                       ARQUIVADO: 0
 *                       CANCELADO: 0
 *                   bloqueios:
 *                     ativos: []
 *                     historico:
 *                       - id: bloq_123456
 *                         alvo:
 *                           tipo: EMPRESA
 *                           id: f66fbad9-4d3c-41f7-90df-2f4f0f32af10
 *                           nome: Advance Tech Consultoria
 *                           role: EMPRESA
 *                         bloqueio:
 *                           tipo: TEMPORARIO
 *                           motivo: VIOLACAO_POLITICAS
 *                           status: REVOGADO
 *                           inicio: '2023-09-20T14:00:00Z'
 *                           fim: '2023-09-30T14:00:00Z'
 *                           observacoes: 'Uso indevido de dados pessoais de candidatos.'
 *                         aplicadoPor:
 *                           id: adm_002
 *                           nome: Carlos Supervisor
 *                           role: ADMIN
 *                         auditoria:
 *                           criadoEm: '2023-09-20T14:05:00Z'
 *                           atualizadoEm: '2023-09-25T10:15:00Z'
 *                   auditoria:
 *                     total: 18
 *                     recentes:
 *                       - id: audit_123460
 *                         acao: EMPRESA_ATUALIZADA
 *                         campo: endereco_completo
 *                         valorAnterior: '{"logradouro":"Rua Antiga","numero":"123","bairro":"Centro","cidade":"Maceió","estado":"AL","cep":"57000000"}'
 *                         valorNovo: '{"logradouro":"Rua Manoel Pedro de Oliveira","numero":"245","bairro":"Benedito Bentes","cidade":"Maceió","estado":"AL","cep":"57084028"}'
 *                         descricao: 'Endereço atualizado: logradouro (Rua Antiga → Rua Manoel Pedro de Oliveira), numero (123 → 245), bairro (Centro → Benedito Bentes), cep (57000000 → 57084028)'
 *                         metadata:
 *                           tipo: 'endereco_completo'
 *                           alteracoes:
 *                             - campo: 'logradouro'
 *                               valorAnterior: 'Rua Antiga'
 *                               valorNovo: 'Rua Manoel Pedro de Oliveira'
 *                             - campo: 'numero'
 *                               valorAnterior: '123'
 *                               valorNovo: '245'
 *                             - campo: 'bairro'
 *                               valorAnterior: 'Centro'
 *                               valorNovo: 'Benedito Bentes'
 *                             - campo: 'cep'
 *                               valorAnterior: '57000000'
 *                               valorNovo: '57084028'
 *                         criadoEm: '2024-10-25T16:45:00Z'
 *                         alteradoPor:
 *                           id: user_123456
 *                           nomeCompleto: 'João Silva'
 *                           role: 'ADMIN'
 *                       - id: audit_123461
 *                         acao: EMPRESA_ATUALIZADA
 *                         campo: social_instagram
 *                         valorAnterior: ''
 *                         valorNovo: '@advancetech'
 *                         descricao: 'Rede social Instagram alterada de "vazio" para "@advancetech"'
 *                         metadata: null
 *                         criadoEm: '2024-10-25T16:40:00Z'
 *                         alteradoPor:
 *                           id: user_123456
 *                           nomeCompleto: 'João Silva'
 *                           role: 'ADMIN'
 *                       - id: audit_123462
 *                         acao: EMPRESA_ATUALIZADA
 *                         campo: telefone
 *                         valorAnterior: '11987654321'
 *                         valorNovo: '11912345678'
 *                         descricao: 'Telefone alterado de "11987654321" para "11912345678"'
 *                         metadata: null
 *                         criadoEm: '2024-10-25T16:35:00Z'
 *                         alteradoPor:
 *                           id: user_123456
 *                           nomeCompleto: 'João Silva'
 *                           role: 'ADMIN'
 *                       - id: audit_123463
 *                         acao: EMPRESA_ATUALIZADA
 *                         campo: descricao
 *                         valorAnterior: 'Consultoria em tecnologia'
 *                         valorNovo: 'Consultoria especializada em tecnologia e inovação.'
 *                         descricao: 'Descrição da empresa alterada de "Consultoria em tecnologia" para "Consultoria especializada em tecnologia e inovação."'
 *                         metadata: null
 *                         criadoEm: '2024-10-25T16:30:00Z'
 *                         alteradoPor:
 *                           id: user_123456
 *                           nomeCompleto: 'João Silva'
 *                           role: 'ADMIN'
 *                       - id: audit_123464
 *                         acao: PLANO_ASSIGNADO
 *                         campo: null
 *                         valorAnterior: null
 *                         valorNovo: null
 *                         descricao: 'Plano atribuído: Plano Premium - Vínculo: Parceiro - Método: PIX - Status: Aprovado'
 *                         metadata:
 *                           planoAnterior: null
 *                           planoNovo:
 *                             id: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e'
 *                             nome: 'Plano Premium'
 *                             modo: 'PARCEIRO'
 *                             status: 'ATIVO'
 *                             modeloPagamento: 'ASSINATURA'
 *                             metodoPagamento: 'PIX'
 *                             statusPagamento: 'APROVADO'
 *                             diasTeste: null
 *                         criadoEm: '2024-10-25T16:25:00Z'
 *                         alteradoPor:
 *                           id: user_123456
 *                           nomeCompleto: 'João Silva'
 *                           role: 'ADMIN'
 *                       - id: audit_123465
 *                         acao: PLANO_ATUALIZADO
 *                         campo: null
 *                         valorAnterior: null
 *                         valorNovo: null
 *                         descricao: 'Plano alterado de "Plano Básico" (Cliente) para "Plano Premium" (Parceiro) - Método: PIX - Status: Aprovado'
 *                         metadata:
 *                           planoAnterior:
 *                             id: 'a1b2c3d4-5678-90ab-cdef-123456789abc'
 *                             nome: 'Plano Básico'
 *                             modo: 'CLIENTE'
 *                             status: 'ATIVO'
 *                             modeloPagamento: 'ASSINATURA'
 *                             metodoPagamento: 'CARTAO'
 *                             statusPagamento: 'APROVADO'
 *                             diasTeste: null
 *                           planoNovo:
 *                             id: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e'
 *                             nome: 'Plano Premium'
 *                             modo: 'PARCEIRO'
 *                             status: 'ATIVO'
 *                             modeloPagamento: 'ASSINATURA'
 *                             metodoPagamento: 'PIX'
 *                             statusPagamento: 'APROVADO'
 *                             diasTeste: null
 *                         criadoEm: '2024-10-25T16:20:00Z'
 *                         alteradoPor:
 *                           id: user_123456
 *                           nomeCompleto: 'João Silva'
 *                           role: 'ADMIN'
 *                       - id: audit_123466
 *                         acao: PLANO_ASSIGNADO
 *                         campo: null
 *                         valorAnterior: null
 *                         valorNovo: null
 *                         descricao: 'Plano atribuído: Plano Teste - Vínculo: Avaliação - Método: PIX - Status: Aprovado - Período de teste: 15 dias'
 *                         metadata:
 *                           planoAnterior: null
 *                           planoNovo:
 *                             id: 'c9e8d7f6-5432-10ba-fedc-987654321xyz'
 *                             nome: 'Plano Teste'
 *                             modo: 'TESTE'
 *                             status: 'ATIVO'
 *                             modeloPagamento: 'ASSINATURA'
 *                             metodoPagamento: 'PIX'
 *                             statusPagamento: 'APROVADO'
 *                             diasTeste: 15
 *                         criadoEm: '2024-10-25T16:15:00Z'
 *                         alteradoPor:
 *                           id: user_123456
 *                           nomeCompleto: 'João Silva'
 *                           role: 'ADMIN'
 *                       - id: audit_123456
 *                         acao: EMPRESA_ATUALIZADA
 *                         campo: nome
 *                         valorAnterior: 'Empresa Antiga'
 *                         valorNovo: 'Advance Tech Consultoria'
 *                         descricao: 'Nome alterado de "Empresa Antiga" para "Advance Tech Consultoria"'
 *                         metadata: null
 *                         criadoEm: '2024-10-25T15:30:00Z'
 *                         alteradoPor:
 *                           id: user_123456
 *                           nomeCompleto: 'João Silva'
 *                           role: 'ADMIN'
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
 * /api/v1/empresas/admin/{id}/bloqueios:
 *   get:
 *     summary: (Admin) Listar bloqueios aplicados
 *     description: "Retorna o histórico de bloqueios aplicados ao usuário da empresa, detalhando vigência, status e responsável."
 *     operationId: adminEmpresasListBloqueios
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
 *         description: Histórico de bloqueios retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUsuariosBloqueiosResponse'
 *             examples:
 *               default:
 *                 summary: Bloqueios da empresa
 *                 value:
 *                   data:
 *                     - id: bloq_123456
 *                       alvo:
 *                         tipo: EMPRESA
 *                         id: cmp_112233
 *                         nome: Empresa XPTO
 *                         role: EMPRESA
 *                       bloqueio:
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
 *     summary: (Admin) Aplicar bloqueio à empresa
 *     description: "Centraliza o bloqueio do usuário da empresa, permitindo bloqueios temporários ou permanentes. A ação é automaticamente registrada na auditoria da empresa com detalhes do motivo e responsável."
 *     operationId: adminEmpresasAplicarBloqueio
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
 *             $ref: '#/components/schemas/AdminUsuariosEmBloqueiosCreate'
 *           examples:
 *             default:
 *               summary: Bloqueio de 30 dias com motivo
 *               value:
 *                 tipo: TEMPORARIO
 *                 motivo: VIOLACAO_POLITICAS
 *                 dias: 30
 *                 observacoes: Uso indevido de dados pessoais de candidatos.
 *     responses:
 *       201:
 *         description: Bloqueio aplicado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUsuariosEmBloqueiosResponse'
 *             examples:
 *               created:
 *                 summary: Bloqueio registrado
 *                 value:
 *                   bloqueio:
 *                     id: bloq_123456
 *                     alvo:
 *                       tipo: EMPRESA
 *                       id: cmp_112233
 *                       nome: Empresa XPTO
 *                       role: EMPRESA
 *                     bloqueio:
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
  '/:id/bloqueios',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.listBloqueios,
);
router.post('/:id/bloqueios', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.block);
/**
 * @openapi
 * /api/v1/empresas/admin/{id}/bloqueios/revogar:
 *   post:
 *     summary: (Admin) Revogar bloqueio ativo
 *     description: "Revoga o bloqueio ativo da empresa, restaura o status do usuário e registra auditoria da ação."
 *     operationId: adminEmpresasRevogarBloqueio
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
 *               observacoes:
 *                 type: string
 *                 description: Comentários opcionais registrados na auditoria da revogação.
 *           examples:
 *             default:
 *               summary: Revogação com comentário
 *               value:
 *                 observacoes: Contato telefônico validou conformidade das operações.
 *     responses:
 *       204:
 *         description: Revogado com sucesso
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
 *         description: Empresa ou bloqueio ativo não encontrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               bloqueioInexistente:
 *                 summary: Nenhum bloqueio ativo encontrado
 *                 value:
 *                   success: false
 *                   code: BLOQUEIO_NOT_FOUND
 *                   message: Nenhum bloqueio ativo encontrado
 *       500:
 *         description: Erro interno ao revogar bloqueio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/bloqueios/revogar',
  supabaseAuthMiddleware(adminRoles),
  AdminEmpresasController.unblock,
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
