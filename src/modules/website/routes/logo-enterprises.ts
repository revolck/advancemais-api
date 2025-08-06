import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { LogoEnterpriseController } from "../controllers/logoEnterprise.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", LogoEnterpriseController.list);
router.get("/:id", LogoEnterpriseController.get);
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  LogoEnterpriseController.create
);
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  LogoEnterpriseController.update
);
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  LogoEnterpriseController.remove
);

export { router as logoEnterpriseRoutes };
