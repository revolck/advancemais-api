import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { SobreController } from "../controllers/sobre.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", SobreController.list);
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SobreController.create
);
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SobreController.update
);
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreController.remove
);

export { router as sobreRoutes };
