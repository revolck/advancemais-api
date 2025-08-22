import { prisma } from "../../../config/prisma";
import { ServiceResponse } from "../../mercadopago/types/order";

export class AuditService {
  async getLogs(empresaId?: string): Promise<ServiceResponse<any>> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: empresaId ? { empresaId } : undefined,
        orderBy: { criadoEm: "desc" },
      });
      return { success: true, data: logs };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Erro ao buscar logs de auditoria",
          details: error instanceof Error ? error.message : error,
          code: "GET_AUDIT_LOGS_ERROR",
        },
      };
    }
  }
}
