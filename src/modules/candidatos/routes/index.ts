import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';

import { areasInteresseRoutes } from '../areas-interesse/routes';
import { subareasInteresseRoutes } from '../areas-interesse/routes/subareas';
import { curriculosRoutes } from '@/modules/candidatos/curriculos/routes';
import { CandidaturasController } from '@/modules/candidatos/candidaturas/controllers';
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
  const result = await vagasPublicasService.list({
    page,
    pageSize,
    q: (req.query.q as string) || undefined,
    modalidade: parseList<string>(req.query.modalidade),
    regime: parseList<string>(req.query.regime),
    senioridade: parseList<string>(req.query.senioridade),
    areaInteresseId: parseList<number>(req.query.CandidatosAreasInteresseId, (v) => Number(v)),
    subareaInteresseId: parseList<number>(req.query.CandidatosSubareasInteresseId, (v) => Number(v)),
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
/**
 * @openapi
 * /api/v1/candidatos/candidaturas/overview:
 *   get:
 *     summary: Visão consolidada de candidatos e vagas
 *     description: "Retorna candidatos únicos com seus currículos e candidaturas agrupadas por vaga. Empresas visualizam apenas suas vagas; administradores, moderadores, setor de vagas e recrutadores podem consultar todo o sistema."
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
 *         description: "Filtra por empresa específica (apenas para ADMIN, MODERADOR, SETOR_DE_VAGAS e RECRUTADOR)."
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

export { router as candidatosRoutes };
