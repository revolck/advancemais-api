import crypto from 'crypto';
import request from 'supertest';

import { prisma } from '@/config/prisma';
import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.mock('@/modules/brevo/services/email-service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    enviarEmailRecuperacaoSenha: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'test-password-recovery-email',
      simulated: true,
    }),
  })),
}));

jest.setTimeout(30_000);

describe('API - Recuperação de senha', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  it('deve validar link mesmo após 3 solicitações de recuperação pelo mesmo IP', async () => {
    const testUser = await createTestUser({
      email: `password-recovery-${Date.now()}@test.com`,
      password: 'OldPassword123!',
      emailVerificado: true,
    });
    testUsers.push(testUser);

    const clientIp = `127.10.0.${Math.floor(Math.random() * 200) + 1}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      await request(app)
        .post('/api/v1/usuarios/recuperar-senha')
        .set('X-Forwarded-For', clientIp)
        .send({ email: testUser.email })
        .expect(200);
    }

    const recuperacao = await prisma.usuariosRecuperacaoSenha.findUnique({
      where: { usuarioId: testUser.id },
      select: { tokenRecuperacao: true, tokenRecuperacaoExp: true },
    });

    expect(recuperacao?.tokenRecuperacao).toMatch(/^[a-f0-9]{64}$/);
    expect(recuperacao?.tokenRecuperacaoExp?.getTime()).toBeGreaterThan(Date.now());

    await request(app)
      .get(`/api/v1/usuarios/recuperar-senha/validar/${recuperacao?.tokenRecuperacao}`)
      .set('X-Forwarded-For', clientIp)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveProperty('message', 'Token válido');
        expect(response.body.Usuarios).toHaveProperty('email', testUser.email);
      });
  });

  it('deve rejeitar e limpar token de recuperação expirado', async () => {
    const testUser = await createTestUser({
      email: `password-recovery-expired-${Date.now()}@test.com`,
      password: 'OldPassword123!',
      emailVerificado: true,
    });
    testUsers.push(testUser);

    const expiredToken = crypto.randomBytes(32).toString('hex');

    await prisma.usuariosRecuperacaoSenha.create({
      data: {
        usuarioId: testUser.id,
        tokenRecuperacao: expiredToken,
        tokenRecuperacaoExp: new Date(Date.now() - 60_000),
        tentativasRecuperacao: 1,
        ultimaTentativaRecuperacao: new Date(Date.now() - 60_000),
      },
    });

    await request(app)
      .get(`/api/v1/usuarios/recuperar-senha/validar/${expiredToken}`)
      .set('X-Forwarded-For', `127.20.0.${Math.floor(Math.random() * 200) + 1}`)
      .expect(400)
      .expect((response) => {
        expect(response.body).toHaveProperty(
          'message',
          'Token expirado. Solicite uma nova recuperação',
        );
      });

    const recuperacao = await prisma.usuariosRecuperacaoSenha.findUnique({
      where: { usuarioId: testUser.id },
      select: { tokenRecuperacao: true, tokenRecuperacaoExp: true },
    });

    expect(recuperacao?.tokenRecuperacao).toBeNull();
    expect(recuperacao?.tokenRecuperacaoExp).toBeNull();
  });
});
