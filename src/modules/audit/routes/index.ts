import { Router } from "express";
import { logsRoutes } from "./logs";

const router = Router();

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
