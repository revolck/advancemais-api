import {
  KickboxValidador,
  NeverBounceValidador,
  ZeroBounceValidador,
  criarValidadorExterno,
} from '../validacao/provedores';
import { ErroValidador } from '../validacao/tipos';

const mockFetch = jest.fn();
const originalFetch = global.fetch;

const resposta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = originalFetch;
});
beforeEach(() => mockFetch.mockReset());

const erroDe = async (promessa: Promise<unknown>) => {
  try {
    await promessa;
  } catch (error) {
    return error as ErroValidador;
  }
  throw new Error('esperava erro');
};

describe('ZeroBounce', () => {
  const validador = new ZeroBounceValidador('chave-teste');

  it.each([
    [{ status: 'valid' }, 'VALIDO'],
    [{ status: 'invalid', sub_status: 'mailbox_not_found' }, 'INVALIDO'],
    [{ status: 'catch-all' }, 'RISCO'],
    [{ status: 'spamtrap' }, 'RISCO'],
    [{ status: 'do_not_mail', sub_status: 'toxic' }, 'RISCO'],
    [{ status: 'unknown', sub_status: 'greylisted' }, 'TEMPORARIO'],
    [{ status: 'unknown', sub_status: 'mail_server_did_not_respond' }, 'TEMPORARIO'],
    [{ status: 'unknown', sub_status: 'exception_x' }, 'DESCONHECIDO'],
  ])('%j → %s', async (body, esperado) => {
    mockFetch.mockResolvedValueOnce(resposta(body));
    expect((await validador.validar('a@gmail.com')).resultado).toBe(esperado);
  });

  it('não aplica a sugestão, só registra', async () => {
    mockFetch.mockResolvedValueOnce(resposta({ status: 'invalid', did_you_mean: 'a@gmail.com' }));
    const r = await validador.validar('a@gmal.com');
    expect(r).toMatchObject({ resultado: 'INVALIDO', sugestao: 'a@gmail.com' });
  });

  it('sem créditos interrompe (não classifica o endereço)', async () => {
    mockFetch.mockResolvedValueOnce(resposta({ error: 'Your account ran out of credits' }));
    expect((await erroDe(validador.validar('a@gmail.com'))).codigo).toBe('SEM_CREDITOS');
  });

  it('não expõe a chave na mensagem de erro de rede', async () => {
    mockFetch.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED https://api?api_key=chave-teste'),
    );
    const erro = await erroDe(validador.validar('a@gmail.com'));
    expect(erro.codigo).toBe('INDISPONIVEL');
    expect(erro.message).not.toContain('chave-teste');
  });

  it('timeout de um endereço vira TEMPORARIO sem parar o lote', async () => {
    mockFetch.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    expect(await validador.validar('a@gmail.com')).toMatchObject({ resultado: 'TEMPORARIO' });
  });
});

describe('NeverBounce', () => {
  const validador = new NeverBounceValidador('k');

  it.each([
    ['valid', 'VALIDO'],
    ['invalid', 'INVALIDO'],
    ['disposable', 'RISCO'],
    ['catchall', 'RISCO'],
    ['unknown', 'TEMPORARIO'],
  ])('%s → %s', async (result, esperado) => {
    mockFetch.mockResolvedValueOnce(resposta({ status: 'success', result }));
    expect((await validador.validar('a@hotmail.com')).resultado).toBe(esperado);
  });

  it('credencial inválida interrompe', async () => {
    mockFetch.mockResolvedValueOnce(resposta({ status: 'auth_failure', message: 'Invalid key' }));
    expect((await erroDe(validador.validar('a@hotmail.com'))).codigo).toBe('CREDENCIAL_INVALIDA');
  });
});

describe('Kickbox', () => {
  const validador = new KickboxValidador('k');

  it('deliverable que aceita qualquer endereço é RISCO', async () => {
    mockFetch.mockResolvedValueOnce(resposta({ result: 'deliverable', accept_all: true }));
    expect((await validador.validar('a@empresa.com')).resultado).toBe('RISCO');
  });

  it.each([
    [{ result: 'deliverable' }, 'VALIDO'],
    [{ result: 'undeliverable', reason: 'rejected_email' }, 'INVALIDO'],
    [{ result: 'risky', disposable: true }, 'RISCO'],
    [{ result: 'unknown', reason: 'no_connect' }, 'TEMPORARIO'],
  ])('%j → %s', async (body, esperado) => {
    mockFetch.mockResolvedValueOnce(resposta(body));
    expect((await validador.validar('a@gmail.com')).resultado).toBe(esperado);
  });

  it('saldo insuficiente (HTTP 403) é SEM_CREDITOS', async () => {
    mockFetch.mockResolvedValueOnce(
      resposta({ success: false, message: 'Insufficient balance' }, 403),
    );
    expect((await erroDe(validador.validar('a@gmail.com'))).codigo).toBe('SEM_CREDITOS');
  });
});

describe('fábrica', () => {
  it('sem chave ou provedor desconhecido não cria validador', () => {
    expect(criarValidadorExterno('zerobounce', '')).toBeNull();
    expect(criarValidadorExterno('outro', 'k')).toBeNull();
    expect(criarValidadorExterno(' ZeroBounce ', 'k')?.fonte).toBe('ZEROBOUNCE');
    expect(criarValidadorExterno('kickbox', 'k')?.fonte).toBe('KICKBOX');
  });
});
