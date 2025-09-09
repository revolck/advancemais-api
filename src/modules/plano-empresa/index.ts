export * from "./enums";
export { planoEmpresaService } from "./services/plano-empresa.service";
export { PlanoEmpresaController } from "./controllers/plano-empresa.controller";
export { planoEmpresaRoutes } from "./routes";

export const PlanoEmpresaModule = {
  name: "PlanoEmpresa",
  version: "1.0.0",
  description: "Gestão pública de planos empresariais",
  endpoints: {
    root: "/api/v1/plano-empresa",
  },
} as const;
