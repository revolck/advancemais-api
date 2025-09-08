import {
  PlanPaymentMethod,
  CompanyPlanType,
  PlanFrequencyType,
  PlanValidity,
} from "../enums";
import { PlanCategory } from "../../plano-empresa/enums";

export interface CreatePlanRequest {
  nome: string;
  icone?: string;
  categoria: PlanCategory;
  valor: number;
  desconto?: number;
  descricao: string;
  recursos: string[];
  mercadoPagoPlanId?: string;
  frequency: number;
  frequencyType: PlanFrequencyType;
  repetitions?: number | null;
  limiteVagasAtivas?: number | null;
  limiteVagasDestaque?: number | null;
  billingDay?: number;
  billingDayProportional?: boolean;
}

export interface UpdatePlanRequest {
  nome?: string;
  icone?: string;
  categoria?: PlanCategory;
  valor?: number;
  desconto?: number;
  descricao?: string;
  recursos?: string[];
  ativo?: boolean;
  mercadoPagoPlanId?: string | null;
  frequency?: number;
  frequencyType?: PlanFrequencyType;
  repetitions?: number | null;
  limiteVagasAtivas?: number | null;
  limiteVagasDestaque?: number | null;
  billingDay?: number;
  billingDayProportional?: boolean;
}

export interface AssignPlanRequest {
  empresaId: string;
  metodoPagamento: PlanPaymentMethod;
  tipo?: CompanyPlanType;
  validade?: PlanValidity | null;
}
