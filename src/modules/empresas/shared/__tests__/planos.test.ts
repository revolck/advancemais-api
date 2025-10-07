import { EmpresasPlanoModo } from '@prisma/client';

import { calcularFim } from '../planos';

describe('calcularFim', () => {
  it('calcula o término padrão para planos de teste', () => {
    const inicio = new Date('2024-05-10T12:00:00Z');

    const fim = calcularFim(EmpresasPlanoModo.TESTE, inicio, 10);

    expect(fim?.toISOString()).toBe('2024-05-20T12:00:00.000Z');
  });

  it('retorna a próxima cobrança para planos do modo CLIENTE', () => {
    const inicio = new Date('2024-05-10T12:00:00Z');
    const proximaCobranca = new Date('2024-06-10T12:00:00Z');

    const fim = calcularFim(EmpresasPlanoModo.CLIENTE, inicio, undefined, proximaCobranca, null);

    expect(fim?.toISOString()).toBe('2024-06-10T12:00:00.000Z');
  });

  it('prioriza o período de carência quando for mais distante que a próxima cobrança', () => {
    const inicio = new Date('2024-05-10T12:00:00Z');
    const proximaCobranca = new Date('2024-06-10T12:00:00Z');
    const graceUntil = new Date('2024-06-15T12:00:00Z');

    const fim = calcularFim(
      EmpresasPlanoModo.CLIENTE,
      inicio,
      undefined,
      proximaCobranca,
      graceUntil,
    );

    expect(fim?.toISOString()).toBe('2024-06-15T12:00:00.000Z');
  });

  it('retorna null para planos do modo CLIENTE sem limites definidos', () => {
    const inicio = new Date('2024-05-10T12:00:00Z');

    const fim = calcularFim(EmpresasPlanoModo.CLIENTE, inicio);

    expect(fim).toBeNull();
  });
});
