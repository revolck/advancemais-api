import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';

import { areasInteresseRoutes } from '../areas-interesse/routes';
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
      curriculos: '/curriculos',
      aplicar: '/aplicar',
      vagas: '/vagas',
    },
    status: 'operational',
  });
});

router.use('/areas-interesse', areasInteresseRoutes);
router.use('/curriculos', curriculosRoutes);
/**
 * @openapi
 * /api/v1/candidatos/vagas:
 *   get:
 *     summary: Listar vagas publicadas (público e dashboard)
 *     description: "Retorna vagas PUBLICADAS com paginação (10 por página por padrão)."
 *     tags: [Candidatos - Vagas]
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
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const result = await vagasPublicasService.list({
    page,
    pageSize,
    q: (req.query.q as string) || undefined,
    modalidade: (req.query.modalidade as any) || undefined,
    regime: (req.query.regime as any) || undefined,
    senioridade: (req.query.senioridade as any) || undefined,
    areaInteresseId: req.query.areaInteresseId ? Number(req.query.areaInteresseId) : undefined,
    subareaInteresseId: req.query.subareaInteresseId
      ? Number(req.query.subareaInteresseId)
      : undefined,
    cidade: (req.query.cidade as string) || undefined,
    estado: (req.query.estado as string) || undefined,
    empresaId: (req.query.empresaId as string) || undefined,
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
 *     tags: [Candidatos - Candidaturas]
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
 *     tags: [Candidatos - Candidaturas]
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
 * /api/v1/candidatos/candidaturas/recebidas:
 *   get:
 *     summary: Listar candidaturas recebidas pela empresa
 *     tags: [Candidatos - Candidaturas]
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
  supabaseAuthMiddleware([Roles.ADMIN, Roles.MODERADOR, Roles.EMPRESA, Roles.RECRUTADOR]),
  CandidaturasController.listReceived,
);

export { router as candidatosRoutes };
