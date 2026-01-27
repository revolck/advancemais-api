import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';

import { areasInteresseRoutes } from '../areas-interesse/routes';
import { subareasInteresseRoutes } from '../areas-interesse/routes/subareas';
import { curriculosRoutes } from '@/modules/candidatos/curriculos/routes';
import { CandidaturasController } from '@/modules/candidatos/candidaturas/controllers';
import { CandidatoDashboardController } from '@/modules/candidatos/dashboard/controllers';
import { CandidatoCursosController } from '@/modules/candidatos/cursos/controllers';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@prisma/client';
import { vagasPublicasService } from '@/modules/candidatos/vagas/services';

const router = Router();

/**
 * @openapi
 * /api/v1/candidatos:
 *   get:
 *     summary: Informações do módulo de Candidatos
 *     tags: [Candidatos]
 *     responses:
 *       200:
 *         description: Detalhes do módulo de candidatos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatosModuleInfo'
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
 *           curl -X GET "http://localhost:3000/api/v1/candidatos"
 */
router.get('/', publicCache, (_req, res) => {
  res.json({
    message: 'Candidatos Module API',
    version: 'v1',
    timestamp: new Date().toISOString(),
    endpoints: {
      areasInteresse: '/areas-interesse',
      subareasInteresse: '/subareas-interesse',
      UsuariosCurriculos: '/curriculos',
      aplicar: '/aplicar',
      vagas: '/vagas',
    },
    status: 'operational',
  });
});

router.use('/areas-interesse', areasInteresseRoutes);
router.use('/subareas-interesse', subareasInteresseRoutes);
router.use('/curriculos', curriculosRoutes);
/**
 * @openapi
 * /api/v1/candidatos/vagas:
 *   get:
 *     summary: Listar vagas publicadas (público e dashboard)
 *     description: "Retorna vagas PUBLICADAS com paginação (10 por página por padrão)."
 *     tags: [Candidatos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Texto de busca (titulo/empresa)
 *       - in: query
 *         name: modalidade
 *         schema: { type: string, enum: ['PRESENCIAL','REMOTO','HIBRIDO'] }
 *       - in: query
 *         name: regime
 *         schema: { type: string, enum: ['CLT','TEMPORARIO','ESTAGIO','PJ','HOME_OFFICE','JOVEM_APRENDIZ'] }
 *       - in: query
 *         name: senioridade
 *         schema: { type: string, enum: ['ABERTO','ESTAGIARIO','JUNIOR','PLENO','SENIOR','ESPECIALISTA','LIDER'] }
 *       - in: query
 *         name: areaInteresseId
 *         schema: { type: integer }
 *       - in: query
 *         name: subareaInteresseId
 *         schema: { type: integer }
 *       - in: query
 *         name: cidade
 *         schema: { type: string }
 *       - in: query
 *         name: estado
 *         schema: { type: string }
 *       - in: query
 *         name: empresaId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: codUsuario
 *         schema: { type: string }
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: ['24h','7d','30d'] }
 *     responses:
 *       200:
 *         description: Lista de vagas publicadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VagaPublica'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/vagas', publicCache, async (req, res) => {
  // Helper para aceitar valores simples, arrays (?param=A&param=B) ou CSV (?param=A,B)
  const parseList = <T = string>(input: unknown, map?: (v: string) => T): T[] | undefined => {
    if (!input) return undefined;
    const raw = Array.isArray(input) ? input : String(input).split(',');
    const list = raw
      .map((v) => String(v).trim())
      .filter(Boolean)
      .map((v) => (map ? map(v) : (v as unknown as T)));
    return list.length > 0 ? list : undefined;
  };

  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);

  // Parse e validação de tipos enum
  const modalidadeRaw = parseList<string>(req.query.modalidade);
  const regimeRaw = parseList<string>(req.query.regime);
  const senioridadeRaw = parseList<string>(req.query.senioridade);

  const result = await vagasPublicasService.list({
    page,
    pageSize,
    q: (req.query.q as string) || undefined,
    modalidade: modalidadeRaw as any,
    regime: regimeRaw as any,
    senioridade: senioridadeRaw as any,
    areaInteresseId: parseList<number>(req.query.CandidatosAreasInteresseId, (v) => Number(v)),
    subareaInteresseId: parseList<number>(req.query.CandidatosSubareasInteresseId, (v) =>
      Number(v),
    ),
    cidade: (req.query.cidade as string) || undefined,
    estado: (req.query.estado as string) || undefined,
    empresaId: (req.query.UsuariosId as string) || undefined,
    codUsuario: (req.query.codUsuario as string) || undefined,
    period: (req.query.period as any) || undefined,
  });
  res.json(result);
});
/**
 * @openapi
 * /api/v1/candidatos/aplicar:
 *   post:
 *     summary: Aplicar a uma vaga usando um currículo
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vagaId, curriculoId]
 *             properties:
 *               vagaId: { type: string, format: uuid }
 *               curriculoId: { type: string, format: uuid }
 *               consentimentos: { type: object, nullable: true }
 *     responses:
 *       201:
 *         description: Candidatura registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresasCandidatos'
 */
