import { EmpresasPlanoModo, EmpresasPlanoStatus } from '@prisma/client';

export const addDays = (date: Date, days: number) => {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
};

const sanitizeDate = (value?: Date | null): Date | null => {
  if (!value) {
    return null;
  }

  const time = value.getTime();

  if (Number.isNaN(time)) {
    return null;
  }

  return new Date(time);
};

export const calcularFim = (
  modo: EmpresasPlanoModo | null | undefined,
  inicio: Date | null,
  diasTeste?: number | null,
  proximaCobranca?: Date | null,
  graceUntil?: Date | null,
): Date | null => {
  const base = inicio ?? new Date();

  if (modo === EmpresasPlanoModo.CLIENTE) {
    const limites = [sanitizeDate(proximaCobranca), sanitizeDate(graceUntil)].filter(
      (value): value is Date => value !== null,
    );

    if (limites.length > 0) {
      const [primeiro, ...restante] = limites;
      const limiteMaisRecente = restante.reduce(
        (maisRecente, atual) => (atual.getTime() > maisRecente.getTime() ? atual : maisRecente),
        primeiro,
      );

      return new Date(limiteMaisRecente.getTime());
    }

    return null; // assinatura ativa controlada pelo gateway de pagamento
  }

  if (modo === EmpresasPlanoModo.TESTE) {
    const dias = typeof diasTeste === 'number' && diasTeste > 0 ? diasTeste : 7;
    return addDays(base, dias);
  }

  if (modo === EmpresasPlanoModo.PARCEIRO) {
    return null; // sem validade
  }

  // Assinaturas recorrentes de outros modos: controladas pelo gateway
  return null;
};

export const isVigente = (
  status: EmpresasPlanoStatus,
  fim: Date | null,
  reference: Date = new Date(),
) => status === EmpresasPlanoStatus.ATIVO && (fim === null || fim > reference);
