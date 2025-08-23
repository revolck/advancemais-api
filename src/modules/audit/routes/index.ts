import { Router } from "express";
import { logsRoutes } from "./logs";

const router = Router();

/**
 * @openapi
 * /api/v1/audit:
 *   get:
 *     summary: Informações do módulo de auditoria
 *     tags: [Audit]
 *     responses:
 *       200:
 *         description: Detalhes do módulo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditModuleInfo'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/audit"
 */
router.get("/", (req, res) => {
  res.json({
    message: "Audit Module API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      logs: "/logs",
    },
    status: "operational",
  });
});

router.use("/logs", logsRoutes);

export { router as auditRoutes };
