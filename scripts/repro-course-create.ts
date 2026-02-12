import request from 'supertest';
import { getTestApp } from '@/__tests__/helpers/test-setup';
import { createTestAdmin, cleanupTestUsers } from '@/__tests__/helpers/auth-helper';

(async () => {
  const app = await getTestApp();
  const admin = await createTestAdmin();

  const res = await request(app)
    .post('/api/v1/cursos')
    .set('Authorization', `Bearer ${admin.token}`)
    .send({
      nome: `Curso Repro ${Date.now()}`,
      descricao: 'Descricao',
      cargaHoraria: 40,
      statusPadrao: 'RASCUNHO',
    });

  console.log('status', res.status);
  console.log('body', JSON.stringify(res.body));

  await cleanupTestUsers([admin.id]);
})();
