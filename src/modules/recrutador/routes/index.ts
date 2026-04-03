import { Router } from 'express';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { RecrutadorEmpresasController } from '../controllers/empresas.controller';
import { RecrutadorVagasController } from '../controllers/vagas.controller';
import { RecrutadorEntrevistasController } from '../controllers/entrevistas.controller';
import { RecrutadorCandidatosController } from '../controllers/candidatos.controller';

const router = Router();

router.use(supabaseAuthMiddleware([Roles.RECRUTADOR]));

/**
 * @openapi
 * /api/v1/recrutador/empresas:
 *   get:
 *     summary: Listar empresas vinculadas ao recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     description: "Retorna apenas empresas onde o recrutador possui ao menos uma vaga vinculada."
 *     responses:
 *       200:
 *         description: Lista de empresas vinculadas
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 */
router.get('/empresas', RecrutadorEmpresasController.list);

/**
 * @openapi
 * /api/v1/recrutador/empresas/{empresaUsuarioId}:
 *   get:
 *     summary: Obter detalhes de uma empresa dentro do escopo do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: empresaUsuarioId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Empresa encontrada
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso à empresa
 *       404:
 *         description: Empresa não encontrada
 */
router.get('/empresas/:empresaUsuarioId', RecrutadorEmpresasController.get);

/**
 * @openapi
 * /api/v1/recrutador/candidatos:
 *   get:
 *     summary: Listar candidatos no escopo do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista paginada de candidatos do escopo do recrutador
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 */
router.get('/candidatos', RecrutadorCandidatosController.list);

/**
 * @openapi
 * /api/v1/recrutador/candidatos/{candidatoId}:
 *   get:
 *     summary: Obter detalhe de um candidato no escopo do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: candidatoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Candidato encontrado
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso ao candidato
 *       404:
 *         description: Candidato não encontrado
 */
router.get('/candidatos/:candidatoId', RecrutadorCandidatosController.get);

/**
 * @openapi
 * /api/v1/recrutador/candidatos/{candidatoId}/curriculos/{curriculoId}:
 *   get:
 *     summary: Obter currículo visível de um candidato no escopo do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: candidatoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: curriculoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Currículo encontrado
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso ao currículo
 *       404:
 *         description: Candidato ou currículo não encontrado
 */
router.get(
  '/candidatos/:candidatoId/curriculos/:curriculoId',
  RecrutadorCandidatosController.getCurriculo,
);

/**
 * @openapi
 * /api/v1/recrutador/vagas:
 *   get:
 *     summary: Listar vagas vinculadas ao recrutador (exceto RASCUNHO)
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: empresaUsuarioId
 *         schema: { type: string, format: uuid }
 *         description: "Filtra por uma empresa específica (deve estar vinculada ao recrutador)"
 *       - in: query
 *         name: status
 *         schema: { type: string, example: "PUBLICADO,EM_ANALISE" }
 *         description: "Filtra por status (separados por vírgula). RASCUNHO é proibido para recrutador."
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Lista de vagas
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Empresa fora do vínculo ou status proibido
 */
router.get('/vagas', RecrutadorVagasController.list);

/**
 * @openapi
 * /api/v1/recrutador/vagas/{vagaId}/candidatos:
 *   get:
 *     summary: Listar candidatos da vaga no escopo do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista paginada de candidatos da vaga
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso à vaga
 *       404:
 *         description: Vaga não encontrada
 */
router.get('/vagas/:vagaId/candidatos', RecrutadorVagasController.listCandidates);

/**
 * @openapi
 * /api/v1/recrutador/vagas/{vagaId}/candidaturas/{candidaturaId}/status:
 *   patch:
 *     summary: Atualizar o status de uma candidatura da vaga no escopo do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: candidaturaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [statusId]
 *             properties:
 *               statusId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso à candidatura
 *       404:
 *         description: Vaga, candidatura ou status não encontrados
 *       409:
 *         description: Candidatura não pertence à vaga informada
 */
router.patch(
  '/vagas/:vagaId/candidaturas/:candidaturaId/status',
  RecrutadorVagasController.updateCandidateStatus,
);

/**
 * @openapi
 * /api/v1/recrutador/vagas/{id}:
 *   get:
 *     summary: Obter detalhes de uma vaga vinculada ao recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vaga encontrada
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não vinculado à vaga
 *       404:
 *         description: Vaga não encontrada
 */