router.post(
  '/aplicar',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CandidaturasController.apply,
);
/**
 * @openapi
 * /api/v1/candidatos/candidaturas:
 *   get:
 *     summary: Listar minhas candidaturas
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: vagaId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items: { type: string, enum: ['RECEBIDA','EM_ANALISE','EM_TRIAGEM','ENTREVISTA','DESAFIO','DOCUMENTACAO','CONTRATADO','RECUSADO','DESISTIU','NAO_COMPARECEU','ARQUIVADO','CANCELADO'] }
 *     responses:
 *       200:
 *         description: Lista de candidaturas do candidato
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmpresasCandidatosResumo'
 */
router.get(
  '/candidaturas',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CandidaturasController.listMine,
);
router.get(
  '/candidaturas/verificar',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CandidaturasController.checkApplied,
);
/**
 * @openapi
 * /api/v1/candidatos/candidaturas/verificar:
 *   get:
 *     summary: Verificar se já se candidatou a uma vaga
 *     description: "Verifica se o candidato autenticado já se candidatou à vaga especificada. Retorna um objeto simples indicando se já se candidatou e, caso positivo, informações básicas da candidatura."
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: vagaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da vaga para verificar
 *     responses:
 *       200:
 *         description: Resultado da verificação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     hasApplied:
 *                       type: boolean
 *                       example: true
 *                     candidatura:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         vagaId:
 *                           type: string
 *                           format: uuid
 *                         curriculoId:
 *                           type: string
 *                           format: uuid
 *                           nullable: true
 *                         status:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             nome:
 *                               type: string
 *                             descricao:
 *                               type: string
 *                         aplicadaEm:
 *                           type: string
 *                           format: date-time
 *                 - type: object
 *                   properties:
 *                     hasApplied:
 *                       type: boolean
 *                       example: false
 *             examples:
 *               jaCandidatou:
 *                 summary: Já se candidatou
 *                 value:
 *                   hasApplied: true
 *                   candidatura:
 *                     id: "550e8400-e29b-41d4-a716-446655440000"
 *                     vagaId: "660e8400-e29b-41d4-a716-446655440001"
 *                     curriculoId: "880e8400-e29b-41d4-a716-446655440003"
 *                     status:
 *                       id: "aa0e8400-e29b-41d4-a716-446655440005"
 *                       nome: "Recebida"
 *                       descricao: "Candidatura recebida e aguardando análise"
 *                     aplicadaEm: "2024-01-15T10:30:00.000Z"
 *               naoCandidatou:
 *                 summary: Não se candidatou
 *                 value:
 *                   hasApplied: false
 *       400:
 *         description: vagaId não fornecido
 *       401:
 *         description: Não autenticado
 *       500:
 *         description: Erro interno do servidor
 */
