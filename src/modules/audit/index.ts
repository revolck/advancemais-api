export { auditRoutes } from "./routes";
export { AuditService } from "./services/audit-service";
export { AuditController } from "./controllers/audit-controller";

export const AuditModule = {
  name: "Audit",
  version: "1.0.0",
  description: "Logs de auditoria do sistema",
  endpoints: {
    logs: "/api/v1/audit/logs",
  },
} as const;
