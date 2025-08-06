import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { SlideController } from "../controllers/slide.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", SlideController.list);
router.get("/:id", SlideController.get);
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SlideController.create
);
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SlideController.update
);
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SlideController.remove
);

export { router as slideRoutes };