/**
 * @openapi
 * /api/v1/candidatos/candidaturas/overview:
 *   get:
 *     summary: Visão consolidada de candidatos e vagas
 *     description: "Retorna candidatos únicos com seus currículos e candidaturas agrupadas por vaga. Empresas visualizam apenas suas vagas; administradores, moderadores e setor de vagas podem consultar todo o sistema; recrutadores visualizam apenas vagas vinculadas."
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: empresaUsuarioId
 *         schema: { type: string, format: uuid }
 *         description: "Filtra por empresa específica. ADMIN/MODERADOR/SETOR_DE_VAGAS podem filtrar qualquer empresa; RECRUTADOR apenas empresas com vagas vinculadas."
 *       - in: query
 *         name: vagaId
 *         schema: { type: string, format: uuid }
 *         description: "Filtra candidaturas de uma vaga específica."
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items: { $ref: '#/components/schemas/StatusProcesso' }
 *         style: form
 *         explode: false
 *         description: "Lista de status (separados por vírgula) para filtrar candidaturas."
 *       - in: query
 *         name: search
 *         schema: { type: string, minLength: 3, maxLength: 180 }
 *         description: "Busca por nome, e-mail, CPF ou código do candidato."
 *       - in: query
 *         name: onlyWithCandidaturas
 *         schema: { type: boolean }
 *         description: "Força o filtro para candidatos com candidaturas mesmo sem parâmetros adicionais."
 *     responses:
 *       200:
 *         description: Lista consolidada de candidatos e candidaturas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatosOverviewResponse'
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
router.get(
  '/candidaturas/overview',
  supabaseAuthMiddleware([
    Roles.EMPRESA,
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.SETOR_DE_VAGAS,
    Roles.RECRUTADOR,
  ]),
  CandidaturasController.overview,
);
/**
 * @openapi
 * /api/v1/candidatos/candidaturas/recebidas:
 *   get:
 *     summary: Listar candidaturas recebidas pela empresa
 *     description: "Retorna as candidaturas visíveis para a empresa. Por padrão, candidaturas com status CANCELADO são omitidas."
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: vagaId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items: { type: string, enum: ['RECEBIDA','EM_ANALISE','EM_TRIAGEM','ENTREVISTA','DESAFIO','DOCUMENTACAO','CONTRATADO','RECUSADO','DESISTIU','NAO_COMPARECEU','ARQUIVADO','CANCELADO'] }
 *     responses:
 *       200:
 *         description: Lista de candidaturas recebidas pela empresa
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmpresasCandidatosRecebida'
 */
router.get(
  '/candidaturas/recebidas',
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.EMPRESA, Roles.SETOR_DE_VAGAS]),
  CandidaturasController.listReceived,
);

/**
 * @openapi
 * /api/v1/candidatos/candidaturas/{id}:
 *   get:
 *     summary: Obter detalhes de uma candidatura
 *     description: Retorna dados completos de uma candidatura específica
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados da candidatura
 *       404:
 *         description: Candidatura não encontrada
 */
router.get(
  '/candidaturas/:id',
  supabaseAuthMiddleware([
    Roles.ALUNO_CANDIDATO,
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.EMPRESA,
    Roles.SETOR_DE_VAGAS,
    Roles.RECRUTADOR,
  ]),
  CandidaturasController.get,
);

/**
 * @openapi
 * /api/v1/candidatos/candidaturas/{id}:
 *   put:
 *     summary: Atualizar candidatura
 *     description: Atualiza status ou dados de uma candidatura
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: ['RECEBIDA','EM_ANALISE','EM_TRIAGEM','ENTREVISTA','DESAFIO','DOCUMENTACAO','CONTRATADO','RECUSADO','DESISTIU','NAO_COMPARECEU','ARQUIVADO','CANCELADO'] }
 *               observacoes: { type: string }
 *     responses:
 *       200:
 *         description: Candidatura atualizada
 *       404:
 *         description: Candidatura não encontrada
 */
