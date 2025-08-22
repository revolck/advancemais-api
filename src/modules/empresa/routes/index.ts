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
