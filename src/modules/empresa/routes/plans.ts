import { Router } from "express";
import { PlanController } from "../controllers/plan-controller";
import { authMiddlewareWithDB } from "../../usuarios/middlewares";
import { Role } from "../../usuarios/enums/Role";

const router = Router();
const controller = new PlanController();

router.post("/", authMiddlewareWithDB([Role.ADMIN]), controller.createPlan);
router.get("/", controller.getPlans);
router.put(
  "/:planId",
  authMiddlewareWithDB([Role.ADMIN]),
  controller.updatePlan
);
router.post(
  "/:planId/assign",
  authMiddlewareWithDB([Role.ADMIN]),
  controller.assignPlan
);
router.delete(
  "/companies/:empresaId/plan",
  authMiddlewareWithDB([Role.ADMIN]),
  controller.unassignPlan
);

export { router as plansRoutes };
