import request from 'supertest';
import { prisma } from '@/config/prisma';
import { app } from '@/index';
import {
  cleanupTestUsers,
  createTestAdmin,
  type TestUser,
} from '../../../__tests__/helpers/auth-helper';

const buildFutureDate = (daysAhead: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date;
};

/**
 * Admin e curso criados aqui (nada de curso real nem da conta de admin semeada);
 * no fim apaga os modelos, o curso, o admin e a auditoria.
 */
describe('Cursos - Vincular templates (e2e)', () => {
  jest.setTimeout(30000);
  let admin: TestUser;
  let cursoId: string | null = null;
  const aulaIds: string[] = [];
  const avaliacaoIds: string[] = [];

  beforeAll(async () => {
    admin = await createTestAdmin();
    const marca = Date.now();
    const curso = await prisma.cursos.create({
      data: {
        nome: `Curso Teste Templates ${marca}`,
        codigo: `CTT${marca}`.slice(0, 12),
        descricao: 'Curso para teste de vínculo de templates',
        valor: 0,
        valorPromocional: 0,
        gratuito: true,
        statusPadrao: 'RASCUNHO',
        cargaHoraria: 40,
        estagioObrigatorio: false,
      },
      select: { id: true },
    });
    cursoId = curso.id;
  });

  afterAll(async () => {
    if (aulaIds.length) {
      await prisma.cursosTurmasAulas.deleteMany({ where: { id: { in: aulaIds } } });
    }
    if (avaliacaoIds.length) {
      await prisma.cursosTurmasProvas.deleteMany({ where: { id: { in: avaliacaoIds } } });
    }
    if (cursoId) await prisma.cursos.deleteMany({ where: { id: cursoId } });
    if (admin) await cleanupTestUsers([admin.id]);
    await prisma.$disconnect();
  });

  it('vincula templates de aula/avaliação ao curso', async () => {
    const curso = cursoId ? { id: cursoId } : null;
    expect(curso).toBeTruthy();
    if (!curso) return;
    const token = admin.token;

    const aulaRes = await request(app)
      .post('/api/v1/cursos/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: `Template Aula E2E ${Date.now()}`,
        descricao: 'Aula template criada para teste e2e',
        modalidade: 'ONLINE',
        obrigatoria: true,
        duracaoMinutos: 60,
      });

    expect(aulaRes.status).toBe(201);
    const aulaId = aulaRes.body?.aula?.id as string | undefined;
    expect(aulaId).toBeTruthy();
    if (aulaId) aulaIds.push(aulaId);

    const dataInicio = buildFutureDate(2);
    const dataFim = buildFutureDate(3);

    const avaliacaoRes = await request(app)
      .post('/api/v1/cursos/avaliacoes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo: 'ATIVIDADE',
        tipoAtividade: 'PERGUNTA_RESPOSTA',
        titulo: `Atividade E2E ${Date.now()}`,
        descricao: 'Pergunta da atividade e2e',
        modalidade: 'ONLINE',
        obrigatoria: true,
        valePonto: false,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        horaInicio: '08:00',
        horaTermino: '09:00',
      });

    expect(avaliacaoRes.status).toBe(201);
    const avaliacaoId = avaliacaoRes.body?.avaliacao?.id as string | undefined;
    expect(avaliacaoId).toBeTruthy();
    if (avaliacaoId) avaliacaoIds.push(avaliacaoId);

    const vinculoRes = await request(app)
      .post('/api/v1/cursos/templates/vincular')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cursoId: curso.id,
        aulaTemplateIds: [aulaId],
        avaliacaoTemplateIds: [avaliacaoId],
      });

    expect(vinculoRes.status).toBe(200);
    expect(vinculoRes.body?.success).toBe(true);
    expect(vinculoRes.body?.data?.updatedAulas).toBeGreaterThanOrEqual(1);
    expect(vinculoRes.body?.data?.updatedAvaliacoes).toBeGreaterThanOrEqual(1);

    const aulaDb = await prisma.cursosTurmasAulas.findUnique({
      where: { id: aulaId },
      select: { cursoId: true, turmaId: true },
    });
    expect(aulaDb?.cursoId).toBe(curso.id);
    expect(aulaDb?.turmaId).toBeNull();

    const avaliacaoDb = await prisma.cursosTurmasProvas.findUnique({
      where: { id: avaliacaoId },
      select: { cursoId: true, turmaId: true },
    });
    expect(avaliacaoDb?.cursoId).toBe(curso.id);
    expect(avaliacaoDb?.turmaId).toBeNull();
  });
});