router.get('/vagas/:id', RecrutadorVagasController.get);

/**
 * @openapi
 * /api/v1/recrutador/candidatos/{candidatoId}/entrevistas/opcoes:
 *   get:
 *     summary: Listar opções de criação de entrevista no detalhe do candidato do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: candidatoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Opções de criação carregadas
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso para criar entrevista neste candidato
 *       404:
 *         description: Candidato não encontrado
 */
router.get(
  '/candidatos/:candidatoId/entrevistas/opcoes',
  RecrutadorEntrevistasController.listCreateOptionsByCandidato,
);

/**
 * @openapi
 * /api/v1/recrutador/candidatos/{candidatoId}/entrevistas:
 *   get:
 *     summary: Listar entrevistas visíveis de um candidato no escopo do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: candidatoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista paginada de entrevistas do candidato
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso ao candidato
 *       404:
 *         description: Candidato não encontrado
 */
router.get('/candidatos/:candidatoId/entrevistas', RecrutadorEntrevistasController.listByCandidato);

/**
 * @openapi
 * /api/v1/recrutador/candidatos/{candidatoId}/entrevistas:
 *   post:
 *     summary: Criar entrevista diretamente no detalhe do candidato do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: candidatoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Entrevista criada
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso à candidatura
 *       404:
 *         description: Candidato ou candidatura não encontrados
 *       409:
 *         description: Conflito de escopo ou entrevista já existente
 */
router.post(
  '/candidatos/:candidatoId/entrevistas',
  RecrutadorEntrevistasController.createByCandidato,
);

/**
 * @openapi
 * /api/v1/recrutador/vagas/{vagaId}/candidatos/{candidatoId}/entrevistas:
 *   post:
 *     summary: Agendar entrevista (Google Meet) para candidato de uma vaga
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vagaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: candidatoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataInicio, dataFim]
 *             properties:
 *               dataInicio: { type: string, format: date-time }
 *               dataFim: { type: string, format: date-time }
 *               descricao: { type: string }
 *     responses:
 *       201:
 *         description: Entrevista agendada
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não vinculado à empresa da vaga
 *       404:
 *         description: Vaga/candidato não encontrado ou não relacionado
 */
router.post(
  '/vagas/:vagaId/candidatos/:candidatoId/entrevistas',
  RecrutadorEntrevistasController.create,
);

/**
 * @openapi
 * /api/v1/recrutador/entrevistas/overview:
 *   get:
 *     summary: Listar overview de entrevistas no escopo do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview carregado
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso ao escopo solicitado
 */
router.get('/entrevistas/overview', RecrutadorEntrevistasController.listOverview);

/**
 * @openapi
 * /api/v1/recrutador/entrevistas/opcoes/empresas:
 *   get:
 *     summary: Listar empresas elegíveis para criação de entrevista no dashboard do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Empresas elegíveis carregadas
 */
router.get('/entrevistas/opcoes/empresas', RecrutadorEntrevistasController.listCreateEmpresas);

/**
 * @openapi
 * /api/v1/recrutador/entrevistas/opcoes/vagas:
 *   get:
 *     summary: Listar vagas elegíveis por empresa para criação de entrevista no dashboard do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vagas elegíveis carregadas
 */
router.get('/entrevistas/opcoes/vagas', RecrutadorEntrevistasController.listCreateVagas);

/**
 * @openapi
 * /api/v1/recrutador/entrevistas/opcoes/candidatos:
 *   get:
 *     summary: Listar candidatos elegíveis por vaga para criação de entrevista no dashboard do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Candidatos elegíveis carregados
 */
router.get('/entrevistas/opcoes/candidatos', RecrutadorEntrevistasController.listCreateCandidatos);

/**
 * @openapi
 * /api/v1/recrutador/entrevistas:
 *   post:
 *     summary: Criar entrevista no dashboard do recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Entrevista criada
 */
router.post('/entrevistas', RecrutadorEntrevistasController.createOverviewInterview);

/**
 * @openapi
 * /api/v1/recrutador/entrevistas/{id}:
 *   get:
 *     summary: Obter detalhes de uma entrevista (Google Meet) criada pelo recrutador
 *     tags: [Recrutador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entrevista encontrada
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Recrutador não possui acesso à entrevista
 *       404:
 *         description: Entrevista não encontrada
 */
router.get('/entrevistas/:id', RecrutadorEntrevistasController.get);

export { router as recrutadorRoutes };
