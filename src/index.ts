import express from "express";
import cors from "cors";
import helmet from "helmet";
import usuarioRoutes from "./routes/usuario";

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

app.use("/api/usuarios", usuarioRoutes);

app.listen(3000, () => console.log("Server rodando na porta 3000"));
