const mockFindUnique = jest.fn();
const mockCompare = jest.fn();
const mockSendGeneric = jest.fn();
const mockRegistrarLog = jest.fn();
const mockGetRuntimeConfig = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: {
      findUnique: mockFindUnique,
    },
  },
}));

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    compare: mockCompare,
  },
}));

jest.mock('../services/email-service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendGeneric: mockSendGeneric,
  })),
}));

jest.mock('@/modules/auditoria/services/auditoria.service', () => ({
  AuditoriaService: jest.fn().mockImplementation(() => ({
    registrarLog: mockRegistrarLog,
  })),
}));

jest.mock('../config/brevo-config', () => ({
  BrevoConfigManager: {
    getInstance: () => ({
      getRuntimeConfig: mockGetRuntimeConfig,
    }),
  },
}));

const runtimeConfig = {
  urls: {
    frontend: 'https://app.advancemais.com',
    verification: 'https://auth.advancemais.com/verificar-email',
    passwordRecovery: 'https://auth.advancemais.com/recuperar-senha',
  },
};

describe('EmailSandboxService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRuntimeConfig.mockResolvedValue(runtimeConfig);
    mockSendGeneric.mockResolvedValue({
      success: true,
      messageId: 'brevo-message-id',
      simulated: false,
    });
  });

  it('lista as rotinas disponíveis', async () => {
    const { EmailSandboxService } = await import('../services/email-sandbox.service');
    const service = new EmailSandboxService();

    const rotinas = service.listRotinas();

    expect(rotinas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'NOVO_CADASTRO' }),
        expect.objectContaining({ value: 'RECUPERACAO_SENHA' }),
        expect.objectContaining({ value: 'CURSO_PAGAMENTO_APROVADO' }),
        expect.objectContaining({ value: 'USUARIO_DESBLOQUEADO' }),
      ]),
    );
  });

  it('bloqueia usuário moderador', async () => {
    const { EmailSandboxService } = await import('../services/email-sandbox.service');
    const service = new EmailSandboxService();
    mockFindUnique.mockResolvedValue({
      id: 'moderador-id',
      email: 'mod@advancemais.com',
      nomeCompleto: 'Moderador',
      role: 'MODERADOR',
      senha: 'hash',
    });

    await expect(
      service.sendSandboxEmail('moderador-id', {
        rotina: 'NOVO_CADASTRO',
        destinatarioEmail: 'destino@teste.com',
        senha: 'Senha123!',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PERMISSIONS', statusCode: 403 });

    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockSendGeneric).not.toHaveBeenCalled();
  });

  it('bloqueia senha incorreta', async () => {
    const { EmailSandboxService } = await import('../services/email-sandbox.service');
    const service = new EmailSandboxService();
    mockFindUnique.mockResolvedValue({
      id: 'admin-id',
      email: 'admin@advancemais.com',
      nomeCompleto: 'Admin',
      role: 'ADMIN',
      senha: 'hash',
    });
    mockCompare.mockResolvedValue(false);

    await expect(
      service.sendSandboxEmail('admin-id', {
        rotina: 'NOVO_CADASTRO',
        destinatarioEmail: 'destino@teste.com',
        senha: 'senha-errada',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD', statusCode: 403 });

    expect(mockRegistrarLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'BREVO_SANDBOX_EMAIL_ENVIADO',
        dadosNovos: expect.objectContaining({ status: 'FALHA', error: 'INVALID_PASSWORD' }),
      }),
    );
    expect(mockSendGeneric).not.toHaveBeenCalled();
  });

  it('rejeita rotina inválida antes de consultar usuário', async () => {
    const { EmailSandboxService } = await import('../services/email-sandbox.service');
    const service = new EmailSandboxService();

    await expect(
      service.sendSandboxEmail('admin-id', {
        rotina: 'NAO_EXISTE',
        destinatarioEmail: 'destino@teste.com',
        senha: 'Senha123!',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SANDBOX_ROUTINE', statusCode: 400 });

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSendGeneric).not.toHaveBeenCalled();
  });

  it('envia rotina válida para admin com senha correta', async () => {
    const { EmailSandboxService } = await import('../services/email-sandbox.service');
    const service = new EmailSandboxService();
    mockFindUnique.mockResolvedValue({
      id: 'admin-id',
      email: 'admin@advancemais.com',
      nomeCompleto: 'Admin',
      role: 'ADMIN',
      senha: 'hash',
    });
    mockCompare.mockResolvedValue(true);

    const result = await service.sendSandboxEmail('admin-id', {
      rotina: 'RECUPERACAO_SENHA',
      destinatarioEmail: 'Destino@Teste.com',
      senha: 'Senha123!',
    });

    expect(result).toEqual({
      rotina: 'RECUPERACAO_SENHA',
      recipient: 'destino@teste.com',
      simulated: false,
      messageId: 'brevo-message-id',
    });
    expect(mockSendGeneric).toHaveBeenCalledWith(
      'destino@teste.com',
      'Destinatário Sandbox',
      expect.stringContaining('Redefinir senha'),
      expect.stringContaining('sandbox-recuperacao-senha'),
      expect.stringContaining('sandbox-recuperacao-senha'),
    );
    expect(mockRegistrarLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'BREVO_SANDBOX_EMAIL_ENVIADO',
        dadosNovos: expect.objectContaining({ status: 'ENVIADO' }),
      }),
    );
  });
});
