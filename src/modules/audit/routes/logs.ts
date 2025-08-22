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
 *     responses:
 *       200:
 *         description: Lista de logs
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/audit/logs" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/", authMiddlewareWithDB([Role.ADMIN]), controller.getLogs);

export { router as logsRoutes };
