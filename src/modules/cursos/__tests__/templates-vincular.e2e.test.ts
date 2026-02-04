import request from 'supertest';
import { prisma } from '@/config/prisma';
import { app } from '@/index';

const ADMIN_CPF = '11111111111';
const ADMIN_PASSWORD = 'AdminTeste@123';

const buildFutureDate = (daysAhead: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date;
};

describe('Cursos - Vincular templates (e2e)', () => {
  jest.setTimeout(30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('faz login e vincula templates de aula/avaliação ao curso', async () => {
    const curso = await prisma.cursos.findFirst({ select: { id: true } });
    expect(curso).toBeTruthy();
    if (!curso) return;

    const loginRes = await request(app)
      .post('/api/v1/usuarios/login')
      .send({ documento: ADMIN_CPF, senha: ADMIN_PASSWORD, rememberMe: false });

    expect(loginRes.status).toBe(200);
    const token = loginRes.body?.token as string | undefined;
    expect(token).toBeTruthy();

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
