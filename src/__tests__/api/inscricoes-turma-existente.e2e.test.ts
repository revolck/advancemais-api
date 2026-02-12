/**
 * E2E - Inscrições em turma EXISTENTE
 * Usa uma turma real do banco (ex: status INSCRICOES_ABERTAS).
 * Após o teste, remove a inscrição criada para não poluir dados.
 */
import request from 'supertest';
import { Express } from 'express';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, createTestAdmin, type TestUser } from '../helpers/auth-helper';
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

  beforeAll(async () => {
    app = await getTestApp();
    testAdmin = await createTestAdmin();
    testAluno = await createTestUser({
      role: 'ALUNO_CANDIDATO',
      emailVerificado: true,
    });
    testUsers.push(testAdmin, testAluno);

    const agora = new Date();
    const turma = await prisma.cursosTurmas.findFirst({
      where: {
        dataInscricaoFim: { gt: agora },
        dataInscricaoInicio: { lte: agora },
        status: { in: ['PUBLICADO', 'INSCRICOES_ABERTAS'] },
      },
      select: { id: true, cursoId: true, nome: true, codigo: true },
    });

    if (!turma) {
      const cursoBase = await prisma.cursos.findFirst({
        select: { id: true, nome: true },
      });

      if (!cursoBase) {
        throw new Error('Nenhum curso encontrado para criar turma de fallback do teste.');
      }

      const agoraMinus1h = new Date(Date.now() - 60 * 60 * 1000);
      const agoraPlus7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const codigo = `INS${Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, '0')}`;

      const turmaFallback = await prisma.cursosTurmas.create({
        data: {
          cursoId: cursoBase.id,
          nome: `Turma fallback teste ${Date.now()}`,
          codigo,
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
        select: { id: true, cursoId: true, nome: true, codigo: true },
      });

      turmaCriadaNoTesteId = turmaFallback.id;
      turmaId = turmaFallback.id;
      cursoId = turmaFallback.cursoId;
      console.log(
        `Turma fallback criada para teste: ${turmaFallback.nome} (${turmaFallback.codigo})`,
      );
      return;
    }

    turmaId = turma.id;
    cursoId = turma.cursoId;
    console.log(`Usando turma existente: ${turma.nome} (${turma.codigo})`);
  });

  afterAll(async () => {
    if (inscricaoId) {
      await prisma.cursosTurmasInscricoes.deleteMany({ where: { id: inscricaoId } });
    }
    if (turmaCriadaNoTesteId) {
      await prisma.cursosTurmas.deleteMany({ where: { id: turmaCriadaNoTesteId } });
    }
    await prisma.usuariosSessoes.deleteMany({
      where: { usuarioId: { in: testUsers.map((u) => u.id) } },
    });
    await prisma.usuariosVerificacaoEmail.deleteMany({
      where: { usuarioId: { in: testUsers.map((u) => u.id) } },
    });
    await prisma.usuarios.deleteMany({
      where: { id: { in: testUsers.map((u) => u.id) } },
    });
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
