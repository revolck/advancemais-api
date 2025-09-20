import { TiposDePlanos } from '@prisma/client';

import type { ClientePlanoTipo } from '@/modules/empresas/clientes/validators/clientes.schema';

const PLAN_TYPE_INPUT_MAP: Record<ClientePlanoTipo, TiposDePlanos> = {
  '7_dias': TiposDePlanos.SETE_DIAS,
  '15_dias': TiposDePlanos.QUINZE_DIAS,
  '30_dias': TiposDePlanos.TRINTA_DIAS,
  '60_dias': TiposDePlanos.SESSENTA_DIAS,
  '90dias': TiposDePlanos.NOVENTA_DIAS,
  '120_dias': TiposDePlanos.CENTO_VINTE_DIAS,
  parceiro: TiposDePlanos.PARCEIRO,
};

const PLAN_TYPE_OUTPUT_MAP: Record<TiposDePlanos, ClientePlanoTipo | 'assinatura_mensal'> = {
  [TiposDePlanos.SETE_DIAS]: '7_dias',
  [TiposDePlanos.QUINZE_DIAS]: '15_dias',
  [TiposDePlanos.TRINTA_DIAS]: '30_dias',
  [TiposDePlanos.SESSENTA_DIAS]: '60_dias',
  [TiposDePlanos.NOVENTA_DIAS]: '90dias',
  [TiposDePlanos.CENTO_VINTE_DIAS]: '120_dias',
  [TiposDePlanos.ASSINATURA_MENSAL]: 'assinatura_mensal',
  [TiposDePlanos.PARCEIRO]: 'parceiro',
};

const PLAN_TYPE_DURATION_MAP: Record<TiposDePlanos, number | null> = {
  [TiposDePlanos.SETE_DIAS]: 7,
  [TiposDePlanos.QUINZE_DIAS]: 15,
  [TiposDePlanos.TRINTA_DIAS]: 30,
  [TiposDePlanos.SESSENTA_DIAS]: 60,
  [TiposDePlanos.NOVENTA_DIAS]: 90,
  [TiposDePlanos.CENTO_VINTE_DIAS]: 120,
  [TiposDePlanos.ASSINATURA_MENSAL]: null,
  [TiposDePlanos.PARCEIRO]: null,
};

export const mapClienteTipoToTipoDePlano = (tipo: ClientePlanoTipo) => PLAN_TYPE_INPUT_MAP[tipo];

export const mapTipoDePlanoToClienteTipo = (tipo: TiposDePlanos) => PLAN_TYPE_OUTPUT_MAP[tipo];

export const getTipoDePlanoDuracao = (tipo: TiposDePlanos) => PLAN_TYPE_DURATION_MAP[tipo];

export const isTipoDePlanoElegivel = (tipo: TiposDePlanos) =>
  tipo === TiposDePlanos.PARCEIRO || getTipoDePlanoDuracao(tipo) !== null;
