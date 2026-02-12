import request from 'supertest';
import type { Express } from 'express';
import {
  CursosAvaliacaoTipo,
  CursosAtividadeTipo,
  CursosAulaStatus,
  CursosMetodos,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { invalidateCursosAvaliacoesGetResponseCache } from '@/modules/cursos/middlewares/avaliacoes-response-cache';
import { getTestApp } from '../helpers/test-setup';
import { cleanupTestUsers, createTestAdmin, type TestUser } from '../helpers/auth-helper';

jest.setTimeout(45000);

describe('API - Avaliações (Performance e Cache)', () => {
  let app: Express;
  let admin: TestUser;
  let cursoId: string;
  const avaliacaoIds: string[] = [];
  const turmaIds: string[] = [];
  const testUsers: TestUser[] = [];

  const buildFutureDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    app = await getTestApp();
    admin = await createTestAdmin();
    testUsers.push(admin);

    const suffix = Date.now().toString().slice(-6);
    const curso = await prisma.cursos.create({
      data: {
        codigo: `CRSAV${suffix}`,
        nome: `Curso Avaliações Cache ${suffix}`,
        descricao: 'Curso para teste de cache em avaliações',
        cargaHoraria: 20,
        statusPadrao: 'PUBLICADO',
        valor: 0,
        gratuito: true,
        estagioObrigatorio: false,
      },
      select: { id: true },
    });
    cursoId = curso.id;
  });

  beforeEach(async () => {
    await invalidateCursosAvaliacoesGetResponseCache();
  });

  afterAll(async () => {
    if (avaliacaoIds.length > 0) {
      await prisma.cursosTurmasProvas.deleteMany({
        where: { id: { in: avaliacaoIds } },
      });
    }

    if (turmaIds.length > 0) {
      await prisma.cursosTurmas.deleteMany({
        where: { id: { in: turmaIds } },
      });
    }

    if (cursoId) {
      await prisma.cursos
        .delete({
          where: { id: cursoId },
        })
        .catch(() => {});
    }

    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  it('deve retornar MISS e depois HIT na listagem global de avaliações', async () => {
    const url = `/api/v1/cursos/avaliacoes?cursoId=${cursoId}&page=1&pageSize=10`;

    const first = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(first.body.success).toBe(true);

    const second = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(second.headers['x-cache']).toBe('HIT');
  });

  it('deve invalidar cache do GET /avaliacoes/:id após PUT', async () => {
    const baseDate = buildFutureDate(7);
    const avaliacao = await prisma.cursosTurmasProvas.create({
      data: {
        cursoId,
        turmaId: null,
        tipo: CursosAvaliacaoTipo.ATIVIDADE,
        tipoAtividade: CursosAtividadeTipo.PERGUNTA_RESPOSTA,
        titulo: 'Atividade Cache Detalhe',
        etiqueta: `CACHE-DET-${Date.now().toString().slice(-5)}`,
        descricao: 'Descrição inicial',
        peso: 0,
        valePonto: false,
        ativo: true,
        status: CursosAulaStatus.RASCUNHO,
        modalidade: CursosMetodos.ONLINE,
        obrigatoria: true,
        dataInicio: new Date(baseDate),
        dataFim: new Date(baseDate),
        horaInicio: '10:00',
        horaTermino: '11:00',
        ordem: 1,
      },
      select: { id: true },
    });
    avaliacaoIds.push(avaliacao.id);

    const detalheUrl = `/api/v1/cursos/avaliacoes/${avaliacao.id}`;

    const firstGet = await request(app)
      .get(detalheUrl)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(firstGet.headers['x-cache']).toBe('MISS');

    const secondGet = await request(app)
      .get(detalheUrl)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(secondGet.headers['x-cache']).toBe('HIT');

    await request(app)
      .put(detalheUrl)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        tipo: CursosAvaliacaoTipo.ATIVIDADE,
        tipoAtividade: CursosAtividadeTipo.PERGUNTA_RESPOSTA,
        titulo: 'Atividade Cache Detalhe Atualizada',
        descricao: 'Descrição atualizada para invalidar cache',
        modalidade: CursosMetodos.ONLINE,
        obrigatoria: true,
        valePonto: false,
        dataInicio: baseDate,
        dataFim: baseDate,
        horaInicio: '10:30',
        horaTermino: '11:30',
      })
      .expect(200);

    const afterPut = await request(app)
      .get(detalheUrl)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(afterPut.headers['x-cache']).toBe('MISS');
  });

  it('deve invalidar cache da listagem após POST /avaliacoes', async () => {
    const url = `/api/v1/cursos/avaliacoes?cursoId=${cursoId}&page=1&pageSize=10`;
    const baseDate = buildFutureDate(10);

    const first = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(first.headers['x-cache']).toBe('MISS');

    const second = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(second.headers['x-cache']).toBe('HIT');

    const createResponse = await request(app)
      .post('/api/v1/cursos/avaliacoes')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        cursoId,
        tipo: CursosAvaliacaoTipo.ATIVIDADE,
        tipoAtividade: CursosAtividadeTipo.PERGUNTA_RESPOSTA,
        titulo: 'Atividade para invalidar list cache',
        descricao: 'Explique com suas palavras o conteúdo da aula.',
        modalidade: CursosMetodos.ONLINE,
        obrigatoria: true,
        valePonto: false,
        dataInicio: baseDate,
        dataFim: baseDate,
        horaInicio: '15:00',
        horaTermino: '16:00',
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.avaliacao?.id).toBeDefined();
    avaliacaoIds.push(createResponse.body.avaliacao.id);

    const afterPost = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(afterPost.headers['x-cache']).toBe('MISS');
  });
});
