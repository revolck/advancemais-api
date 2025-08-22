import { Router } from "express";
import { AuditController } from "../controllers/audit-controller";
import { authMiddlewareWithDB } from "../../usuarios/middlewares";
import { Role } from "../../usuarios/enums/Role";

const router = Router();
const controller = new AuditController();

router.get("/", authMiddlewareWithDB([Role.ADMIN]), controller.getLogs);

export { router as logsRoutes };
