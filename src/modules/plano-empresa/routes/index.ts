import { Router } from "express";
import { PlanoEmpresaController } from "../controllers/plano-empresa.controller";
import { authMiddlewareWithDB } from "../../usuarios/middlewares";
import { Role } from "../../usuarios/enums/Role";

const router = Router();

/**
 * @openapi
 * /api/v1/plano-empresa:
 *   get:
 *     summary: Listar planos disponíveis
 *     tags: [PlanoEmpresa]
 *     responses:
 *       200:
 *         description: Lista de planos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlansResponse'
 */
router.get("/", PlanoEmpresaController.list);

/**
 * @openapi
 * /api/v1/plano-empresa/{id}:
 *   get:
 *     summary: Obter detalhes de um plano
 *     tags: [PlanoEmpresa]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plano encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlan'
 *       404:
 *         description: Plano não encontrado
 */
router.get("/:id", PlanoEmpresaController.get);

/**
 * @openapi
 * /api/v1/plano-empresa:
 *   post:
 *     summary: Criar plano
 *     description: Cria um plano e o registra também no MercadoPago
 *     tags: [PlanoEmpresa]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaPlanCreateRequest'
 *     responses:
 *       201:
 *         description: Plano criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlan'
 */
router.post("/", authMiddlewareWithDB([Role.ADMIN]), PlanoEmpresaController.create);

/**
 * @openapi
 * /api/v1/plano-empresa/{id}:
 *   put:
 *     summary: Atualizar plano
 *     tags: [PlanoEmpresa]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaPlanUpdateRequest'
 *     responses:
 *       200:
 *         description: Plano atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlan'
 */
router.put("/:id", authMiddlewareWithDB([Role.ADMIN]), PlanoEmpresaController.update);

/**
 * @openapi
 * /api/v1/plano-empresa/{id}:
 *   delete:
 *     summary: Remover plano
 *     tags: [PlanoEmpresa]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Plano removido
 */
router.delete("/:id", authMiddlewareWithDB([Role.ADMIN]), PlanoEmpresaController.remove);

export { router as planoEmpresaRoutes };
