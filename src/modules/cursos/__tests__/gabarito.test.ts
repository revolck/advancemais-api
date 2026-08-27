import { describe, expect, it } from '@jest/globals';

import {
  GABARITO_RELEASE_DELAY_MS,
  combinarDataHoraAvaliacao,
  obterLiberacaoGabarito,
} from '../utils/gabarito';

describe('liberação do gabarito', () => {
  const dataFim = new Date('2026-08-26T00:00:00.000Z');

  it('mantém o gabarito oculto durante o minuto de encerramento', () => {
    const resultado = obterLiberacaoGabarito(
      dataFim,
      '17:30',
      new Date('2026-08-26T20:30:59.999Z'),
    );

    expect(resultado.disponivel).toBe(false);
    expect(resultado.disponivelEm?.toISOString()).toBe('2026-08-26T20:31:00.000Z');
  });

  it('libera o gabarito exatamente um minuto após o encerramento', () => {
    const resultado = obterLiberacaoGabarito(
      dataFim,
      '17:30',
      new Date('2026-08-26T20:31:00.000Z'),
    );

    expect(GABARITO_RELEASE_DELAY_MS).toBe(60_000);
    expect(resultado.disponivel).toBe(true);
  });

  it('não libera sem uma data e hora válidas', () => {
    expect(combinarDataHoraAvaliacao(dataFim, '25:00')).toBeNull();
    expect(obterLiberacaoGabarito(dataFim, null).disponivel).toBe(false);
  });
});