router.put(
  '/candidaturas/:id',
  supabaseAuthMiddleware([
    Roles.ALUNO_CANDIDATO,
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.EMPRESA,
    Roles.SETOR_DE_VAGAS,
    Roles.RECRUTADOR,
  ]),
  CandidaturasController.update,
);

/**
 * @openapi
 * /api/v1/candidatos/candidaturas/{id}:
 *   delete:
 *     summary: Cancelar candidatura
 *     description: Cancela uma candidatura (apenas candidatos podem cancelar suas próprias candidaturas)
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Candidatura cancelada
 *       404:
 *         description: Candidatura não encontrada
 */
router.delete(
  '/candidaturas/:id',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO, Roles.ADMIN, Roles.MODERADOR]),
  CandidaturasController.cancel,
);

/**
 * @openapi
 * /api/v1/candidatos/candidaturas/status-disponiveis:
 *   get:
 *     summary: Listar status de processo disponíveis
 *     description: Retorna todos os status de processo ativos para uso em candidaturas
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de status disponíveis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       nome:
 *                         type: string
 *                         example: "EM_ANALISE"
 *                       descricao:
 *                         type: string
 *                         nullable: true
 *                       ativo:
 *                         type: boolean
 *                       isDefault:
 *                         type: boolean
 */
router.get(
  '/candidaturas/status-disponiveis',
  supabaseAuthMiddleware([
    Roles.ALUNO_CANDIDATO,
    Roles.ADMIN,
    Roles.MODERADOR,
    Roles.EMPRESA,
    Roles.SETOR_DE_VAGAS,
    Roles.RECRUTADOR,
  ]),
  CandidaturasController.listStatusDisponiveis,
);

