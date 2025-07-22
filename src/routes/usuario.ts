import { Router } from "express";
import { criarUsuario, loginUsuario } from "../controllers/usuarioController";

const router = Router();

router.post("/registrar", criarUsuario);
router.post("/login", loginUsuario);

export default router;
