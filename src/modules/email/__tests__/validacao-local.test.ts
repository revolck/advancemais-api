const mockResolveMx = jest.fn();
jest.mock('dns', () => ({ promises: { resolveMx: (...a: unknown[]) => mockResolveMx(...a) } }));

import {
  detectarErroDeDigitacao,
  limparCacheDominios,
  verificarLocalmente,
} from '../validacao/verificacao-local';

beforeEach(() => {
  jest.clearAllMocks();
  limparCacheDominios();
  mockResolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]);
});

describe('erro de digitação no domínio', () => {
  it.each([
    ['gmal.com', 'gmail.com'],
    ['gamail.com', 'gmail.com'],
    ['hormail.com', 'hotmail.com'],
    ['hotamil.com', 'hotmail.com'],
    ['outloook.com', 'outlook.com'],
    ['uotlook.com', 'outlook.com'],
    ['hotmail.com.com', 'hotmail.com'],
    ['hoitmail.com.br', 'hotmail.com.br'],
    ['wahoo.com.br', 'yahoo.com.br'],
    ['hotmail.comn', 'hotmail.com'],
  ])('%s → %s', (dominio, esperado) => {
    expect(detectarErroDeDigitacao(dominio)).toBe(esperado);
  });

  it.each(['gmail.com', 'ymail.com', 'mail.com', 'hotmail.com.br', 'krona.com.br', 'consegi.com'])(
    'não acusa domínio real: %s',
    (dominio) => {
      expect(detectarErroDeDigitacao(dominio)).toBeNull();
    },
  );
});

describe('verificação local', () => {
  it('marca domínio com erro de digitação como RISCO mesmo com MX (pode ser de terceiros)', async () => {
    const r = await verificarLocalmente('fulano@hotmail.com.com');
    expect(r).toEqual({
      resultado: 'RISCO',
      motivo: 'DOMINIO_COM_ERRO_DE_DIGITACAO',
      sugestao: 'fulano@hotmail.com',
    });
    expect(mockResolveMx).not.toHaveBeenCalled();
  });

  it('formato inválido', async () => {
    expect((await verificarLocalmente('fulano@gmail..com'))?.resultado).toBe('INVALIDO');
    expect((await verificarLocalmente('.fulano@gmail.com'))?.resultado).toBe('INVALIDO');
    expect((await verificarLocalmente('sem-arroba'))?.resultado).toBe('INVALIDO');
  });

  it('domínio sem MX é INVALIDO; falha de DNS é TEMPORARIO', async () => {
    mockResolveMx.mockRejectedValueOnce(Object.assign(new Error('nx'), { code: 'ENOTFOUND' }));
    expect(await verificarLocalmente('a@empresa-que-fechou.com.br')).toMatchObject({
      resultado: 'INVALIDO',
      motivo: 'DOMINIO_SEM_MX',
    });
    mockResolveMx.mockRejectedValueOnce(Object.assign(new Error('t'), { code: 'ETIMEOUT' }));
    expect(await verificarLocalmente('a@lento.com.br')).toMatchObject({ resultado: 'TEMPORARIO' });
  });

  it('MX nulo (RFC 7505) é INVALIDO', async () => {
    mockResolveMx.mockResolvedValueOnce([{ exchange: '.', priority: 0 }]);
    expect((await verificarLocalmente('a@naorecebe.com'))?.resultado).toBe('INVALIDO');
  });

  it('domínio descartável é RISCO', async () => {
    expect((await verificarLocalmente('a@mailinator.com'))?.motivo).toBe('DOMINIO_DESCARTAVEL');
  });

  it('endereço que passa retorna null: ainda precisa do validador externo', async () => {
    expect(await verificarLocalmente('Fulano.Silva@Gmail.com ')).toBeNull();
  });
});
