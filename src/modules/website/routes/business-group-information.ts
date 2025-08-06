import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { BusinessGroupInformationController } from "../controllers/businessGroupInformation.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", BusinessGroupInformationController.list);
router.get("/:id", BusinessGroupInformationController.get);
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  BusinessGroupInformationController.create
);
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  BusinessGroupInformationController.update
);
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  BusinessGroupInformationController.remove
);

export { router as businessGroupInformationRoutes };
