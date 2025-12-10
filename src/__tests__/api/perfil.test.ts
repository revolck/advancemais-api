import request from 'supertest';
import { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, cleanupTestUsers, type TestUser } from '../helpers/auth-helper';

describe('API - Perfil do Usuário', () => {
  let app: Express;
  let testUsers: TestUser[] = [];

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('GET /api/v1/usuarios/perfil', () => {
    it('deve retornar perfil do usuário autenticado', async () => {
      const testUser = await createTestUser({
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .get('/api/v1/usuarios/perfil')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('usuario');
      expect(response.body.Usuarios).toHaveProperty('id', testUser.id);
      expect(response.body.Usuarios).toHaveProperty('email', testUser.email);
      expect(response.body.Usuarios).toHaveProperty('nomeCompleto', testUser.nomeCompleto);
      expect(response.body.Usuarios).toHaveProperty('role');
      expect(response.body.Usuarios).toHaveProperty('status');
    });

    it('deve retornar erro 401 sem token', async () => {
      const response = await request(app).get('/api/v1/usuarios/perfil').expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'MISSING_TOKEN');
    });

    it('deve retornar erro 401 com token inválido', async () => {
      const response = await request(app)
        .get('/api/v1/usuarios/perfil')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  // Nota: A rota PUT /api/v1/usuarios/perfil não existe atualmente
  // A atualização de perfil é feita através de rotas administrativas ou específicas
  // Os testes abaixo foram removidos até que a rota seja implementada
});
