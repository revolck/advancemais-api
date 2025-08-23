import { Router } from "express";
import { plansRoutes } from "./plans";

const router = Router();

/**
 * @openapi
 * /api/v1/empresa:
 *   get:
 *     summary: Informações do módulo Empresa
 *     tags: [Empresa]
 *     responses:
 *       200:
 *         description: Detalhes do módulo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicMessage'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/empresa"
*/
router.get("/", (req, res) => {
  res.json({
    message: "Empresa Module API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      plans: "/plans",
    },
    status: "operational",
  });
});

router.use("/plans", plansRoutes);

export { router as empresaRoutes };
