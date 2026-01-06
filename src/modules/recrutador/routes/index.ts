import { Router } from 'express';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { RecrutadorEmpresasController } from '../controllers/empresas.controller';
import { RecrutadorVagasController } from '../controllers/vagas.controller';
import { RecrutadorEntrevistasController } from '../controllers/entrevistas.controller';

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
 *       404:
 *         description: Entrevista não encontrada
 */
router.get('/entrevistas/:id', RecrutadorEntrevistasController.get);

export { router as recrutadorRoutes };
