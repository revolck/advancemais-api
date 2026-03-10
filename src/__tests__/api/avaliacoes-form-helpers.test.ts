import request from 'supertest';
import { Roles, CursoStatus } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';

jest.setTimeout(45000);

describe('Avaliacoes - Form Helpers', () => {
  let app: any;
  let adminToken: string;
  let instrutorToken: string;
  let instrutorId: string;
  let instrutor2Id: string;
  let turmaVinculadaId: string;
  let turmaNaoVinculadaId: string;
  let cursoId: string;
  const testUsers: TestUser[] = [];

  beforeAll(async () => {
    app = await getTestApp();
    const admin = await createTestAdmin();
    adminToken = admin.token;
    testUsers.push(admin);

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
    const instrutor1 = await createTestUser({
      nomeCompleto: 'Instrutor 1 Teste',
      email: `instrutor1.${Date.now()}@test.com`,
      password: 'senha123',
      role: Roles.INSTRUTOR,
    });
    testUsers.push(instrutor1);
    instrutorId = instrutor1.id;

    // Criar instrutor 2
    const instrutor2 = await createTestUser({
      nomeCompleto: 'Instrutor 2 Teste',
      email: `instrutor2.${Date.now()}@test.com`,
      password: 'senha123',
      role: Roles.INSTRUTOR,
    });
    testUsers.push(instrutor2);
    instrutor2Id = instrutor2.id;

    // Criar turma vinculada ao instrutor 1
    const turmaVinculada = await prisma.cursosTurmas.create({
      data: {
        codigo: `TV${timestamp}`,
        cursoId: curso.id,
        instrutorId: instrutor1.id,
        nome: 'Turma Vinculada ao Instrutor 1',
        metodo: 'ONLINE',
        turno: 'NOITE',
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
        turno: 'MANHA',
        vagasTotais: 25,
        vagasDisponiveis: 25,
        status: CursoStatus.PUBLICADO,
      },
    });
    turmaNaoVinculadaId = turmaNaoVinculada.id;
    instrutorToken = instrutor1.token;
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
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
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
          modalidade: 'ONLINE',
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
          modalidade: 'ONLINE',
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

  describe('Autorização e ciclo de vida (INSTRUTOR)', () => {
    const inicioFuturo = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const fimFuturo = () => new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

    const createAvaliacao = async (params: {
      turmaId: string;
      instrutorId: string;
      titulo: string;
      etiqueta: string;
    }) =>
      prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId: params.turmaId,
          instrutorId: params.instrutorId,
          tipo: 'PROVA',
          titulo: params.titulo,
          etiqueta: params.etiqueta,
          peso: 5,
          valePonto: true,
          modalidade: 'ONLINE',
          obrigatoria: true,
          status: 'RASCUNHO',
          dataInicio: inicioFuturo(),
          dataFim: fimFuturo(),
          horaInicio: '10:00',
          horaTermino: '12:00',
          ativo: true,
        },
      });

    it('❌ INSTRUTOR com turmaId sem vínculo deve receber 403 na listagem', async () => {
      const res = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ turmaId: turmaNaoVinculadaId })
        .set('Authorization', `Bearer ${instrutorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('❌ INSTRUTOR não pode acessar detalhe de avaliação sem vínculo', async () => {
      const suffix = Date.now().toString().slice(-6);
      const avaliacao = await createAvaliacao({
        turmaId: turmaNaoVinculadaId,
        instrutorId: instrutor2Id,
        titulo: `Prova sem vínculo ${suffix}`,
        etiqueta: `PSV-${suffix}`,
      });

      const res = await request(app)
        .get(`/api/v1/cursos/avaliacoes/${avaliacao.id}`)
        .set('Authorization', `Bearer ${instrutorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('❌ INSTRUTOR não pode editar avaliação sem vínculo', async () => {
      const suffix = Date.now().toString().slice(-6);
      const avaliacao = await createAvaliacao({
        turmaId: turmaNaoVinculadaId,
        instrutorId: instrutor2Id,
        titulo: `Prova editar sem vínculo ${suffix}`,
        etiqueta: `PESV-${suffix}`,
      });

      const res = await request(app)
        .put(`/api/v1/cursos/avaliacoes/${avaliacao.id}`)
        .set('Authorization', `Bearer ${instrutorToken}`)
        .send({
          tipo: 'PROVA',
          titulo: `Atualizada ${suffix}`,
          modalidade: 'ONLINE',
          obrigatoria: true,
          valePonto: true,
          peso: 5,
          status: 'RASCUNHO',
          cursoId,
          turmaId: turmaNaoVinculadaId,
          instrutorId: instrutor2Id,
          recuperacaoFinal: false,
          tipoAtividade: null,
          etiqueta: `PESVU-${suffix}`,
          descricao: 'Teste',
          dataInicio: inicioFuturo().toISOString(),
          dataFim: fimFuturo().toISOString(),
          horaInicio: '10:00',
          horaTermino: '12:00',
          questoes: [
            {
              enunciado: 'Questão',
              tipo: 'TEXTO',
              ordem: 1,
              peso: 1,
              obrigatoria: true,
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('❌ INSTRUTOR não pode excluir avaliação sem vínculo', async () => {
      const suffix = Date.now().toString().slice(-6);
      const avaliacao = await createAvaliacao({
        turmaId: turmaNaoVinculadaId,
        instrutorId: instrutor2Id,
        titulo: `Prova excluir sem vínculo ${suffix}`,
        etiqueta: `PXSV-${suffix}`,
      });

      const res = await request(app)
        .delete(`/api/v1/cursos/avaliacoes/${avaliacao.id}`)
        .set('Authorization', `Bearer ${instrutorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('✅ INSTRUTOR pode editar avaliação vinculada futura', async () => {
      const suffix = Date.now().toString().slice(-6);
      const avaliacao = await createAvaliacao({
        turmaId: turmaVinculadaId,
        instrutorId,
        titulo: `Prova vinculada editar ${suffix}`,
        etiqueta: `PVED-${suffix}`,
      });

      const res = await request(app)
        .put(`/api/v1/cursos/avaliacoes/${avaliacao.id}`)
        .set('Authorization', `Bearer ${instrutorToken}`)
        .send({
          tipo: 'PROVA',
          titulo: `Atualizada vinculada ${suffix}`,
          modalidade: 'ONLINE',
          obrigatoria: true,
          valePonto: true,
          peso: 5,
          status: 'RASCUNHO',
          cursoId,
          turmaId: turmaVinculadaId,
          instrutorId,
          recuperacaoFinal: false,
          tipoAtividade: null,
          etiqueta: `PVEDU-${suffix}`,
          descricao: 'Teste vinculado',
          dataInicio: inicioFuturo().toISOString(),
          dataFim: fimFuturo().toISOString(),
          horaInicio: '10:00',
          horaTermino: '12:00',
          questoes: [
            {
              enunciado: 'Questão',
              tipo: 'TEXTO',
              ordem: 1,
              peso: 1,
              obrigatoria: true,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.avaliacao.id).toBe(avaliacao.id);
    });

    it('✅ INSTRUTOR pode excluir avaliação vinculada futura sem envios', async () => {
      const suffix = Date.now().toString().slice(-6);
      const avaliacao = await createAvaliacao({
        turmaId: turmaVinculadaId,
        instrutorId,
        titulo: `Prova vinculada excluir ${suffix}`,
        etiqueta: `PVEX-${suffix}`,
      });

      const res = await request(app)
        .delete(`/api/v1/cursos/avaliacoes/${avaliacao.id}`)
        .set('Authorization', `Bearer ${instrutorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await prisma.cursosTurmasProvas.findUnique({
        where: { id: avaliacao.id },
        select: { status: true, ativo: true },
      });

      expect(deleted).toBeTruthy();
      expect(deleted?.status).toBe('CANCELADA');
      expect(deleted?.ativo).toBe(false);
    });

    it('❌ ADMIN não pode excluir avaliação com envios', async () => {
      const suffix = Date.now().toString().slice(-6);
      const aluno = await createTestUser({
        nomeCompleto: `Aluno Avaliação ${suffix}`,
        email: `aluno.avaliacao.${suffix}@test.com`,
        role: Roles.ALUNO_CANDIDATO,
      });
      testUsers.push(aluno);

      const avaliacao = await createAvaliacao({
        turmaId: turmaVinculadaId,
        instrutorId,
        titulo: `Prova com envio ${suffix}`,
        etiqueta: `PCEN-${suffix}`,
      });

      const inscricao = await prisma.cursosTurmasInscricoes.create({
        data: {
          turmaId: turmaVinculadaId,
          alunoId: aluno.id,
        },
      });

      await prisma.cursosTurmasProvasEnvios.create({
        data: {
          provaId: avaliacao.id,
          inscricaoId: inscricao.id,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/cursos/avaliacoes/${avaliacao.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('AVALIACAO_JA_INICIADA_OU_REALIZADA');
    });

    it('✅ PATCH publicar/despublicar funciona para avaliação vinculada futura', async () => {
      const suffix = Date.now().toString().slice(-6);
      const avaliacao = await createAvaliacao({
        turmaId: turmaVinculadaId,
        instrutorId,
        titulo: `Prova publicar ${suffix}`,
        etiqueta: `PPUB-${suffix}`,
      });

      await prisma.cursosTurmasProvasQuestoes.create({
        data: {
          provaId: avaliacao.id,
          enunciado: 'Questão para publicação',
          tipo: 'TEXTO',
          ordem: 1,
          peso: 1,
          obrigatoria: true,
        },
      });

      const publicarRes = await request(app)
        .patch(`/api/v1/cursos/avaliacoes/${avaliacao.id}/publicar`)
        .set('Authorization', `Bearer ${instrutorToken}`)
        .send({ publicar: true });

      expect(publicarRes.status).toBe(200);
      expect(publicarRes.body.success).toBe(true);
      expect(publicarRes.body.avaliacao.status).toBe('PUBLICADA');

      const despublicarRes = await request(app)
        .patch(`/api/v1/cursos/avaliacoes/${avaliacao.id}/publicar`)
        .set('Authorization', `Bearer ${instrutorToken}`)
        .send({ publicar: false });

      expect(despublicarRes.status).toBe(200);
      expect(despublicarRes.body.success).toBe(true);
      expect(despublicarRes.body.avaliacao.status).toBe('RASCUNHO');
    });

    it('❌ não pode publicar avaliação sem turma vinculada', async () => {
      const suffix = Date.now().toString().slice(-6);
      const avaliacao = await prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId: null,
          instrutorId,
          tipo: 'PROVA',
          titulo: `Sem turma ${suffix}`,
          etiqueta: `ST-${suffix}`,
          peso: 5,
          valePonto: true,
          modalidade: 'ONLINE',
          obrigatoria: true,
          status: 'RASCUNHO',
          dataInicio: inicioFuturo(),
          dataFim: fimFuturo(),
          horaInicio: '10:00',
          horaTermino: '12:00',
          ativo: true,
        },
      });

      const res = await request(app)
        .patch(`/api/v1/cursos/avaliacoes/${avaliacao.id}/publicar`)
        .set('Authorization', `Bearer ${instrutorToken}`)
        .send({ publicar: true });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA');

      const persisted = await prisma.cursosTurmasProvas.findUniqueOrThrow({
        where: { id: avaliacao.id },
        select: { status: true, turmaId: true },
      });

      expect(persisted.turmaId).toBeNull();
      expect(persisted.status).toBe('RASCUNHO');
    });

    it('✅ registro legado PUBLICADA sem turma é normalizado para RASCUNHO no detalhe e na listagem', async () => {
      const suffix = Date.now().toString().slice(-6);
      const titulo = `Legado sem turma ${suffix}`;
      const avaliacao = await prisma.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId: null,
          instrutorId,
          tipo: 'PROVA',
          titulo,
          etiqueta: `LST-${suffix}`,
          peso: 5,
          valePonto: true,
          modalidade: 'ONLINE',
          obrigatoria: true,
          status: 'PUBLICADA',
          dataInicio: inicioFuturo(),
          dataFim: fimFuturo(),
          horaInicio: '10:00',
          horaTermino: '12:00',
          ativo: true,
        },
      });

      const detalheRes = await request(app)
        .get(`/api/v1/cursos/avaliacoes/${avaliacao.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(detalheRes.status).toBe(200);
      expect(detalheRes.body.data.status).toBe('RASCUNHO');
      expect(detalheRes.body.data.turmaId).toBeNull();

      const listPublicadaRes = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ search: titulo, status: 'PUBLICADA' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listPublicadaRes.status).toBe(200);
      expect(listPublicadaRes.body.data.some((item: any) => item.id === avaliacao.id)).toBe(false);

      const listRascunhoRes = await request(app)
        .get('/api/v1/cursos/avaliacoes')
        .query({ search: titulo, status: 'RASCUNHO' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRascunhoRes.status).toBe(200);
      const legado = listRascunhoRes.body.data.find((item: any) => item.id === avaliacao.id);
      expect(legado).toBeDefined();
      expect(legado.status).toBe('RASCUNHO');
    });
  });
});
