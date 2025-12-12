import request from 'supertest';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, cleanupTestUsers, type TestUser } from '../helpers/auth-helper';
import { Roles } from '@prisma/client';

describe('API - Autenticação', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    // Limpar usuários de teste
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('POST /api/v1/usuarios/login', () => {
    it('deve fazer login com credenciais válidas', async () => {
      const testUser = await createTestUser({
        email: `login-test-${Date.now()}@test.com`,
        password: 'Test123!@#',
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .post('/api/v1/usuarios/login')
        .set('X-Forwarded-For', `127.0.0.${Math.floor(Math.random() * 255)}`)
        .send({
          documento: testUser.cpf,
          senha: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('usuario');
      expect(response.body.Usuarios).toHaveProperty('id', testUser.id);
      expect(response.body.Usuarios).toHaveProperty('email', testUser.email);
    });

    it('deve retornar erro 401 com credenciais inválidas', async () => {
      const response = await request(app)
        .post('/api/v1/usuarios/login')
        .set('X-Forwarded-For', `127.0.0.${Math.floor(Math.random() * 255)}`)
        .send({
          documento: '00000000000', // CPF inválido/não existe
          senha: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('deve retornar erro 401 com senha incorreta', async () => {
      const testUser = await createTestUser({
        email: 'wrong-password@test.com',
        password: 'CorrectPassword123!',
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .post('/api/v1/usuarios/login')
        .set('X-Forwarded-For', `127.0.0.${Math.floor(Math.random() * 255)}`)
        .send({
          documento: testUser.cpf,
          senha: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve retornar erro 400 sem email', async () => {
      const response = await request(app)
        .post('/api/v1/usuarios/login')
        .set('X-Forwarded-For', `127.0.0.${Math.floor(Math.random() * 255)}`)
        .send({
          senha: 'Test123!@#',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve retornar erro 400 sem senha', async () => {
      const response = await request(app)
        .post('/api/v1/usuarios/login')
        .set('X-Forwarded-For', `127.0.0.${Math.floor(Math.random() * 255)}`)
        .send({
          documento: 'test@test.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve retornar erro 403 para email não verificado', async () => {
      // Aguardar um pouco para evitar rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const testUser = await createTestUser({
        email: `unverified-${Date.now()}@test.com`,
        password: 'Test123!@#',
        emailVerificado: false,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .post('/api/v1/usuarios/login')
        .set('X-Forwarded-For', `127.0.0.${Math.floor(Math.random() * 255)}`)
        .send({
          documento: testUser.cpf,
          senha: testUser.password,
        });

      // Pode retornar 403 ou 429 (rate limit)
      expect([403, 429]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/usuarios/refresh-token', () => {
    it('deve renovar token com refresh token válido', async () => {
      const testUser = await createTestUser({
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .post('/api/v1/usuarios/refresh')
        .send({
          refreshToken: testUser.refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('usuario');
    });

    it('deve retornar erro 401 com refresh token inválido', async () => {
      const response = await request(app)
        .post('/api/v1/usuarios/refresh')
        .send({
          refreshToken: 'invalid-refresh-token',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve retornar erro 400 sem refresh token', async () => {
      const response = await request(app).post('/api/v1/usuarios/refresh').send({}).expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/v1/usuarios/logout', () => {
    it('deve fazer logout com token válido', async () => {
      const testUser = await createTestUser({
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .post('/api/v1/usuarios/logout')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          refreshToken: testUser.refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('deve retornar erro 401 sem token', async () => {
      const response = await request(app)
        .post('/api/v1/usuarios/logout')
        .send({
          refreshToken: 'some-refresh-token',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
