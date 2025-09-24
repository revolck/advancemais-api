import { Router } from 'express';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@prisma/client';
import { CurriculosController } from './controllers';

const router = Router();
const candidateOnly = [Roles.ALUNO_CANDIDATO];

router.get('/', supabaseAuthMiddleware(candidateOnly), CurriculosController.list);
/**
 * @openapi
 * /api/v1/candidatos/curriculos:
 *   get:
 *     summary: Listar currículos do candidato
 *     tags: [Candidatos - Currículos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de currículos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UsuarioCurriculo'
 */
router.get('/:id', supabaseAuthMiddleware(candidateOnly), CurriculosController.get);
/**
 * @openapi
 * /api/v1/candidatos/curriculos/{id}:
 *   get:
 *     summary: Obter currículo do candidato
 *     tags: [Candidatos - Currículos]
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
 * /api/v1/candidatos/curriculos:
 *   post:
 *     summary: Criar currículo (até 5 por candidato)
 *     description: "Registra um novo currículo. Ao cadastrar o primeiro currículo, o perfil do aluno passa a ser considerado candidato ativo."
 *     tags: [Candidatos - Currículos]
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
router.put('/:id', supabaseAuthMiddleware(candidateOnly), CurriculosController.update);
/**
 * @openapi
 * /api/v1/candidatos/curriculos/{id}:
 *   put:
 *     summary: Atualizar currículo
 *     description: "Atualiza os dados do currículo selecionado e registra logs de auditoria com as alterações."
 *     tags: [Candidatos - Currículos]
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
 *     tags: [Candidatos - Currículos]
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
