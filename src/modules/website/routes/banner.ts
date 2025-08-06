import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { BannerController } from "../controllers/banner.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", BannerController.list);
router.get("/:id", BannerController.get);
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  BannerController.create
);
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  BannerController.update
);
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  BannerController.remove
);

export { router as bannerRoutes };
