import request from 'supertest';
import { Express } from 'express';
import { randomUUID } from 'crypto';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getTestApp } from '../helpers/test-setup';
import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';

describe('API - Turmas: vínculo de instrutores e gestão operacional', () => {
  jest.setTimeout(40000);

  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let pedagogico: TestUser;
  let instrutorA: TestUser;
  let instrutorB: TestUser;
  let instrutorC: TestUser;

  let cursoId: string;
  let templateAulaId: string;
  let templateProvaId: string;
  let turmaCriadaId: string;
  let turmaEmAndamentoId: string;
  let moduloOperacionalId: string;
  let itemStandaloneFuturoId: string;

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestAdmin();
    pedagogico = await createTestUser({
      role: Roles.PEDAGOGICO,
      email: `pedagogico-turmas-${Date.now()}@test.com`,
      nomeCompleto: 'Pedagógico Operacional',
    });
    instrutorA = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-a-${Date.now()}@test.com`,
      nomeCompleto: 'Instrutor A',
    });
    instrutorB = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-b-${Date.now()}@test.com`,
      nomeCompleto: 'Instrutor B',
    });
    instrutorC = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-c-${Date.now()}@test.com`,
      nomeCompleto: 'Instrutor C',
    });

    testUsers.push(admin, pedagogico, instrutorA, instrutorB, instrutorC);

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const curso = await prisma.cursos.create({
      data: {
        id: randomUUID(),
        nome: `Curso Gestão Operacional ${now}`,
        codigo: `CGO${String(now).slice(-6)}`,
        descricao: 'Curso para validar vínculo de instrutores e append operacional',
        cargaHoraria: 60,
        statusPadrao: 'PUBLICADO',
      },
    });
    cursoId = curso.id;

    templateAulaId = randomUUID();
    templateProvaId = randomUUID();

    await prisma.cursosTurmasAulas.create({
      data: {
        id: templateAulaId,
        codigo: `ATM${String(now).slice(-6)}`,
        cursoId,
        turmaId: null,
        nome: 'Template Aula Base',
        descricao: 'Template para criação da turma',
        modalidade: 'ONLINE',
        duracaoMinutos: 120,
        obrigatoria: true,
        status: 'PUBLICADA',
      },
    });

    await prisma.cursosTurmasProvas.create({
      data: {
        id: templateProvaId,
        cursoId,
        turmaId: null,
        tipo: 'PROVA',
        titulo: 'Template Prova Base',
        etiqueta: `TP${String(now).slice(-5)}`,
        descricao: 'Template para criação da turma',
        peso: 5,
        valePonto: true,
        ativo: true,
        status: 'PUBLICADA',
        modalidade: 'ONLINE',
        obrigatoria: true,
      },
    });

    turmaEmAndamentoId = randomUUID();
    await prisma.cursosTurmas.create({
      data: {
        id: turmaEmAndamentoId,
        codigo: `TEA${String(now).slice(-6)}`,
        cursoId,
        nome: 'Turma em andamento operacional',
        estruturaTipo: 'DINAMICA',
        turno: 'NOITE',
        metodo: 'ONLINE',
        status: 'EM_ANDAMENTO',
        instrutorId: instrutorA.id,
        vagasTotais: 30,
        vagasDisponiveis: 28,
        vagasIlimitadas: false,
        dataInscricaoInicio: new Date(now - 10 * day),
        dataInscricaoFim: new Date(now - 2 * day),
        dataInicio: new Date(now - 3 * day),
        dataFim: new Date(now + 20 * day),
      },
    });

    await prisma.cursosTurmasInstrutores.create({
      data: {
        turmaId: turmaEmAndamentoId,
        instrutorId: instrutorA.id,
      },
    });

    moduloOperacionalId = randomUUID();
    await prisma.cursosTurmasModulos.create({
      data: {
        id: moduloOperacionalId,
        turmaId: turmaEmAndamentoId,
        nome: 'Módulo Operacional',
        obrigatorio: true,
        ordem: 1,
      },
    });

    itemStandaloneFuturoId = randomUUID();
    await prisma.cursosTurmasAulas.createMany({
      data: [
        {
          id: itemStandaloneFuturoId,
          codigo: `ASF${String(now).slice(-6)}`,
          cursoId,
          turmaId: turmaEmAndamentoId,
          nome: 'Aula futura base',
          descricao: 'Item futuro para teste de posição',
          modalidade: 'ONLINE',
          duracaoMinutos: 60,
          obrigatoria: true,
          ordem: 1,
          status: 'PUBLICADA',
          instrutorId: instrutorA.id,
          dataInicio: new Date(now + 4 * day),
          dataFim: new Date(now + 4 * day),
        },
        {
          id: randomUUID(),
          codigo: `ASP${String(now).slice(-6)}`,
          cursoId,
          turmaId: turmaEmAndamentoId,
          nome: 'Aula passada consolidada',
          descricao: 'Item passado para bloquear inserção no meio',
          modalidade: 'ONLINE',
          duracaoMinutos: 60,
          obrigatoria: true,
          ordem: 2,
          status: 'PUBLICADA',
          instrutorId: instrutorA.id,
          dataInicio: new Date(now - 2 * day),
          dataFim: new Date(now - 2 * day),
        },
        {
          id: randomUUID(),
          codigo: `AMO${String(now).slice(-6)}`,
          cursoId,
          turmaId: turmaEmAndamentoId,
          moduloId: moduloOperacionalId,
          nome: 'Aula do módulo',
          descricao: 'Conteúdo inicial do módulo',
          modalidade: 'ONLINE',
          duracaoMinutos: 60,
          obrigatoria: true,
          ordem: 1,
          status: 'PUBLICADA',
          instrutorId: instrutorA.id,
          dataInicio: new Date(now + 1 * day),
          dataFim: new Date(now + 1 * day),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.cursosAulasHistorico.deleteMany({
      where: {
        turmaId: {
          in: [turmaCriadaId, turmaEmAndamentoId].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasAulas.deleteMany({
      where: {
        turmaId: {
          in: [turmaCriadaId, turmaEmAndamentoId].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: {
        turmaId: {
          in: [turmaCriadaId, turmaEmAndamentoId].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasModulos.deleteMany({
      where: {
        turmaId: {
          in: [turmaCriadaId, turmaEmAndamentoId].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasInstrutores.deleteMany({
      where: {
        turmaId: {
          in: [turmaCriadaId, turmaEmAndamentoId].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmas.deleteMany({
      where: {
        id: {
          in: [turmaCriadaId, turmaEmAndamentoId].filter(Boolean),
        },
      },
    });
    await prisma.cursosTurmasAulas.deleteMany({
      where: {
        id: { in: [templateAulaId].filter(Boolean) },
      },
    });
    await prisma.cursosTurmasProvas.deleteMany({
      where: {
        id: { in: [templateProvaId].filter(Boolean) },
      },
    });
    if (cursoId) {
      await prisma.cursos.deleteMany({ where: { id: cursoId } });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  it('aceita instrutorIds na criação da turma e retorna instrutor/instrutores normalizados', async () => {
    const now = Date.now();
    const res = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        nome: `Turma criada com instrutores ${now}`,
        turno: 'NOITE',
        metodo: 'ONLINE',
        dataInscricaoInicio: '2026-04-10',
        dataInscricaoFim: '2026-04-20',
        dataInicio: '2026-04-25',
        dataFim: '2026-06-25',
        vagasTotais: 30,
        vagasIlimitadas: false,
        status: 'RASCUNHO',
        estruturaTipo: 'DINAMICA',
        instrutorIds: [instrutorA.id, instrutorB.id, instrutorA.id],
        estrutura: {
          modules: [],
          standaloneItems: [
            {
              type: 'AULA',
              title: 'Aula base clonada',
              templateId: templateAulaId,
              startDate: '2026-04-26T00:00:00.000Z',
              endDate: '2026-04-26T00:00:00.000Z',
              instructorIds: [instrutorA.id],
            },
            {
              type: 'PROVA',
              title: 'Prova base clonada',
              templateId: templateProvaId,
              startDate: '2026-05-20T00:00:00.000Z',
              endDate: '2026-05-20T00:00:00.000Z',
              instructorIds: [instrutorB.id],
            },
          ],
        },
      })
      .expect(201);

    turmaCriadaId = res.body.id;

    expect(res.body.instrutor).toEqual(
      expect.objectContaining({
        id: instrutorA.id,
      }),
    );
    expect(res.body.instrutores.map((item: any) => item.id)).toEqual([
      instrutorA.id,
      instrutorB.id,
    ]);
  });

  it('bloqueia ADMIN de sincronizar instrutores em turma já iniciada', async () => {
    const res = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaEmAndamentoId}/instrutores`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        instrutorIds: [instrutorB.id, instrutorC.id],
      })
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('PEDAGOGICO sincroniza instrutores da turma em andamento sem reescrever dono explícito dos itens', async () => {
    const res = await request(app)
      .put(`/api/v1/cursos/${cursoId}/turmas/${turmaEmAndamentoId}/instrutores`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        instrutorIds: [instrutorB.id, instrutorC.id],
      })
      .expect(200);

    expect(res.body.instrutor).toEqual(expect.objectContaining({ id: instrutorB.id }));
    expect(res.body.instrutores.map((item: any) => item.id)).toEqual([
      instrutorB.id,
      instrutorC.id,
    ]);

    const aulaExistente = (res.body.estrutura?.standaloneItems ?? []).find(
      (item: any) => item.id === itemStandaloneFuturoId,
    );
    expect(aulaExistente).toEqual(expect.objectContaining({ instrutorId: instrutorA.id }));
  });

  it('PEDAGOGICO adiciona nova aula avulsa em turma EM_ANDAMENTO', async () => {
    const futureDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    const isoDate = futureDate.toISOString().slice(0, 10);

    const res = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaEmAndamentoId}/estrutura/itens`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        type: 'AULA',
        placement: {
          moduleId: null,
          afterItemId: null,
        },
        item: {
          titulo: 'Aula extra de revisão',
          descricao: 'Conteúdo complementar',
          modalidade: 'ONLINE',
          status: 'PUBLICADA',
          dataInicio: isoDate,
          horaInicio: '19:00',
          horaFim: '21:00',
          obrigatoria: true,
          instrutorIds: [instrutorB.id],
          duracaoMinutos: 120,
        },
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.item).toEqual(
      expect.objectContaining({
        type: 'AULA',
        title: 'Aula extra de revisão',
        instrutorId: instrutorB.id,
        instructorIds: [instrutorB.id],
        status: 'PUBLICADA',
      }),
    );

    const aulaCriada = await prisma.cursosTurmasAulas.findUnique({
      where: { id: res.body.data.item.id },
      select: {
        turmaId: true,
        moduloId: true,
        instrutorId: true,
        ordem: true,
        adicionadaAposCriacao: true,
        status: true,
      },
    });

    expect(aulaCriada).toEqual(
      expect.objectContaining({
        turmaId: turmaEmAndamentoId,
        moduloId: null,
        instrutorId: instrutorB.id,
        adicionadaAposCriacao: true,
        status: 'PUBLICADA',
      }),
    );
    expect(aulaCriada?.ordem).toBeGreaterThanOrEqual(3);
  });

  it('PEDAGOGICO adiciona nova prova em módulo de turma EM_ANDAMENTO', async () => {
    const futureDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const isoDate = futureDate.toISOString().slice(0, 10);

    const res = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaEmAndamentoId}/estrutura/itens`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        type: 'PROVA',
        placement: {
          moduleId: moduloOperacionalId,
          afterItemId: null,
        },
        item: {
          titulo: 'Prova complementar',
          descricao: 'Avaliação complementar',
          status: 'PUBLICADA',
          dataInicio: isoDate,
          horaInicio: '18:00',
          horaTermino: '20:00',
          obrigatoria: true,
          instrutorIds: [instrutorC.id],
          valePonto: true,
          peso: 2,
        },
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.item).toEqual(
      expect.objectContaining({
        type: 'PROVA',
        title: 'Prova complementar',
        instrutorId: instrutorC.id,
        instructorIds: [instrutorC.id],
        status: 'PUBLICADA',
      }),
    );

    const provaCriada = await prisma.cursosTurmasProvas.findUnique({
      where: { id: res.body.data.item.id },
      select: {
        turmaId: true,
        moduloId: true,
        instrutorId: true,
        localizacao: true,
        status: true,
      },
    });

    expect(provaCriada).toEqual(
      expect.objectContaining({
        turmaId: turmaEmAndamentoId,
        moduloId: moduloOperacionalId,
        instrutorId: instrutorC.id,
        localizacao: 'MODULO',
        status: 'PUBLICADA',
      }),
    );
  });

  it('bloqueia inserção no meio da estrutura quando isso empurra conteúdo já realizado', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const isoDate = futureDate.toISOString().slice(0, 10);

    const res = await request(app)
      .post(`/api/v1/cursos/${cursoId}/turmas/${turmaEmAndamentoId}/estrutura/itens`)
      .set('Authorization', `Bearer ${pedagogico.token}`)
      .send({
        type: 'AULA',
        placement: {
          moduleId: null,
          afterItemId: itemStandaloneFuturoId,
        },
        item: {
          titulo: 'Aula que tenta entrar no meio',
          descricao: 'Deve falhar por conteúdo passado logo depois',
          modalidade: 'ONLINE',
          status: 'PUBLICADA',
          dataInicio: isoDate,
          horaInicio: '20:00',
          horaFim: '21:00',
          instrutorIds: [instrutorB.id],
        },
      })
      .expect(409);

    expect(res.body.code).toBe('TURMA_OPERACAO_NAO_PERMITIDA');
  });
});
