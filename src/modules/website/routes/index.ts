import { Router } from "express";
import { sobreRoutes } from "./sobre";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    message: "Website Module API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      sobre: "/sobre",
    },
    status: "operational",
  });
});

router.use("/sobre", sobreRoutes);

export { router as websiteRoutes };
