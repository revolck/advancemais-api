/**
 * E2E - Inscrições em turma EXISTENTE
 * Cria curso e turma com inscrições abertas (nada de turma real do banco) e, no fim,
 * apaga tudo o que criou: inscrição, turma, curso, usuários e auditoria.
 */
import request from 'supertest';
import { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import {
  cleanupTestUsers,
  createTestUser,
  createTestAdmin,
  type TestUser,
} from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';

describe('API - Inscrições em Turma Existente (E2E)', () => {
  jest.setTimeout(30000);
  let app: Express;
  const testUsers: TestUser[] = [];
  let testAdmin: TestUser;
  let testAluno: TestUser;
  let cursoId: string | null = null;
  let turmaId: string | null = null;
  let inscricaoId: string | null = null;
  let turmaCriadaNoTesteId: string | null = null;
  let cursoCriadoNoTesteId: string | null = null;

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testAluno = await createTestUser({
      role: 'ALUNO_CANDIDATO',
      emailVerificado: true,
    });
    testUsers.push(testAdmin, testAluno);

    // Curso e turma criados aqui, já com inscrições abertas: matricular numa turma real
    // de produção mexeria nas vagas e nos registros de verdade
    const agoraMinus1h = new Date(Date.now() - 60 * 60 * 1000);
    const agoraPlus7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const marca = Date.now();
    const curso = await prisma.cursos.create({
      data: {
        nome: `Curso Teste Inscrição ${marca}`,
        codigo: `CTI${marca}`.slice(0, 12),
        descricao: 'Curso para teste de inscrição em turma existente',
        valor: 0,
        valorPromocional: 0,
        gratuito: true,
        statusPadrao: 'PUBLICADO',
        cargaHoraria: 40,
        estagioObrigatorio: false,
      },
      select: { id: true },
    });
    cursoCriadoNoTesteId = curso.id;
    const turma = await prisma.cursosTurmas.create({
      data: {
        cursoId: curso.id,
        nome: `Turma teste inscrição ${marca}`,
        codigo: `INS${marca}`.slice(0, 12),
        turno: 'MANHA',
        metodo: 'ONLINE',
        dataInscricaoInicio: agoraMinus1h,
        dataInscricaoFim: agoraPlus7d,
        dataInicio: agoraPlus7d,
        dataFim: new Date(agoraPlus7d.getTime() + 30 * 24 * 60 * 60 * 1000),
        vagasIlimitadas: true,
        vagasTotais: 9999,
        vagasDisponiveis: 9999,
        status: 'INSCRICOES_ABERTAS',
      },
      select: { id: true, cursoId: true },
    });
    turmaCriadaNoTesteId = turma.id;
    turmaId = turma.id;
    cursoId = turma.cursoId;
  });

  afterAll(async () => {
    if (inscricaoId) {
      await prisma.cursosTurmasInscricoes.deleteMany({ where: { id: inscricaoId } });
    }
    if (turmaCriadaNoTesteId) {
      await prisma.cursosTurmas.deleteMany({ where: { id: turmaCriadaNoTesteId } });
    }
    if (cursoCriadoNoTesteId) {
      await prisma.cursos.deleteMany({ where: { id: cursoCriadoNoTesteId } });
    }
    // Usuários, sessões e auditoria (inclusive o registro da matrícula)
    await cleanupTestUsers(testUsers.map((u) => u.id));
  });

  it('inscreve aluno em turma existente e valida GET inscricoes', async () => {
    if (!cursoId || !turmaId) throw new Error('Setup incompleto');

    const resEnroll = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaId}/inscricoes`)
      .set('Authorization', `Bearer ${testAdmin.token}`)
      .send({ alunoId: testAluno.id })
      .expect(201);

    expect(resEnroll.body).toBeDefined();
    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: { turmaId, alunoId: testAluno.id },
    });
    expect(inscricao).toBeTruthy();
    if (inscricao) inscricaoId = inscricao.id;

    const resList = await request(app)
      .get(`/api/v1/cursos/${cursoId}/inscricoes?turmaId=${turmaId}&page=1&pageSize=20`)
      .set('Authorization', `Bearer ${testAdmin.token}`)
      .expect(200);

    expect(resList.body).toHaveProperty('data');
    expect(Array.isArray(resList.body.data)).toBe(true);
    const item = resList.body.data.find((i: any) => i.aluno?.id === testAluno.id);
    expect(item).toBeDefined();
    expect(item).toHaveProperty('statusPagamento');
    expect(item).toHaveProperty('aluno');
    expect(item.aluno).toHaveProperty('avatarUrl');
    expect(item.aluno).toHaveProperty('cpf');
    expect(item.progresso).toBeNull();

    const resListWithProgress = await request(app)
      .get(
        `/api/v1/cursos/${cursoId}/inscricoes?turmaId=${turmaId}&page=1&pageSize=20&includeProgress=true`,
      )
      .set('Authorization', `Bearer ${testAdmin.token}`)
      .expect(200);

    const itemWithProgress = resListWithProgress.body.data.find(
      (i: any) => i.aluno?.id === testAluno.id,
    );
    expect(itemWithProgress).toBeDefined();
    expect(typeof itemWithProgress.progresso).toBe('number');
  });
});
