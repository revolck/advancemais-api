/**
 * Módulo Empresa - gerenciamento de planos e auditoria
 */

export * from "./enums";
export * from "./types";

export { PlanService } from "./services/plan-service";
export { PlanController } from "./controllers/plan-controller";

export { empresaRoutes } from "./routes";

export const EmpresaModule = {
  name: "Empresa",
  version: "1.0.0",
  description: "Gestão de planos para empresas",
  endpoints: {
    plans: "/api/v1/empresa/plans",
  },
} as const;
