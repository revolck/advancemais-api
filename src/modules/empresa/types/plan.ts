import {
  PlanPaymentMethod,
  CompanyPlanType,
  PlanFrequencyType,
  PlanValidity,
} from "../enums";

export interface CreatePlanRequest {
  nome: string;
  valor: number;
  descricao: string;
  recursos: string[];
  mercadoPagoPlanId?: string;
  frequency: number;
  frequencyType: PlanFrequencyType;
  repetitions?: number | null;
}

export interface UpdatePlanRequest {
  nome?: string;
  valor?: number;
  descricao?: string;
  recursos?: string[];
  ativo?: boolean;
  mercadoPagoPlanId?: string | null;
  frequency?: number;
  frequencyType?: PlanFrequencyType;
  repetitions?: number | null;
}

export interface AssignPlanRequest {
  empresaId: string;
  metodoPagamento: PlanPaymentMethod;
  tipo?: CompanyPlanType;
  validade?: PlanValidity | null;
}
