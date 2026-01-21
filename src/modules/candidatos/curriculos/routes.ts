import { Router } from 'express';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@prisma/client';
import { CurriculosController } from './controllers';

const router = Router();
const candidateOnly = [Roles.ALUNO_CANDIDATO];
const canViewCurriculos = [Roles.ALUNO_CANDIDATO, Roles.ADMIN, Roles.MODERADOR];

router.get('/', supabaseAuthMiddleware(candidateOnly), CurriculosController.list);
/**
 * @openapi
 * /api/v1/candidatos/curriculos:
 *   get:
 *     summary: Listar currículos do candidato com filtros
 *     description: "Lista todos os currículos do usuário autenticado. Suporta filtros opcionais por título/resumo, principal, autorização de contato e pretensão salarial."
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: busca
 *         schema:
 *           type: string
 *         description: Busca textual em título ou resumo do currículo
 *         example: "Desenvolvedor Full Stack"
 *       - in: query
 *         name: principal
 *         schema:
 *           type: boolean
 *         description: Filtrar por currículo principal (true) ou não principal (false)
 *         example: true
 *       - in: query
 *         name: autorizaContato
 *         schema:
 *           type: boolean
 *         description: Filtrar por autorização de contato (true/false)
 *         example: true
 *       - in: query
 *         name: salarioMinimo
 *         schema:
 *           type: number
 *           format: float
 *         description: Filtrar por pretensão salarial mínima (>= valor)
 *         example: 5000.0
 *       - in: query
 *         name: salarioMaximo
 *         schema:
 *           type: number
 *           format: float
 *         description: Filtrar por pretensão salarial máxima (<= valor)
 *         example: 10000.0
 *     responses:
 *       200:
 *         description: Lista de currículos filtrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UsuarioCurriculo'
 *             example:
 *               - id: "550e8400-e29b-41d4-a716-446655440000"
 *                 usuarioId: "660e8400-e29b-41d4-a716-446655440000"
 *                 titulo: "Meu Primeiro Currículo"
 *                 resumo: "Desenvolvedor Full Stack"
 *                 principal: true
 *                 preferencias:
 *                   salarioMinimo: 8000.0
 *                 consentimentos:
 *                   autorizarContato: true
 *       401:
 *         description: Não autenticado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/:id', supabaseAuthMiddleware(canViewCurriculos), CurriculosController.get);
/**
 * @openapi
 * /api/v1/candidatos/curriculos/{id}:
 *   get:
 *     summary: Obter currículo do candidato
 *     description: "Admin e Moderador podem ver qualquer currículo. Candidatos apenas os próprios."
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
 *         description: Currículo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsuarioCurriculo'
 *       404:
 *         description: Currículo não encontrado
 */
router.post('/', supabaseAuthMiddleware(candidateOnly), CurriculosController.create);
/**
 * @openapi
 * /api/v1/candidatos/UsuariosCurriculos:
 *   post:
 *     summary: Criar currículo (até 5 por candidato)
 *     description: "Registra um novo currículo. Ao cadastrar o primeiro currículo, o perfil do aluno passa a ser considerado candidato ativo."
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioCurriculoCreate'
 *     responses:
 *       201:
 *         description: Criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsuarioCurriculo'
 *       400:
 *         description: Limite atingido ou dados inválidos
 */
router.patch(
  '/:id/principal',
  supabaseAuthMiddleware(candidateOnly),
  CurriculosController.setPrincipal,
);
/**
 * @openapi
 * /api/v1/candidatos/curriculos/{id}/principal:
 *   patch:
 *     summary: Definir currículo como principal
 *     description: "Define o currículo especificado como principal. Desmarca automaticamente o currículo principal anterior (se existir). Operação atômica que garante sempre haver exatamente um currículo principal."
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do currículo a ser definido como principal
 *     responses:
 *       200:
 *         description: Currículo definido como principal com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsuarioCurriculo'
 *             example:
 *               id: "550e8400-e29b-41d4-a716-446655440000"
 *               usuarioId: "660e8400-e29b-41d4-a716-446655440000"
 *               titulo: "Meu Primeiro Currículo"
 *               resumo: "Desenvolvedor Full Stack"
 *               principal: true
 *               ultimaAtualizacao: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Currículo não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/:id', supabaseAuthMiddleware(candidateOnly), CurriculosController.update);
/**
 * @openapi
 * /api/v1/candidatos/curriculos/{id}:
 *   put:
 *     summary: Atualizar currículo
 *     description: "Atualiza os dados do currículo selecionado e registra logs de auditoria com as alterações."
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
 *             $ref: '#/components/schemas/UsuarioCurriculoUpdate'
 *     responses:
 *       200:
 *         description: Atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsuarioCurriculo'
 *       404:
 *         description: Currículo não encontrado
 */
router.delete('/:id', supabaseAuthMiddleware(candidateOnly), CurriculosController.remove);
/**
 * @openapi
 * /api/v1/candidatos/curriculos/{id}:
 *   delete:
 *     summary: Excluir currículo
 *     description: "Remove o currículo informado. As candidaturas vinculadas a ele são canceladas automaticamente e, caso seja o último currículo ativo, o candidato deixa de participar dos processos seletivos."
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Excluído
 */

export { router as curriculosRoutes };
