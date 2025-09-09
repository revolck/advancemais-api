export { vagaRoutes } from "./routes";
export { VagaController } from "./controllers/vaga.controller";
export { vagaService } from "./services/vaga.service";

export const VagaModule = {
  name: "Vagas",
  version: "1.0.0",
  description: "Gestão de vagas de emprego",
  endpoints: {
    root: "/api/v1/vagas",
  },
} as const;