/**
 * @openapi
 * /api/v1/candidatos/dashboard:
 *   get:
 *     summary: Dashboard do candidato (visão geral)
 *     description: |
 *       Retorna dados consolidados do dashboard do candidato autenticado, incluindo:
 *       - Métricas: cursos em progresso, cursos concluídos, total de cursos, total de candidaturas
 *       - Últimos 8 cursos: com foto, status, nome, descrição, progresso e data de início
 *       - Últimas 8 candidaturas: com nome da vaga, empresa (ou "Anônima" se modoAnonimo), local, data de publicação e regime de trabalho
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard do candidato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metricas:
 *                   type: object
 *                   properties:
 *                     cursosEmProgresso:
 *                       type: integer
 *                       description: Quantidade de cursos em progresso (status INSCRITO ou EM_ANDAMENTO)
 *                       example: 4
 *                     cursosConcluidos:
 *                       type: integer
 *                       description: Quantidade de cursos concluídos
 *                       example: 2
 *                     totalCursos:
 *                       type: integer
 *                       description: Total de cursos do candidato
 *                       example: 6
 *                     totalCandidaturas:
 *                       type: integer
 *                       description: Total de candidaturas enviadas
 *                       example: 8
 *                 cursos:
 *                   type: array
 *                   description: Últimos 8 cursos do candidato
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: ID da inscrição
 *                       cursoId:
 *                         type: string
 *                         format: uuid
 *                       turmaId:
 *                         type: string
 *                         format: uuid
 *                       foto:
 *                         type: string
 *                         nullable: true
 *                         description: URL da imagem do curso
 *                       status:
 *                         type: string
 *                         enum: [Concluído, Em progresso, Cancelado, Não iniciado]
 *                         description: Status do curso para exibição
 *                       nome:
 *                         type: string
 *                         description: Nome do curso
 *                       descricao:
 *                         type: string
 *                         nullable: true
 *                         description: Descrição do curso
 *                       progresso:
 *                         type: integer
 *                         minimum: 0
 *                         maximum: 100
 *                         description: Percentual de progresso (0-100)
 *                       iniciadoEm:
 *                         type: string
 *                         format: date-time
 *                         description: Data de início da inscrição
 *                 candidaturas:
 *                   type: array
 *                   description: Últimas 8 candidaturas enviadas
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: ID da candidatura
 *                       vagaId:
 *                         type: string
 *                         format: uuid
 *                       nomeVaga:
 *                         type: string
 *                         description: Título da vaga
 *                       empresa:
 *                         type: string
 *                         description: Nome da empresa ou "Anônima" se modoAnonimo=true
 *                         example: "Tech Innovations LTDA" ou "Anônima"
 *                       local:
 *                         type: string
 *                         description: Localização formatada (cidade, estado) ou "Remoto" ou "Híbrido"
 *                         example: "São Paulo, SP" ou "Remoto"
 *                       publicadaEm:
 *                         type: string
 *                         format: date-time
 *                         description: Data de publicação da vaga
 *                       regimeTrabalho:
 *                         type: string
 *                         enum: [CLT, TEMPORARIO, ESTAGIO, PJ, HOME_OFFICE, JOVEM_APRENDIZ]
 *                         description: Regime de trabalho
 *                       modalidade:
 *                         type: string
 *                         enum: [PRESENCIAL, REMOTO, HIBRIDO]
 *                         description: Modalidade de trabalho
 *                       aplicadaEm:
 *                         type: string
 *                         format: date-time
 *                         description: Data em que o candidato se candidatou
 *                       slug:
 *                         type: string
 *                         description: Slug da vaga para URL
 *             examples:
 *               default:
 *                 summary: Dashboard completo
 *                 value:
 *                   metricas:
 *                     cursosEmProgresso: 4
 *                     cursosConcluidos: 2
 *                     totalCursos: 6
 *                     totalCandidaturas: 8
 *                   cursos:
 *                     - id: "550e8400-e29b-41d4-a716-446655440000"
 *                       cursoId: "660e8400-e29b-41d4-a716-446655440001"
 *                       turmaId: "770e8400-e29b-41d4-a716-446655440002"
 *                       foto: "https://example.com/curso.jpg"
 *                       status: "Em progresso"
 *                       nome: "React Avançado"
 *                       descricao: "Aprenda React avançado, hooks, context API"
 *                       progresso: 65
 *                       iniciadoEm: "2024-01-14T10:00:00Z"
 *                   candidaturas:
 *                     - id: "880e8400-e29b-41d4-a716-446655440003"
 *                       vagaId: "990e8400-e29b-41d4-a716-446655440004"
 *                       nomeVaga: "Desenvolvedor Full Stack Sênior"
 *                       empresa: "Tech Innovations LTDA"
 *                       local: "São Paulo, SP"
 *                       publicadaEm: "2024-01-15T08:00:00Z"
 *                       regimeTrabalho: "CLT"
 *                       modalidade: "HIBRIDO"
 *                       aplicadaEm: "2024-01-16T14:30:00Z"
 *                       slug: "desenvolvedor-full-stack-senior-v12345"
 *       401:
 *         description: Não autenticado
 *       500:
 *         description: Erro interno do servidor
 */
router.get(
  '/dashboard',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CandidatoDashboardController.getDashboard,
);

