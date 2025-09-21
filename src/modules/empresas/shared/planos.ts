import { EmpresasPlanoModo, EmpresasPlanoStatus } from '@prisma/client';

export const addDays = (date: Date, days: number) => {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
};

export const calcularFim = (
  modo: EmpresasPlanoModo | null | undefined,
  inicio: Date | null,
  diasTeste?: number | null,
): Date | null => {
  const base = inicio ?? new Date();
  if (modo === EmpresasPlanoModo.TESTE) {
    const dias = typeof diasTeste === 'number' && diasTeste > 0 ? diasTeste : 7;
    return addDays(base, dias);
  }
  if (modo === EmpresasPlanoModo.PARCEIRO) {
    return null; // sem validade
  }
  // Assinatura recorrente: controlada pelo gateway; opcionalmente 30 dias
  return null;
};

export const isVigente = (
  status: EmpresasPlanoStatus,
  fim: Date | null,
  reference: Date = new Date(),
) => status === EmpresasPlanoStatus.ATIVO && (fim === null || fim > reference);
