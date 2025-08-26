import { Router } from "express";
import { sobreRoutes } from "./sobre";
import { sliderRoutes } from "./slider";
import { bannerRoutes } from "./banner";
import { logoEnterpriseRoutes } from "./logo-enterprises";

const router = Router();

/**
 * @openapi
 * /api/v1/website:
 *   get:
 *     summary: Informações do módulo Website
 *     tags: [Website]
 *     responses:
 *       200:
 *         description: Detalhes do módulo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteModuleInfo'
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
 *           curl -X GET "http://localhost:3000/api/v1/website"
 */
router.get("/", (req, res) => {
  res.json({
    message: "Website Module API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      sobre: "/sobre",
      slider: "/slider",
      banner: "/banner",
      logoEnterprises: "/logo-enterprises",
    },
    status: "operational",
  });
});

router.use("/sobre", sobreRoutes);
router.use("/slider", sliderRoutes);
router.use("/banner", bannerRoutes);
router.use("/logo-enterprises", logoEnterpriseRoutes);

export { router as websiteRoutes };
