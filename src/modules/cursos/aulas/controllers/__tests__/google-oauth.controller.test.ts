const mockGenerateAuthUrl = jest.fn();
const mockHandleCallback = jest.fn();

jest.mock('../../services/google-oauth.service', () => ({
  googleOAuthService: {
    generateAuthUrl: mockGenerateAuthUrl,
    handleCallback: mockHandleCallback,
  },
}));

import { GoogleOAuthController } from '../google-oauth.controller';

function buildRes() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    redirect: jest.fn(),
  } as any;
}

describe('GoogleOAuthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateAuthUrl.mockResolvedValue('https://accounts.google.com/o/oauth2/auth?...');
  });

  describe('connect', () => {
    it('repassa returnTo seguro para generateAuthUrl', async () => {
      const req = { user: { id: 'user-1' }, query: { returnTo: '/perfil' } } as any;
      const res = buildRes();

      await GoogleOAuthController.connect(req, res);

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith('user-1', '/perfil');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('ignora returnTo que aponta para outro domínio (proteção contra open redirect)', async () => {
      const req = {
        user: { id: 'user-1' },
        query: { returnTo: 'https://evil.example.com' },
      } as any;
      const res = buildRes();

      await GoogleOAuthController.connect(req, res);

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith('user-1', undefined);
    });

    it('ignora returnTo protocol-relative ("//host")', async () => {
      const req = { user: { id: 'user-1' }, query: { returnTo: '//evil.example.com' } } as any;
      const res = buildRes();

      await GoogleOAuthController.connect(req, res);

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith('user-1', undefined);
    });

    it('funciona sem returnTo (comportamento padrão preservado)', async () => {
      const req = { user: { id: 'user-1' }, query: {} } as any;
      const res = buildRes();

      await GoogleOAuthController.connect(req, res);

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith('user-1', undefined);
    });
  });

  describe('callback', () => {
    it('redireciona de volta para o returnTo embutido no state', async () => {
      mockHandleCallback.mockResolvedValue(undefined);
      const req = { query: { code: 'abc', state: 'user-1::%2Fperfil' } } as any;
      const res = buildRes();

      await GoogleOAuthController.callback(req, res);

      expect(mockHandleCallback).toHaveBeenCalledWith('abc', 'user-1');
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/perfil?google=conectado'),
      );
    });

    it('usa o padrão /dashboard/configuracoes quando o state não tem returnTo', async () => {
      mockHandleCallback.mockResolvedValue(undefined);
      const req = { query: { code: 'abc', state: 'user-1' } } as any;
      const res = buildRes();

      await GoogleOAuthController.callback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/configuracoes?google=conectado'),
      );
    });

    it('usa o padrão quando o returnTo embutido no state é malicioso', async () => {
      mockHandleCallback.mockResolvedValue(undefined);
      const req = {
        query: { code: 'abc', state: `user-1::${encodeURIComponent('https://evil.example.com')}` },
      } as any;
      const res = buildRes();

      await GoogleOAuthController.callback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/configuracoes?google=conectado'),
      );
    });

    it('redireciona para o returnTo com ?google=erro quando handleCallback falha', async () => {
      mockHandleCallback.mockRejectedValue(new Error('token inválido'));
      const req = { query: { code: 'abc', state: 'user-1::%2Fperfil' } } as any;
      const res = buildRes();

      await GoogleOAuthController.callback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/perfil?google=erro'));
    });

    it('retorna 400 quando code ou state estão ausentes', async () => {
      const req = { query: {} } as any;
      const res = buildRes();

      await GoogleOAuthController.callback(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockHandleCallback).not.toHaveBeenCalled();
    });
  });
});
