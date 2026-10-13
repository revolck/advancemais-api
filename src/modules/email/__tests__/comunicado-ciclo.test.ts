const mockConfig = jest.fn();
const mockSincronizar = jest.fn();
const mockProcessarLote = jest.fn();
const mockContagemJanela = jest.fn();
const mockSituacaoRampa = jest.fn();
const mockCreditos = jest.fn();
const mockValidar = jest.fn();
const mockUsuariosFindMany = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: { usuarios: { findMany: (...a: unknown[]) => mockUsuariosFindMany(...a) } },
}));
jest.mock('@/modules/configuracoes-gerais', () => ({
  runtimeConfigService: { getComunicadoPrimeiroAcessoConfig: () => mockConfig() },
}));
jest.mock('../client/brevo-client', () => ({
  BrevoClient: { getInstance: () => ({ obterCreditosEnvio: () => mockCreditos() }) },
}));
jest.mock('../validacao', () => ({ validarEmails: (...a: unknown[]) => mockValidar(...a) }));
jest.mock('../comunicados/primeiro-acesso.sincronizacao', () => ({
  sincronizarComBrevo: (...a: unknown[]) => mockSincronizar(...a),
}));
jest.mock('../comunicados/primeiro-acesso.service', () => {
  const real = jest.requireActual('../comunicados/primeiro-acesso.service');
  return {
    avaliarTaxaDevolucao: real.avaliarTaxaDevolucao,
    inicioJanelaDevolucao: real.inicioJanelaDevolucao,
    resultadoVazio: real.resultadoVazio,
    filtroElegiveis: () => ({}),
    contagemJanela: (...a: unknown[]) => mockContagemJanela(...a),
    situacaoRampa: (...a: unknown[]) => mockSituacaoRampa(...a),
    processarLote: (...a: unknown[]) => mockProcessarLote(...a),
    reabrirEmailsCorrigidos: async () => 0,
    recuperarEnviosTravados: async () => 0,
  };
});

import { enviarParaAluno, executarCicloComunicado } from '../comunicados/primeiro-acesso.cron';

const loteVazio = {
  processados: 0,
  enviados: 0,
  falhas: 0,
  incertos: 0,
  naoValidados: 0,
  interrompidoPor: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.mockResolvedValue({
    ativo: true,
    lote: 80,
    maxDevolucao: 5,
    rampaInicial: 100,
    maxDiario: 1000,
  });
  mockSincronizar.mockResolvedValue({ devolvidos: 0 });
  mockContagemJanela.mockResolvedValue({ enviados: 0, devolvidos: 0 });
  mockSituacaoRampa.mockResolvedValue({
    disponivelHoje: 200,
    limiteHoje: 200,
    enviadosHoje: 0,
    diasComEnvio: 1,
  });
  mockCreditos.mockResolvedValue(4800);
  mockUsuariosFindMany.mockResolvedValue([{ email: 'a@gmail.com' }]);
  mockValidar.mockResolvedValue({
    processados: 1,
    porResultado: {},
    interrompidoPor: null,
    erro: null,
  });
  mockProcessarLote.mockResolvedValue({ ...loteVazio, processados: 80, enviados: 80 });
});

describe('ciclo do comunicado: proteções', () => {
  it('sem resposta da Brevo não envia nada', async () => {
    mockSincronizar.mockRejectedValue(new Error('timeout'));
    const r = await executarCicloComunicado();
    expect(r?.interrompidoPor).toBe('FALHA_SINCRONIZACAO_BREVO');
    expect(mockProcessarLote).not.toHaveBeenCalled();
    expect(mockValidar).not.toHaveBeenCalled();
  });

  it('pausa com devolução acima de 5% nas últimas 24h (inclusive com o limite pedido manualmente)', async () => {
    mockContagemJanela.mockResolvedValue({ enviados: 99, devolvidos: 17 });
    const r = await executarCicloComunicado({ limite: 500 });
    expect(r?.interrompidoPor).toBe('TAXA_DEVOLUCAO_ALTA');
    expect(mockProcessarLote).not.toHaveBeenCalled();
  });

  it('créditos da Brevo desconhecidos ou abaixo da reserva param o envio', async () => {
    mockCreditos.mockResolvedValueOnce(null);
    expect((await executarCicloComunicado())?.interrompidoPor).toBe('COTA_BREVO_DESCONHECIDA');
    mockCreditos.mockRejectedValueOnce(new Error('401'));
    expect((await executarCicloComunicado())?.interrompidoPor).toBe('COTA_BREVO_DESCONHECIDA');
    mockCreditos.mockResolvedValueOnce(250);
    expect((await executarCicloComunicado())?.interrompidoPor).toBe('COTA_BREVO_INSUFICIENTE');
    expect(mockProcessarLote).not.toHaveBeenCalled();
  });

  it('limite do dia (aquecimento) atingido não envia', async () => {
    mockSituacaoRampa.mockResolvedValue({
      disponivelHoje: 0,
      limiteHoje: 100,
      enviadosHoje: 100,
      diasComEnvio: 0,
    });
    expect((await executarCicloComunicado())?.interrompidoPor).toBe('LIMITE_DIARIO_RAMPA');
    expect(mockProcessarLote).not.toHaveBeenCalled();
  });

  it('envia o menor entre lote, saldo do dia e créditos acima da reserva', async () => {
    mockSituacaoRampa.mockResolvedValue({
      disponivelHoje: 37,
      limiteHoje: 200,
      enviadosHoje: 163,
      diasComEnvio: 1,
    });
    await executarCicloComunicado();
    expect(mockProcessarLote.mock.calls[0][0]).toBe(37);

    mockCreditos.mockResolvedValue(320); // 20 acima da reserva de 300
    await executarCicloComunicado();
    expect(mockProcessarLote.mock.calls[1][0]).toBe(20);
  });

  it('sem endereços validados informa o motivo', async () => {
    mockProcessarLote.mockResolvedValue({ ...loteVazio, naoValidados: 2900 });
    expect((await executarCicloComunicado())?.interrompidoPor).toBe('SEM_ENDERECOS_VALIDADOS');
  });

  it('valida a fila antes de enviar', async () => {
    await executarCicloComunicado();
    expect(mockValidar).toHaveBeenCalledWith(
      ['a@gmail.com'],
      expect.objectContaining({ limite: 200 }),
    );
    expect(mockValidar.mock.invocationCallOrder[0]).toBeLessThan(
      mockProcessarLote.mock.invocationCallOrder[0],
    );
  });

  it('envio individual (suporte) também respeita a pausa', async () => {
    mockContagemJanela.mockResolvedValue({ enviados: 60, devolvidos: 10 });
    expect((await enviarParaAluno('u1'))?.interrompidoPor).toBe('TAXA_DEVOLUCAO_ALTA');
    expect(mockProcessarLote).not.toHaveBeenCalled();
  });

  it('não roda dois ciclos ao mesmo tempo', async () => {
    mockSincronizar.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({}), 20)),
    );
    const primeiro = executarCicloComunicado();
    expect(await executarCicloComunicado()).toBeNull();
    expect(await primeiro).not.toBeNull();
  });
});