router.get(
  '/cursos',
  supabaseAuthMiddleware([Roles.ALUNO_CANDIDATO]),
  CandidatoCursosController.listCursos,
);
/**
 * @openapi
 * /api/v1/candidatos/cursos:
 *   get:
 *     summary: Listar cursos do candidato com filtros e paginação
 *     description: |
 *       Retorna lista de cursos do candidato autenticado com:
 *       - Próxima aula agendada (se houver)
 *       - Lista paginada de cursos (8 por página)
 *       - Filtros por modalidade (Todos, Online, Ao Vivo, Presencial, Semi-presencial)
 *       - Informações: foto, status, quantidade de aulas, nome, carga horária, progresso, nota média
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: modalidade
 *         schema:
 *           type: string
 *           enum: [TODOS, ONLINE, AO_VIVO, PRESENCIAL, SEMI_PRESENCIAL]
 *         description: Filtrar cursos por modalidade
 *         example: "ONLINE"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 8
 *         description: Quantidade de cursos por página
 *         example: 8
 *     responses:
 *       200:
 *         description: Lista de cursos do candidato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     proximaAula:
 *                       type: object
 *                       nullable: true
 *                       description: Próxima aula agendada (se houver)
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         titulo:
 *                           type: string
 *                         descricao:
 *                           type: string
 *                           nullable: true
 *                         dataInicio:
 *                           type: string
 *                           format: date-time
 *                         dataFim:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         modalidade:
 *                           type: string
 *                           enum: [LIVE, ONLINE, PRESENCIAL, SEMIPRESENCIAL]
 *                         urlMeet:
 *                           type: string
 *                           nullable: true
 *                         urlVideo:
 *                           type: string
 *                           nullable: true
 *                         turma:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             nome:
 *                               type: string
 *                             curso:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                   format: uuid
 *                                 nome:
 *                                   type: string
 *                     cursos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             description: ID da inscrição
 *                           cursoId:
 *                             type: string
 *                             format: uuid
 *                           turmaId:
 *                             type: string
 *                             format: uuid
 *                           foto:
 *                             type: string
 *                             nullable: true
 *                             description: URL da imagem do curso
 *                           status:
 *                             type: string
 *                             description: Status formatado (Concluído, Em Andamento, etc.)
 *                           statusRaw:
 *                             type: string
 *                             enum: [INSCRITO, EM_ANDAMENTO, CONCLUIDO, REPROVADO, EM_ESTAGIO, CANCELADO, TRANCADO]
 *                           quantidadeAulas:
 *                             type: integer
 *                             description: Total de aulas + provas do curso
 *                           nome:
 *                             type: string
 *                             description: Nome do curso
 *                           cargaHoraria:
 *                             type: integer
 *                             description: Carga horária em horas
 *                           progresso:
 *                             type: integer
 *                             minimum: 0
 *                             maximum: 100
 *                             description: Percentual de progresso (0-100)
 *                           notaMedia:
 *                             type: number
 *                             nullable: true
 *                             description: Nota média do curso (null se não houver)
 *                           modalidade:
 *                             type: string
 *                             enum: [ONLINE, PRESENCIAL, LIVE, SEMIPRESENCIAL]
 *                           dataInicio:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                     paginacao:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *             examples:
 *               default:
 *                 summary: Lista de cursos com próxima aula
 *                 value:
 *                   success: true
 *                   data:
 *                     proximaAula:
 *                       id: "550e8400-e29b-41d4-a716-446655440000"
 *                       titulo: "Vue.js Avançado"
 *                       descricao: "Composition API e Reatividade"
 *                       dataInicio: "2024-01-14T14:00:00Z"
 *                       dataFim: "2024-01-14T16:00:00Z"
 *                       modalidade: "LIVE"
 *                       urlMeet: "https://meet.google.com/xxx"
 *                       turma:
 *                         id: "660e8400-e29b-41d4-a716-446655440001"
 *                         nome: "Turma 2024.1"
 *                         curso:
 *                           id: "770e8400-e29b-41d4-a716-446655440002"
 *                           nome: "Vue.js Avançado"
 *                     cursos:
 *                       - id: "880e8400-e29b-41d4-a716-446655440003"
 *                         cursoId: "990e8400-e29b-41d4-a716-446655440004"
 *                         turmaId: "aa0e8400-e29b-41d4-a716-446655440005"
 *                         foto: "https://example.com/curso.jpg"
 *                         status: "Em Andamento"
 *                         statusRaw: "EM_ANDAMENTO"
 *                         quantidadeAulas: 25
 *                         nome: "React Avançado"
 *                         cargaHoraria: 80
 *                         progresso: 60
 *                         notaMedia: 8.3
 *                         modalidade: "ONLINE"
 *                         dataInicio: "2024-01-10T10:00:00Z"
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Não autenticado
 *       500:
 *         description: Erro interno do servidor
 */

export { router as candidatosRoutes };
