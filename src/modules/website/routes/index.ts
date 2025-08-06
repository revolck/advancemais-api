import { Router } from "express";
import { sobreRoutes } from "./sobre";
import { slideRoutes } from "./slide";
import { bannerRoutes } from "./banner";
import { businessGroupInformationRoutes } from "./business-group-information";
import { logoEnterpriseRoutes } from "./logo-enterprises";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    message: "Website Module API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      sobre: "/sobre",
      slide: "/slide",
      banner: "/banner",
      businessGroupInformation: "/business-group-information",
      logoEnterprises: "/logo-enterprises",
    },
    status: "operational",
  });
});

router.use("/sobre", sobreRoutes);
router.use("/slide", slideRoutes);
  router.use("/banner", bannerRoutes);
  router.use("/business-group-information", businessGroupInformationRoutes);
  router.use("/logo-enterprises", logoEnterpriseRoutes);

export { router as websiteRoutes };
