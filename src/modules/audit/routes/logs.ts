import { Router } from "express";
import { AuditController } from "../controllers/audit-controller";
import { authMiddlewareWithDB } from "../../usuarios/middlewares";
import { Role } from "../../usuarios/enums/Role";

const router = Router();
const controller = new AuditController();

/**
 * @openapi
 * /api/v1/audit/logs:
 *   get:
 *     summary: Listar logs de auditoria
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: empresaId
 *         schema:
 *           type: string
 *         description: Filtrar logs por ID da empresa
 *     responses:
 *       200:
 *         description: Lista de logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLogsResponse'
 *       400:
 *         description: Erro ao buscar logs
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/audit/logs?empresaId={empresaId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/", authMiddlewareWithDB([Role.ADMIN]), controller.getLogs);

export { router as logsRoutes };
