/**
 * Links das aulas (sala do Meet, materiais) e dados de pessoas nas rotas abertas da turma.
 * Cria curso e turma em rascunho (fora do site), uma aula com sala e material, um admin e
 * dois alunos (um matriculado); no fim apaga tudo, inclusive a auditoria.
 */
import request from 'supertest';
import { Express } from 'express';
import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';

jest.setTimeout(60000);

const MEET = 'https://meet.google.com/abc-defg-hij';
const MATERIAL = 'https://blob.teste/apostila-privada.pdf';

describe('API - Links privados da turma (E2E)', () => {
  let app: Express;
  const usuarios: TestUser[] = [];
  let admin: TestUser;
  let alunoMatriculado: TestUser;
  let alunoDeFora: TestUser;
  let cursoId = '';
  let turmaId = '';
  let aulaId = '';

  beforeAll(async () => {
    app = await getTestApp();
    admin = await createTestAdmin();
    alunoMatriculado = await createTestUser({ role: 'ALUNO_CANDIDATO', emailVerificado: true });
    alunoDeFora = await createTestUser({ role: 'ALUNO_CANDIDATO', emailVerificado: true });
    usuarios.push(admin, alunoMatriculado, alunoDeFora);

    const marca = Date.now();
    const curso = await prisma.cursos.create({
      data: {
        nome: `Curso Teste Links ${marca}`,
        codigo: `CTL${marca}`.slice(0, 12),
        descricao: 'Curso para teste de links privados',
        valor: 0,
        valorPromocional: 0,
        gratuito: true,
        statusPadrao: 'RASCUNHO',
        cargaHoraria: 10,
        estagioObrigatorio: false,
      },
      select: { id: true },
    });
    cursoId = curso.id;
    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId,
        nome: `Turma Teste Links ${marca}`,
        codigo: `TLK${marca}`.slice(0, 12),
        metodo: 'ONLINE',
        vagasTotais: 10,
        vagasDisponiveis: 10,
        dataInicio: new Date(marca + 7 * 24 * 60 * 60 * 1000),
        dataFim: new Date(marca + 30 * 24 * 60 * 60 * 1000),
        status: 'RASCUNHO',
      },
      select: { id: true },
    });
    turmaId = turma.id;
    const aula = await prisma.cursosTurmasAulas.create({
      data: {
        codigo: `ALK${marca}`.slice(0, 12),
        nome: 'Aula ao vivo de teste',
        cursoId,
        turmaId,
        modalidade: 'LIVE',
        urlMeet: MEET,
        status: 'PUBLICADA',
        dataInicio: new Date(marca + 8 * 24 * 60 * 60 * 1000),
        dataFim: new Date(marca + 8 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      },
      select: { id: true },
    });
    aulaId = aula.id;
    await prisma.cursosTurmasAulasMateriais.create({
      data: { aulaId, titulo: 'Apostila', tipo: 'APOSTILA', url: MATERIAL },
    });
    await prisma.cursosTurmasInscricoes.create({
      data: {
        turmaId,
        alunoId: alunoMatriculado.id,
        status: 'INSCRITO',
        statusPagamento: 'APROVADO',
      },
    });
  });

  afterAll(async () => {
    if (turmaId) {
      await prisma.cursosTurmasInscricoes.deleteMany({ where: { turmaId } });
      await prisma.cursosTurmasAulas.deleteMany({ where: { turmaId } });
      await prisma.cursosTurmas.deleteMany({ where: { id: turmaId } });
    }
    if (cursoId) await prisma.cursos.deleteMany({ where: { id: cursoId } });
    await cleanupTestUsers(usuarios.map((u) => u.id));
  });

  const turmaUrl = () => `/api/v1/cursos/${cursoId}/turmas/${turmaId}`;
  const texto = (res: request.Response) => JSON.stringify(res.body);

  it('sem login: turma e aulas sem a sala do Meet e sem lista de alunos', async () => {
    const turma = await request(app).get(`${turmaUrl()}?includeAlunos=true`);
    expect(turma.status).toBe(200);
    expect(texto(turma)).not.toContain(MEET);
    expect(texto(turma)).not.toContain(MATERIAL);
    expect(texto(turma)).not.toContain(alunoMatriculado.email);
    expect(turma.body.alunos).toBeUndefined();

    const aulas = await request(app).get(`${turmaUrl()}/aulas`);
    expect(aulas.status).toBe(200);
    expect(aulas.body.data.length).toBeGreaterThan(0);
    expect(texto(aulas)).not.toContain(MEET);
    expect(texto(aulas)).not.toContain(MATERIAL);
  });

  it('aluno de fora da turma: também sem links; aluno matriculado: com links', async () => {
    const deFora = await request(app)
      .get(`${turmaUrl()}/aulas/${aulaId}`)
      .set('Authorization', `Bearer ${alunoDeFora.token}`);
    expect(deFora.status).toBe(200);
    expect(texto(deFora)).not.toContain(MEET);

    const matriculado = await request(app)
      .get(`${turmaUrl()}/aulas/${aulaId}`)
      .set('Authorization', `Bearer ${alunoMatriculado.token}`);
    expect(matriculado.status).toBe(200);
    expect(texto(matriculado)).toContain(MEET);
  });

  it('equipe vê tudo, inclusive a lista de alunos', async () => {
    const turma = await request(app)
      .get(`${turmaUrl()}?includeAlunos=true`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(turma.status).toBe(200);
    expect(texto(turma)).toContain(MEET);
    expect(texto(turma)).toContain(alunoMatriculado.email);
  });

  it('materiais: aluno de fora recebe 403; matriculado e equipe acessam', async () => {
    const deFora = await request(app)
      .get(`/api/v1/cursos/aulas/${aulaId}/materiais`)
      .set('Authorization', `Bearer ${alunoDeFora.token}`);
    expect(deFora.status).toBe(403);

    const matriculado = await request(app)
      .get(`/api/v1/cursos/aulas/${aulaId}/materiais`)
      .set('Authorization', `Bearer ${alunoMatriculado.token}`);
    expect(matriculado.status).toBe(200);
    expect(matriculado.body.total).toBe(1);

    const equipe = await request(app)
      .get(`/api/v1/cursos/aulas/${aulaId}/materiais`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(equipe.status).toBe(200);
  });
});
