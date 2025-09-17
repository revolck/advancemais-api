import { PlanoParceiro } from '@prisma/client';

import type { ClientePlanoTipo } from '@/modules/empresas/clientes/validators/clientes.schema';

const PLANO_INPUT_MAP: Record<ClientePlanoTipo, PlanoParceiro> = {
  '7_dias': PlanoParceiro.SETE_DIAS,
  '15_dias': PlanoParceiro.QUINZE_DIAS,
  '30_dias': PlanoParceiro.TRINTA_DIAS,
  '60_dias': PlanoParceiro.SESSENTA_DIAS,
  '90dias': PlanoParceiro.NOVENTA_DIAS,
  '120_dias': PlanoParceiro.CENTO_VINTE_DIAS,
  parceiro: PlanoParceiro.PARCEIRO,
};

const PLANO_OUTPUT_MAP: Record<PlanoParceiro, ClientePlanoTipo | 'assinatura_mensal'> = {
  [PlanoParceiro.SETE_DIAS]: '7_dias',
  [PlanoParceiro.QUINZE_DIAS]: '15_dias',
  [PlanoParceiro.TRINTA_DIAS]: '30_dias',
  [PlanoParceiro.SESSENTA_DIAS]: '60_dias',
  [PlanoParceiro.NOVENTA_DIAS]: '90dias',
  [PlanoParceiro.CENTO_VINTE_DIAS]: '120_dias',
  [PlanoParceiro.ASSINATURA_MENSAL]: 'assinatura_mensal',
  [PlanoParceiro.PARCEIRO]: 'parceiro',
};

const PLANO_DURACAO: Record<PlanoParceiro, number | null> = {
  [PlanoParceiro.SETE_DIAS]: 7,
  [PlanoParceiro.QUINZE_DIAS]: 15,
  [PlanoParceiro.TRINTA_DIAS]: 30,
  [PlanoParceiro.SESSENTA_DIAS]: 60,
  [PlanoParceiro.NOVENTA_DIAS]: 90,
  [PlanoParceiro.CENTO_VINTE_DIAS]: 120,
  [PlanoParceiro.ASSINATURA_MENSAL]: null,
  [PlanoParceiro.PARCEIRO]: null,
};

export const mapClienteTipoToPlanoParceiro = (tipo: ClientePlanoTipo) => PLANO_INPUT_MAP[tipo];

export const mapPlanoParceiroToClienteTipo = (tipo: PlanoParceiro) => PLANO_OUTPUT_MAP[tipo];

export const getPlanoParceiroDuracao = (tipo: PlanoParceiro) => PLANO_DURACAO[tipo];

export const isPlanoParceiroElegivel = (tipo: PlanoParceiro) =>
  tipo === PlanoParceiro.PARCEIRO || getPlanoParceiroDuracao(tipo) !== null;
