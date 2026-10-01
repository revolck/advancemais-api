import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const mockUsuariosFindUnique = jest.fn();
const mockUsuariosUpdate = jest.fn();
const mockTransaction = jest.fn();
const mockRecordAudit = jest.fn();
const mockInvalidateUserCache = jest.fn();
const mockGetCache = jest.fn();
const mockSetCache = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: {
      findUnique: (...args: unknown[]) => mockUsuariosFindUnique(...args),
      update: (...args: unknown[]) => mockUsuariosUpdate(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
  retryOperation: (fn: () => Promise<unknown>) => fn(),
}));

jest.mock('@/utils/cache', () => ({
  getCache: (...args: unknown[]) => mockGetCache(...args),
  setCache: (...args: unknown[]) => mockSetCache(...args),
}));

jest.mock('../utils/cache', () => ({
  invalidateUserCache: (...args: unknown[]) => mockInvalidateUserCache(...args),
}));

jest.mock('../utils/user-history', () => ({
  recordUserAuditEvent: (...args: unknown[]) => mockRecordAudit(...args),
}));

import bcrypt from 'bcrypt';
import { jwtConfig } from '@/config/env';
import { jwtAuthMiddleware } from '../auth/jwt-middleware';
import { isAllowedDuringPasswordChange } from '../auth/password-change-gate';
import { alterarSenha } from '../controllers/alterar-senha-controller';
import { definirSenhaProvisoria } from '../services/senha-provisoria.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'aluno@advancemais.com',
    nomeCompleto: 'Aluno Migrado',
    cpf: '12345678909',
    cnpj: null,
    role: 'ALUNO_CANDIDATO',
    status: 'ATIVO',
    tipoUsuario: 'PESSOA_FISICA',
    authId: 'migracao-aluno-12345678909',
    ultimoLogin: null,
    precisaTrocarSenha: true,
    UsuariosInformation: { telefone: null },
    ...overrides,
  };
}

