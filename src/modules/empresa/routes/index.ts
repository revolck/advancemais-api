import { Router } from "express";
import { plansRoutes } from "./plans";

const router = Router();

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
