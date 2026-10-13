const mockFindMany = jest.fn();
const mockUpsert = jest.fn();
const mockLocal = jest.fn();
const mockExterno = jest.fn();
const mockConfig = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    emailsValidacoes: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      upsert: (...a: unknown[]) => mockUpsert(...a),
    },
  },
}));
jest.mock('@/modules/configuracoes-gerais', () => ({
  runtimeConfigService: { getEmailValidacaoConfig: () => mockConfig() },
}));
jest.mock('../validacao/verificacao-local', () => ({
  verificarLocalmente: (...a: unknown[]) => mockLocal(...a),
}));
jest.mock('../validacao/provedores', () => ({
  criarValidadorExterno: (provedor: string | null, chave: string) =>
    provedor && chave ? { fonte: 'ZEROBOUNCE', validar: (e: string) => mockExterno(e) } : null,
}));

import {
  liberadoParaEnvio,
  precisaValidar,
  registrarSinaisBrevo,
  validarEmails,
  type RegistroValidacao,
} from '../validacao/email-validacao.service';
import { ErroValidador } from '../validacao/tipos';

const agora = new Date('2026-10-14T12:00:00Z');
const registro = (parcial: Partial<RegistroValidacao>): RegistroValidacao => ({
  email: 'a@gmail.com',
  resultado: 'VALIDO',
  fonte: 'ZEROBOUNCE',
  motivo: null,
  sugestao: null,
  tentativas: 1,
  validadoEm: agora,
  proximaTentativaEm: null,
  ...parcial,
});
const salvos = () => mockUpsert.mock.calls.map(([a]) => ({ email: a.where.email, ...a.update }));

beforeEach(() => {
  jest.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockLocal.mockResolvedValue(null);
  mockConfig.mockResolvedValue({ provedor: 'zerobounce', apiKey: 'k' });
});

describe('regras de (re)validação', () => {
  it('bloqueio real da Brevo nunca é revalidado', () => {
    const r = registro({ resultado: 'INVALIDO', fonte: 'BREVO' });
    expect(precisaValidar(r, agora, true)).toBe(false);
  });

  it('VALIDO vale 30 dias', () => {
    const antigo = registro({ validadoEm: new Date('2026-09-01T00:00:00Z') });
    expect(liberadoParaEnvio(registro({}), agora)).toBe(true);
    expect(liberadoParaEnvio(antigo, agora)).toBe(false);
    expect(precisaValidar(antigo, agora, true)).toBe(true);
  });

  it('PENDENTE só é revalidado quando há validador; RISCO/INVALIDO dependem de humano', () => {
    expect(precisaValidar(registro({ resultado: 'PENDENTE' }), agora, false)).toBe(false);
    expect(precisaValidar(registro({ resultado: 'PENDENTE' }), agora, true)).toBe(true);
    expect(precisaValidar(registro({ resultado: 'RISCO' }), agora, true)).toBe(false);
    expect(precisaValidar(registro({ resultado: 'INVALIDO', fonte: 'LOCAL' }), agora, true)).toBe(
      false,
    );
  });

  it('TEMPORARIO espera a próxima tentativa', () => {
    const futuro = registro({
      resultado: 'TEMPORARIO',
      proximaTentativaEm: new Date('2026-10-15'),
    });
    expect(precisaValidar(futuro, agora, true)).toBe(false);
  });
});

describe('validarEmails', () => {
  it('sem validador externo, quem passa no local fica PENDENTE (nunca VALIDO)', async () => {
    mockConfig.mockResolvedValue({ provedor: null, apiKey: '' });
    const r = await validarEmails(['A@Gmail.com ', 'a@gmail.com']);
    expect(r.porResultado).toEqual({ PENDENTE: 1 });
    expect(mockExterno).not.toHaveBeenCalled();
    expect(salvos()[0]).toMatchObject({ email: 'a@gmail.com', resultado: 'PENDENTE' });
  });

  it('usa o validador externo e não gasta crédito com o que o local já descartou', async () => {
    mockLocal.mockImplementation(async (e: string) =>
      e.endsWith('gmal.com')
        ? { resultado: 'RISCO', motivo: 'DOMINIO_COM_ERRO_DE_DIGITACAO' }
        : null,
    );
    mockExterno.mockResolvedValue({ resultado: 'VALIDO', motivo: 'CAIXA_CONFIRMADA' });
    const r = await validarEmails(['a@gmal.com', 'b@gmail.com']);
    expect(mockExterno).toHaveBeenCalledTimes(1);
    expect(r.porResultado).toEqual({ RISCO: 1, VALIDO: 1 });
    expect(salvos().find((s) => s.email === 'b@gmail.com')).toMatchObject({ fonte: 'ZEROBOUNCE' });
  });

  it('falha do validador interrompe o lote sem marcar ninguém como válido', async () => {
    mockExterno.mockRejectedValue(new ErroValidador('SEM_CREDITOS', 'sem créditos'));
    const r = await validarEmails(['a@gmail.com', 'b@gmail.com', 'c@gmail.com']);
    expect(r).toMatchObject({ interrompidoPor: 'SEM_CREDITOS', processados: 0 });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('TEMPORARIO vira DESCONHECIDO na 3ª tentativa', async () => {
    mockFindMany.mockResolvedValue([
      registro({ resultado: 'TEMPORARIO', tentativas: 2, proximaTentativaEm: null }),
    ]);
    mockExterno.mockResolvedValue({ resultado: 'TEMPORARIO', motivo: 'TEMPORARIO:greylisted' });
    await validarEmails(['a@gmail.com'], { agora });
    expect(salvos()[0]).toMatchObject({ resultado: 'DESCONHECIDO', tentativas: 3 });
  });

  it('respeita o limite por chamada', async () => {
    mockExterno.mockResolvedValue({ resultado: 'VALIDO', motivo: 'ok' });
    const r = await validarEmails(['a@x.com', 'b@x.com', 'c@x.com'], { limite: 2 });
    expect(r.processados).toBe(2);
  });
});

describe('sinais da Brevo', () => {
  it('registra devolução/bloqueio com precedência e ignora o que já está igual', async () => {
    mockFindMany.mockResolvedValue([
      registro({ email: 'b@x.com', resultado: 'BLOQUEADO', fonte: 'BREVO' }),
    ]);
    const alterados = await registrarSinaisBrevo([
      { email: 'A@x.com', resultado: 'BLOQUEADO', motivo: 'BREVO_BLOQUEADO' },
      { email: 'a@x.com', resultado: 'INVALIDO', motivo: 'BREVO_HARD_BOUNCE' },
      { email: 'b@x.com', resultado: 'BLOQUEADO', motivo: 'BREVO_DENUNCIA_SPAM' },
    ]);
    expect(alterados).toBe(1);
    expect(salvos()).toEqual([
      expect.objectContaining({ email: 'a@x.com', resultado: 'INVALIDO', fonte: 'BREVO' }),
    ]);
  });
});