function token() {
  return jwt.sign({ id: USER_ID, role: 'ALUNO_CANDIDATO', type: 'access' }, jwtConfig.secret, {
    subject: USER_ID,
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const ok = (_req: express.Request, res: express.Response) => res.json({ ok: true });
  app.get('/api/v1/usuarios/perfil', jwtAuthMiddleware(), ok);
  app.post('/api/v1/usuarios/logout', jwtAuthMiddleware(), ok);
  app.put('/api/v1/usuarios/perfil/alterar-senha', jwtAuthMiddleware(), alterarSenha);
  app.get('/api/v1/cursos/minhas-turmas', jwtAuthMiddleware(), ok);
  app.put('/api/v1/usuarios/perfil', jwtAuthMiddleware(), ok);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCache.mockResolvedValue(null);
  mockSetCache.mockResolvedValue(undefined);
  mockTransaction.mockImplementation((fn) => fn({ usuarios: { update: mockUsuariosUpdate } }));
});

describe('isAllowedDuringPasswordChange', () => {
  it('libera só logout, GET /perfil e a troca de senha', () => {
    expect(isAllowedDuringPasswordChange('GET', '/api/v1/usuarios/perfil')).toBe(true);
    expect(isAllowedDuringPasswordChange('GET', '/api/v1/usuarios/perfil/?x=1')).toBe(true);
    expect(isAllowedDuringPasswordChange('POST', '/api/v1/usuarios/logout')).toBe(true);
    expect(isAllowedDuringPasswordChange('put', '/api/v1/usuarios/perfil/alterar-senha')).toBe(
      true,
    );
    expect(isAllowedDuringPasswordChange('PUT', '/api/v1/usuarios/perfil')).toBe(false);
    expect(isAllowedDuringPasswordChange('GET', '/api/v1/cursos')).toBe(false);
  });
});

describe('bloqueio no middleware JWT', () => {
  it('bloqueia rotas comuns com 403 PASSWORD_CHANGE_REQUIRED', async () => {
    mockUsuariosFindUnique.mockResolvedValue(baseUser());

    const res = await request(buildApp())
      .get('/api/v1/cursos/minhas-turmas')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('bloqueia também a edição de perfil até trocar a senha', async () => {
    mockUsuariosFindUnique.mockResolvedValue(baseUser());

    const res = await request(buildApp())
      .put('/api/v1/usuarios/perfil')
      .set('Authorization', `Bearer ${token()}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('mantém GET /perfil e logout liberados (o front trata 403 no perfil como bloqueio)', async () => {
    mockUsuariosFindUnique.mockResolvedValue(baseUser());
    const app = buildApp();

    const perfil = await request(app)
      .get('/api/v1/usuarios/perfil')
      .set('Authorization', `Bearer ${token()}`);
    const logout = await request(app)
      .post('/api/v1/usuarios/logout')
      .set('Authorization', `Bearer ${token()}`);

    expect(perfil.status).toBe(200);
    expect(logout.status).toBe(200);
  });

  it('não interfere em quem não precisa trocar a senha', async () => {
    mockUsuariosFindUnique.mockResolvedValue(baseUser({ precisaTrocarSenha: false }));

    const res = await request(buildApp())
      .get('/api/v1/cursos/minhas-turmas')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
  });
});

describe('PUT /perfil/alterar-senha', () => {
  const senhaProvisoria = 'Kq7mPz4R@xY2';
  const novaSenha = 'MinhaSenha#2026';

  async function setupUser(precisaTrocarSenha = true) {
    const hash = await bcrypt.hash(senhaProvisoria, 4);
    mockUsuariosFindUnique.mockImplementation((args: { select?: Record<string, unknown> }) =>
      args?.select && 'senha' in args.select
        ? Promise.resolve({ id: USER_ID, senha: hash, precisaTrocarSenha })
        : Promise.resolve(baseUser({ precisaTrocarSenha })),
    );
  }

  it('troca a senha provisória e libera o acesso', async () => {
    await setupUser();

    const res = await request(buildApp())
      .put('/api/v1/usuarios/perfil/alterar-senha')
      .set('Authorization', `Bearer ${token()}`)
      .send({ senhaAntiga: senhaProvisoria, senhaNova: novaSenha, confirmarSenha: novaSenha });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, precisaTrocarSenha: false });
    const update = mockUsuariosUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: USER_ID });
    expect(update.data).toMatchObject({ precisaTrocarSenha: false, senhaProvisoriaEm: null });
    expect(await bcrypt.compare(novaSenha, update.data.senha)).toBe(true);
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USUARIO_SENHA_ALTERADA',
        meta: { origem: 'PRIMEIRO_ACESSO' },
      }),
    );
    expect(mockInvalidateUserCache).toHaveBeenCalledWith(USER_ID);
  });

  it('responde 400 (não 401) para senha atual incorreta', async () => {
    await setupUser();

    const res = await request(buildApp())
      .put('/api/v1/usuarios/perfil/alterar-senha')
      .set('Authorization', `Bearer ${token()}`)
      .send({ senhaAntiga: 'Errada@123', senhaNova: novaSenha, confirmarSenha: novaSenha });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(mockUsuariosUpdate).not.toHaveBeenCalled();
  });

  it.each([
    [
      { senhaAntiga: senhaProvisoria, senhaNova: 'fraca', confirmarSenha: 'fraca' },
      'WEAK_PASSWORD',
    ],
    [
      { senhaAntiga: senhaProvisoria, senhaNova: novaSenha, confirmarSenha: 'Outra#2026x' },
      'PASSWORD_MISMATCH',
    ],
    [
      { senhaAntiga: senhaProvisoria, senhaNova: senhaProvisoria, confirmarSenha: senhaProvisoria },
      'SAME_PASSWORD',
    ],
    [{ senhaAntiga: senhaProvisoria }, 'MISSING_FIELDS'],
  ])('rejeita payload inválido (%o) com %s', async (body, code) => {
    await setupUser();

    const res = await request(buildApp())
      .put('/api/v1/usuarios/perfil/alterar-senha')
      .set('Authorization', `Bearer ${token()}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect(mockUsuariosUpdate).not.toHaveBeenCalled();
  });

  it('também funciona como troca de senha comum no perfil', async () => {
    await setupUser(false);

    const res = await request(buildApp())
      .put('/api/v1/usuarios/perfil/alterar-senha')
      .set('Authorization', `Bearer ${token()}`)
      .send({ senhaAntiga: senhaProvisoria, senhaNova: novaSenha, confirmarSenha: novaSenha });

    expect(res.status).toBe(200);
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { origem: 'PERFIL' } }),
    );
  });
});

describe('definirSenhaProvisoria', () => {
  it('grava só o hash, liga a troca obrigatória e devolve a senha individual', async () => {
    const resultado = await definirSenhaProvisoria(USER_ID);

    expect(resultado.senhaProvisoria).toHaveLength(12);
    const update = mockUsuariosUpdate.mock.calls[0][0];
    expect(update.data.precisaTrocarSenha).toBe(true);
    expect(update.data.senhaProvisoriaEm).toBeInstanceOf(Date);
    expect(update.data.senha).not.toBe(resultado.senhaProvisoria);
    expect(await bcrypt.compare(resultado.senhaProvisoria, update.data.senha)).toBe(true);
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USUARIO_SENHA_PROVISORIA_DEFINIDA' }),
    );
    expect(mockInvalidateUserCache).toHaveBeenCalledWith(USER_ID);
  });

  it('gera senhas diferentes para usuários diferentes', async () => {
    const a = await definirSenhaProvisoria(USER_ID);
    const b = await definirSenhaProvisoria('22222222-2222-2222-2222-222222222222');
    expect(a.senhaProvisoria).not.toBe(b.senhaProvisoria);
  });
});
