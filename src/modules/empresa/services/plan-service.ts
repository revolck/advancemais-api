import { prisma } from "../../../config/prisma";
import { Prisma } from "@prisma/client";
import {
  CreatePlanRequest,
  UpdatePlanRequest,
  AssignPlanRequest,
} from "../types/plan";
import { ServiceResponse } from "../../mercadopago/types/order";
import { CompanyPlanType, PlanValidity } from "../enums";

const MAX_PLANS = 4;

export class PlanService {
  async createPlan(
    data: CreatePlanRequest,
    usuarioId: string
  ): Promise<ServiceResponse<any>> {
    try {
      const count = await prisma.mercadoPagoPlan.count();
      if (count >= MAX_PLANS) {
        return {
          success: false,
          error: {
            message: "Limite de planos atingido",
            code: "PLAN_LIMIT_REACHED",
          },
        };
      }

      const plan = await prisma.mercadoPagoPlan.create({ data });

      await prisma.auditLog.create({
        data: {
          usuarioId,
          acao: "CREATE_PLAN",
          detalhes: plan,
        },
      });

      return { success: true, data: plan };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Erro ao criar plano",
          details: error instanceof Error ? error.message : error,
          code: "CREATE_PLAN_ERROR",
        },
      };
    }
  }

  async getPlans(): Promise<ServiceResponse<any>> {
    try {
      const plans = await prisma.mercadoPagoPlan.findMany();
      return { success: true, data: plans };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Erro ao buscar planos",
          details: error instanceof Error ? error.message : error,
          code: "GET_PLANS_ERROR",
        },
      };
    }
  }

  async updatePlan(
    id: string,
    data: UpdatePlanRequest,
    usuarioId: string
  ): Promise<ServiceResponse<any>> {
    try {
      const plan = await prisma.mercadoPagoPlan.update({
        where: { id },
        data,
      });

      const detalhes: Prisma.JsonObject = {
        id,
        ...Object.fromEntries(
          Object.entries(data).filter(([, value]) => value !== undefined)
        ),
      };

      await prisma.auditLog.create({
        data: {
          usuarioId,
          acao: "UPDATE_PLAN",
          detalhes,
        },
      });

      return { success: true, data: plan };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Erro ao atualizar plano",
          details: error instanceof Error ? error.message : error,
          code: "UPDATE_PLAN_ERROR",
        },
      };
    }
  }

  async assignPlan(
    planId: string,
    payload: AssignPlanRequest,
    usuarioId: string
  ): Promise<ServiceResponse<any>> {
    try {
      const empresa = await prisma.empresa.findUnique({
        where: { id: payload.empresaId },
      });

      if (!empresa) {
        return {
          success: false,
          error: {
            message: "Empresa não encontrada",
            code: "COMPANY_NOT_FOUND",
          },
        };
      }

      const diasMap: Record<PlanValidity, number> = {
        [PlanValidity.DIAS_15]: 15,
        [PlanValidity.DIAS_30]: 30,
        [PlanValidity.DIAS_90]: 90,
        [PlanValidity.DIAS_120]: 120,
        [PlanValidity.SEM_VALIDADE]: 0,
      };

      const dias = payload.validade ? diasMap[payload.validade] : 0;

      const data = {
        empresaId: payload.empresaId,
        planoId: planId,
        metodoPagamento: payload.metodoPagamento,
        tipo: payload.tipo ?? CompanyPlanType.STANDARD,
        validade: payload.validade ?? null,
        inicio: new Date(),
        fim:
          dias > 0 ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000) : null,
      };

      const empresaPlano = await prisma.empresaPlano.upsert({
        where: { empresaId: payload.empresaId },
        update: data,
        create: data,
      });

      await prisma.auditLog.create({
        data: {
          usuarioId,
          empresaId: payload.empresaId,
          acao: "ASSIGN_PLAN",
          detalhes: { planId, ...data },
        },
      });

      return { success: true, data: empresaPlano };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Erro ao vincular plano",
          details: error instanceof Error ? error.message : error,
          code: "ASSIGN_PLAN_ERROR",
        },
      };
    }
  }

  async unassignPlan(
    empresaId: string,
    usuarioId: string
  ): Promise<ServiceResponse<any>> {
    try {
      const deleted = await prisma.empresaPlano.deleteMany({
        where: { empresaId },
      });

      await prisma.auditLog.create({
        data: {
          usuarioId,
          empresaId,
          acao: "UNASSIGN_PLAN",
          detalhes: { removed: deleted.count },
        },
      });

      return { success: true, data: deleted };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Erro ao desvincular plano",
          details: error instanceof Error ? error.message : error,
          code: "UNASSIGN_PLAN_ERROR",
        },
      };
    }
  }
}
