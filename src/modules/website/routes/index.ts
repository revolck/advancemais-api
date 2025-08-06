import { Router } from "express";
import { sobreRoutes } from "./sobre";
import { slideRoutes } from "./slide";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    message: "Website Module API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      sobre: "/sobre",
      slide: "/slide",
    },
    status: "operational",
  });
});

router.use("/sobre", sobreRoutes);
router.use("/slide", slideRoutes);

export { router as websiteRoutes };
