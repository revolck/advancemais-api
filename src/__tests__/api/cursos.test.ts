import request from 'supertest';
import { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import {
  createTestUser,
  createTestAdmin,
  cleanupTestUsers,
  type TestUser,
} from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';
import { randomUUID } from 'crypto';

describe('API - Cursos', () => {
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;
  let testCursoId: number | null = null;
  const testTurmaId: string | null = null;
  let testCategoriaId: number | null = null;
  let testSubcategoriaId: number | null = null;

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testUsers.push(testAdmin);

    // Buscar ou criar uma categoria para os testes
    const categoria = await prisma.cursosCategorias.findFirst();
    if (categoria) {
      testCategoriaId = categoria.id;
      // Buscar subcategoria da categoria
      const subcategoria = await prisma.cursosSubcategorias.findFirst({
        where: { categoriaId: categoria.id },
      });
      if (subcategoria) {
        testSubcategoriaId = subcategoria.id;
      }
    }
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (testTurmaId) {
      await prisma.cursosTurmas.deleteMany({
        where: { id: testTurmaId },
      });
    }
    if (testCursoId) {
      await prisma.cursos.deleteMany({
        where: { id: testCursoId },
      });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  describe('GET /api/v1/cursos', () => {
    it('deve listar cursos com autenticação', async () => {
      const response = await request(app)
        .get('/api/v1/cursos?page=1&pageSize=10')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('pageSize', 10);
      expect(response.body).toHaveProperty('filters');
      expect(response.body.filters).toHaveProperty('applied');
      expect(response.body.filters.applied).toMatchObject({
        search: null,
        statusPadrao: expect.any(Array),
        categoriaId: null,
        subcategoriaId: null,
        instrutorId: null,
      });
      expect(response.body.filters).toHaveProperty('summary');
      expect(Array.isArray(response.body.filters.summary.statusPadrao)).toBe(true);
    });

    it('deve listar cursos sem autenticação (rota pública)', async () => {
      // A rota GET /api/v1/cursos é pública (usa publicCache)
      const response = await request(app).get('/api/v1/cursos?page=1&pageSize=10').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('filters');
    });

    it('deve filtrar cursos por busca', async () => {
      const response = await request(app)
        .get('/api/v1/cursos?page=1&pageSize=10&search=test')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('deve filtrar cursos por status', async () => {
      const response = await request(app)
        .get('/api/v1/cursos?page=1&pageSize=10&statusPadrao=PUBLICADO')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('deve ajustar página quando maior que total disponível', async () => {
      const response = await request(app)
        .get('/api/v1/cursos?page=999&pageSize=5&statusPadrao=RASCUNHO')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('requestedPage', 999);
      expect(response.body.pagination).toHaveProperty('isPageAdjusted', true);
      expect(response.body.pagination.page).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/cursos', () => {
    it('deve criar um novo curso como ADMIN', async () => {
      const timestamp = Date.now().toString().slice(-6);
      const cursoData = {
        nome: `Curso Test ${timestamp}`,
        // codigo é gerado automaticamente pelo serviço
        descricao: 'Descrição do curso de teste',
        cargaHoraria: 40,
        categoriaId: testCategoriaId || undefined,
        subcategoriaId: testSubcategoriaId || undefined,
        statusPadrao: 'RASCUNHO',
      };

      const response = await request(app)
        .post('/api/v1/cursos')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(cursoData)
        .expect(201);

      // O controller retorna o curso diretamente (status 201)
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('nome', cursoData.nome);
      expect(response.body).toHaveProperty('codigo');

      testCursoId = response.body.id;
    });

    it('deve retornar erro 403 para usuário sem permissão', async () => {
      const testUser = await createTestUser({
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const cursoData = {
        nome: 'Curso Test',
        codigo: 'TEST-001',
        descricao: 'Descrição',
        cargaHoraria: 40,
        categoriaId: testCategoriaId || undefined,
        subcategoriaId: testSubcategoriaId || undefined,
      };

      const response = await request(app)
        .post('/api/v1/cursos')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send(cursoData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve validar dados obrigatórios', async () => {
      const response = await request(app)
        .post('/api/v1/cursos')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({
          nome: 'Curso Test',
          // Faltando campos obrigatórios
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/cursos/:cursoId', () => {
    it('deve retornar curso específico por ID', async () => {
      if (!testCursoId) {
        // Criar curso se não existir
        const timestamp = Date.now().toString().slice(-6);
        const curso = await prisma.cursos.create({
          data: {
            nome: `Curso Test ${timestamp}`,
            codigo: `T${timestamp}`, // Máximo 12 caracteres
            descricao: 'Teste',
            cargaHoraria: 40,
            categoriaId: testCategoriaId || undefined,
            subcategoriaId: testSubcategoriaId || undefined,
            statusPadrao: 'RASCUNHO',
            atualizadoEm: new Date(),
          },
        });
        testCursoId = curso.id;
      }

      const response = await request(app)
        .get(`/api/v1/cursos/${testCursoId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      // O controller retorna o curso diretamente, não um objeto com success/data
      expect(response.body).toHaveProperty('id', testCursoId);
      expect(response.body).toHaveProperty('nome');
    });

    it('deve retornar erro 404 para curso inexistente', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/999999')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/v1/cursos/:cursoId', () => {
    it('deve atualizar curso existente', async () => {
      if (!testCursoId) {
        const timestamp = Date.now().toString().slice(-6);
        const curso = await prisma.cursos.create({
          data: {
            nome: `Curso Test ${timestamp}`,
            codigo: `T${timestamp}`, // Máximo 12 caracteres
            descricao: 'Teste',
            cargaHoraria: 40,
            categoriaId: testCategoriaId || undefined,
            subcategoriaId: testSubcategoriaId || undefined,
            statusPadrao: 'RASCUNHO',
            atualizadoEm: new Date(),
          },
        });
        testCursoId = curso.id;
      }

      const updateData = {
        nome: 'Curso Atualizado',
        descricao: 'Nova descrição',
      };

      const response = await request(app)
        .put(`/api/v1/cursos/${testCursoId}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send(updateData)
        .expect(200);

      // O controller retorna o curso diretamente, não um objeto com success/data
      expect(response.body).toHaveProperty('nome', updateData.nome);
      expect(response.body).toHaveProperty('descricao', updateData.descricao);
    });

    it('deve retornar erro 403 para usuário sem permissão', async () => {
      if (!testCursoId) return;

      const testUser = await createTestUser({
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .put(`/api/v1/cursos/${testCursoId}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          nome: 'Curso Atualizado',
        })
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('DELETE /api/v1/cursos/:cursoId', () => {
    it('deve deletar curso como ADMIN', async () => {
      // Criar curso para deletar
      const timestamp = Date.now().toString().slice(-6);
      const curso = await prisma.cursos.create({
        data: {
          nome: `Curso Para Deletar ${timestamp}`,
          codigo: `D${timestamp}`, // Máximo 12 caracteres
          descricao: 'Teste',
          cargaHoraria: 40,
          categoriaId: testCategoriaId || undefined,
          subcategoriaId: testSubcategoriaId || undefined,
          statusPadrao: 'RASCUNHO',
          atualizadoEm: new Date(),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/cursos/${curso.id}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      // O controller retorna o curso diretamente (archived)
      // Nota: ARQUIVADO não existe no enum CursosStatusPadrao, então arquivar significa mudar para RASCUNHO
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('statusPadrao', 'RASCUNHO');
    });

    it('deve retornar erro 403 para usuário sem permissão', async () => {
      const timestamp = Date.now().toString().slice(-6);
      const curso = await prisma.cursos.create({
        data: {
          nome: `Curso Test ${timestamp}`,
          codigo: `T${timestamp}`, // Máximo 12 caracteres
          descricao: 'Teste',
          cargaHoraria: 40,
          categoriaId: testCategoriaId || undefined,
          subcategoriaId: testSubcategoriaId || undefined,
          statusPadrao: 'RASCUNHO',
          atualizadoEm: new Date(),
        },
      });

      const testUser = await createTestUser({
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .delete(`/api/v1/cursos/${curso.id}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);

      // Limpar curso criado
      await prisma.cursos.delete({ where: { id: curso.id } });
    });
  });

  describe('GET /api/v1/cursos/categorias', () => {
    it('deve listar categorias', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/categorias?page=1&pageSize=100')
        .expect(200);

      // A rota retorna um array diretamente, não um objeto com data
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('deve retornar categorias com subcategorias', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/categorias?page=1&pageSize=10')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('nome');
        expect(response.body[0]).toHaveProperty('subcategorias');
      }
    });
  });

  describe('GET /api/v1/cursos/categorias/:categoriaId/subcategorias', () => {
    it('deve listar subcategorias da categoria', async () => {
      if (!testCategoriaId) {
        return;
      }

      const response = await request(app)
        .get(`/api/v1/cursos/categorias/${testCategoriaId}/subcategorias?page=1&pageSize=50`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('pageSize', 50);
      expect(response.body.meta).toHaveProperty('totalItems');
      expect(response.body.meta).toHaveProperty('totalPages');
    });

    it('deve retornar erro 400 para parâmetros inválidos', async () => {
      if (!testCategoriaId) {
        return;
      }

      const response = await request(app)
        .get(`/api/v1/cursos/categorias/${testCategoriaId}/subcategorias?page=0&pageSize=-1`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('deve retornar 404 para categoria inexistente', async () => {
      const response = await request(app)
        .get('/api/v1/cursos/categorias/999999/subcategorias?page=1&pageSize=10')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'CATEGORIA_NOT_FOUND');
    });
  });

  describe('Validações e Edge Cases', () => {
    it('deve retornar erro 400 ao criar curso com dados inválidos', async () => {
      const response = await request(app)
        .post('/api/v1/cursos')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({
          nome: '', // Nome vazio
          codigo: 'TEST',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve retornar erro 400 ao criar curso sem campos obrigatórios', async () => {
      const response = await request(app)
        .post('/api/v1/cursos')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({
          nome: 'Curso Test',
          // Faltando codigo, categoriaId, etc.
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve retornar erro 400 ao atualizar curso com ID inválido', async () => {
      const response = await request(app)
        .put('/api/v1/cursos/invalid-id')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .send({
          nome: 'Curso Atualizado',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve retornar erro 404 ao deletar curso inexistente', async () => {
      const response = await request(app)
        .delete('/api/v1/cursos/999999')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('deve filtrar cursos por instrutor', async () => {
      const testUser = await createTestUser({
        role: 'INSTRUTOR',
        emailVerificado: true,
      });
      testUsers.push(testUser);

      const response = await request(app)
        .get(`/api/v1/cursos?page=1&pageSize=10&instrutorId=${testUser.id}`)
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('deve retornar lista vazia quando não há cursos', async () => {
      // Buscar com filtro que não retorna resultados
      const response = await request(app)
        .get('/api/v1/cursos?page=1&pageSize=10&search=NaoExisteEsteCurso123456')
        .set('Authorization', `Bearer ${testAdmin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total', 0);
    });
  });
});
