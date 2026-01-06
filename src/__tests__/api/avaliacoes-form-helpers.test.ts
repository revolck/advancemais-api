import request from 'supertest';
import { Roles, CursoStatus } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';

describe('Avaliacoes - Form Helpers', () => {
  let app: any;
  let adminToken: string;
  let instrutorToken: string;
  let instrutorId: string;
  let instrutor2Id: string;
  let turmaVinculadaId: string;
  let turmaNaoVinculadaId: string;
  let cursoId: string;

  beforeAll(async () => {
    app = await getTestApp();
    // Criar curso de teste
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos
    const curso = await prisma.cursos.create({
      data: {
        codigo: `FRM${timestamp}`,
        nome: 'Curso para Testes de Formulário',
        descricao: 'Curso de teste',
        cargaHoraria: 40,
        statusPadrao: 'PUBLICADO',
        valor: 0,
        gratuito: true,
        estagioObrigatorio: false,
      },
    });
    cursoId = curso.id;

    // Criar instrutor 1
    const instrutor1 = await prisma.usuarios.create({
      data: {
        nomeCompleto: 'Instrutor 1 Teste',
        email: `instrutor1.${Date.now()}@test.com`,
        senha: 'senha123',
        cpf: `${Date.now().toString().slice(-11)}`,
        telefone: '11999990001',
        role: Roles.INSTRUTOR,
        ativo: true,
      },
    });
    instrutorId = instrutor1.id;

    // Criar instrutor 2
    const instrutor2 = await prisma.usuarios.create({
      data: {
        nomeCompleto: 'Instrutor 2 Teste',
        email: `instrutor2.${Date.now()}@test.com`,
        senha: 'senha123',
        cpf: `${Date.now().toString().slice(-10)}2`,
        telefone: '11999990002',
        role: Roles.INSTRUTOR,
        ativo: true,
      },
    });
    instrutor2Id = instrutor2.id;

    // Criar turma vinculada ao instrutor 1
    const turmaVinculada = await prisma.cursosTurmas.create({
      data: {
        codigo: `TV${timestamp}`,
        cursoId: curso.id,
        instrutorId: instrutor1.id,
        nome: 'Turma Vinculada ao Instrutor 1',
        metodo: 'ONLINE',
        turno: 'NOTURNO',
        vagasTotais: 30,
        vagasDisponiveis: 30,
        status: CursoStatus.PUBLICADO,
      },
    });
    turmaVinculadaId = turmaVinculada.id;

    // Criar turma NÃO vinculada (sem instrutor)
    const turmaNaoVinculada = await prisma.cursosTurmas.create({
      data: {
        codigo: `TN${timestamp}`,
        cursoId: curso.id,
        nome: 'Turma Sem Instrutor',
        metodo: 'PRESENCIAL',
        turno: 'MATUTINO',
        vagasTotais: 25,
        vagasDisponiveis: 25,
        status: CursoStatus.PUBLICADO,
      },
    });
    turmaNaoVinculadaId = turmaNaoVinculada.id;

    // Login Admin
    const adminLogin = await request(app).post('/api/v1/usuarios/login').send({
      documento: '11111111111',
      senha: 'AdminTeste@123',
    });
    adminToken = adminLogin.body.token;

    // Login Instrutor
    const instrutorLogin = await request(app).post('/api/v1/usuarios/login').send({
      documento: instrutor1.cpf,
      senha: 'senha123',
    });
    instrutorToken = instrutorLogin.body.token;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (cursoId) {
      await prisma.cursosTurmasProvas.deleteMany({
        where: { cursoId },
      });
    }
    if (turmaVinculadaId || turmaNaoVinculadaId) {
      await prisma.cursosTurmas.deleteMany({
        where: { id: { in: [turmaVinculadaId, turmaNaoVinculadaId].filter(Boolean) } },
      });
    }
    if (cursoId) {
      await prisma.cursos.delete({
        where: { id: cursoId },
      });
    }
    if (instrutorId || instrutor2Id) {
      await prisma.usuarios.deleteMany({
        where: { id: { in: [instrutorId, instrutor2Id].filter(Boolean) } },
      });
    }
  });

  describe('GET /api/v1/cursos/avaliacoes/turmas', () => {
    it('✅ ADMIN deve ver todas as turmas', async () => {
      const res = await request(app)
        .get('/api/v1/cursos/avaliacoes/turmas')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.turmas)).toBe(true);
      expect(res.body.turmas.length).toBeGreaterThanOrEqual(2);

      // Verificar estrutura da turma
      const turma = res.body.turmas[0];
      expect(turma).toHaveProperty('id');
      expect(turma).toHaveProperty('codigo');
      expect(turma).toHaveProperty('nome');
      expect(turma).toHaveProperty('metodo');
      expect(turma).toHaveProperty('Cursos');
      expect(turma.Cursos).toHaveProperty('nome');
    });

    it('✅ INSTRUTOR deve ver apenas turmas vinculadas', async () => {
      const res = await request(app)
        .get('/api/v1/cursos/avaliacoes/turmas')
        .set('Authorization', `Bearer ${instrutorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.turmas)).toBe(true);

      // Instrutor deve ver apenas a turma vinculada a ele
      const turmasVinculadas = res.body.turmas.filter((t: any) => t.instrutorId === instrutorId);
      expect(turmasVinculadas.length).toBeGreaterThan(0);

      // Verificar que TurmaVinculada está na lista
      const turmaVinculada = res.body.turmas.find((t: any) => t.id === turmaVinculadaId);
      expect(turmaVinculada).toBeDefined();
      expect(turmaVinculada.instrutorId).toBe(instrutorId);

      // Verificar que TurmaNaoVinculada NÃO está na lista
      const turmaNaoVinculada = res.body.turmas.find((t: any) => t.id === turmaNaoVinculadaId);
      expect(turmaNaoVinculada).toBeUndefined();
    });

    it('❌ Deve retornar 401 sem autenticação', async () => {
      const res = await request(app).get('/api/v1/cursos/avaliacoes/turmas');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/cursos/avaliacoes/instrutores', () => {
    it('✅ Deve listar todos os instrutores ativos', async () => {
      const res = await request(app)
        .get('/api/v1/cursos/avaliacoes/instrutores')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.instrutores)).toBe(true);
      expect(res.body.instrutores.length).toBeGreaterThanOrEqual(2);

      // Verificar estrutura
      const instrutor = res.body.instrutores[0];
      expect(instrutor).toHaveProperty('id');
      expect(instrutor).toHaveProperty('nomeCompleto');
      expect(instrutor).toHaveProperty('email');
      expect(instrutor).toHaveProperty('cpf');

      // Verificar que nossos instrutores estão na lista
      const instrutor1 = res.body.instrutores.find((i: any) => i.id === instrutorId);
      expect(instrutor1).toBeDefined();

      const instrutor2 = res.body.instrutores.find((i: any) => i.id === instrutor2Id);
      expect(instrutor2).toBeDefined();
    });

    it('✅ INSTRUTOR também pode listar instrutores (para ver opções)', async () => {
      const res = await request(app)
        .get('/api/v1/cursos/avaliacoes/instrutores')
        .set('Authorization', `Bearer ${instrutorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.instrutores)).toBe(true);
    });

    it('❌ Deve retornar 401 sem autenticação', async () => {
      const res = await request(app).get('/api/v1/cursos/avaliacoes/instrutores');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/cursos/avaliacoes (Validação Instrutor)', () => {
    it('✅ INSTRUTOR pode criar prova sem turma', async () => {
      const res = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${instrutorToken}`)
        .send({
          cursoId,
          tipo: 'PROVA',
          titulo: 'Prova do Instrutor sem Turma',
          peso: 5,
          modalidade: 'ONLINE',
          dataInicio: '2026-09-01',
          dataFim: '2026-09-01',
          horaInicio: '10:00',
          horaTermino: '12:00',
          questoes: [
            {
              enunciado: 'Teste',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.avaliacao.instrutorId).toBe(instrutorId); // Auto-preenchido
      expect(res.body.avaliacao.turmaId).toBeNull();
    });

    it('✅ INSTRUTOR pode criar prova vinculada à SUA turma', async () => {
      const res = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${instrutorToken}`)
        .send({
          cursoId,
          turmaId: turmaVinculadaId,
          tipo: 'PROVA',
          titulo: 'Prova do Instrutor com Turma Vinculada',
          peso: 5,
          dataInicio: '2026-09-05',
          dataFim: '2026-09-05',
          horaInicio: '14:00',
          horaTermino: '16:00',
          questoes: [
            {
              enunciado: 'Teste 2',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'X', correta: true },
                { texto: 'Y', correta: false },
              ],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.avaliacao.instrutorId).toBe(instrutorId);
      expect(res.body.avaliacao.turmaId).toBe(turmaVinculadaId);
    });

    it('❌ INSTRUTOR NÃO pode criar prova em turma de outro instrutor', async () => {
      const res = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${instrutorToken}`)
        .send({
          cursoId,
          turmaId: turmaNaoVinculadaId, // Turma sem instrutor
          tipo: 'PROVA',
          titulo: 'Tentativa de Prova em Turma Não Vinculada',
          peso: 5,
          dataInicio: '2026-09-10',
          dataFim: '2026-09-10',
          horaInicio: '10:00',
          horaTermino: '12:00',
          questoes: [
            {
              enunciado: 'Teste 3',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'A', correta: true },
                { texto: 'B', correta: false },
              ],
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('INSTRUTOR_TURMA_NAO_VINCULADA');
    });

    it('✅ ADMIN pode criar prova em qualquer turma', async () => {
      const res = await request(app)
        .post('/api/v1/cursos/avaliacoes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cursoId,
          turmaId: turmaNaoVinculadaId,
          tipo: 'PROVA',
          titulo: 'Prova do Admin em Turma Sem Instrutor',
          peso: 5,
          modalidade: 'PRESENCIAL',
          dataInicio: '2026-09-15',
          dataFim: '2026-09-15',
          horaInicio: '08:00',
          horaTermino: '10:00',
          questoes: [
            {
              enunciado: 'Teste Admin',
              tipo: 'MULTIPLA_ESCOLHA',
              alternativas: [
                { texto: 'Certo', correta: true },
                { texto: 'Errado', correta: false },
              ],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.avaliacao.turmaId).toBe(turmaNaoVinculadaId);
    });
  });
});
