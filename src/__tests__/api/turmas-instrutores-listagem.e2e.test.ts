import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { Roles } from '@prisma/client';
import request from 'supertest';

import { prisma } from '@/config/prisma';

import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Turmas com instrutores vinculados na listagem', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let moderador: TestUser;
  let pedagogico: TestUser;
  let instrutorPrincipal: TestUser;
  let instrutorAuxiliar: TestUser;

  let cursoId: string;
  let turmaComInstrutoresId: string;
  let turmaComInstrutorViaRelacaoId: string;
  let turmaSemInstrutorId: string;
  let courseSearch: string;

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const buildCodigo = (prefix: string) =>
    `${prefix}${randomUUID().replace(/-/g, '').slice(0, 8)}`.toUpperCase();

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestUser({
      role: Roles.ADMIN,
      email: `admin-turmas-${suffix}@test.com`,
      nomeCompleto: `Admin Turmas ${suffix}`,
    });
    moderador = await createTestUser({
      role: Roles.MODERADOR,
      email: `moderador-turmas-${suffix}@test.com`,
      nomeCompleto: `Moderador Turmas ${suffix}`,
    });
    pedagogico = await createTestUser({
      role: Roles.PEDAGOGICO,
      email: `pedagogico-turmas-${suffix}@test.com`,
      nomeCompleto: `Pedagogico Turmas ${suffix}`,
    });
    instrutorPrincipal = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-principal-${suffix}@test.com`,
      nomeCompleto: `Instrutor Principal ${suffix}`,
    });
    instrutorAuxiliar = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-auxiliar-${suffix}@test.com`,
      nomeCompleto: `Instrutor Auxiliar ${suffix}`,
    });

    testUsers.push(admin, moderador, pedagogico, instrutorPrincipal, instrutorAuxiliar);

    courseSearch = `Curso Turmas Instrutores ${suffix}`;
    const curso = await prisma.cursos.create({
      data: {
        id: randomUUID(),
        codigo: buildCodigo('CTI'),
        nome: courseSearch,
        descricao: 'Curso para validar instrutores na listagem de turmas',
        cargaHoraria: 40,
        statusPadrao: 'PUBLICADO',
      },
    });
    cursoId = curso.id;

    const [turmaComInstrutores, turmaComInstrutorViaRelacao, turmaSemInstrutor] = await Promise.all(
      [
        prisma.cursosTurmas.create({
          data: {
            id: randomUUID(),
            cursoId,
            codigo: buildCodigo('TLI'),
            nome: `Turma Lista Instrutores ${suffix}`,
            status: 'PUBLICADO',
            instrutorId: instrutorPrincipal.id,
            vagasTotais: 30,
            vagasDisponiveis: 30,
            vagasIlimitadas: false,
          },
        }),
        prisma.cursosTurmas.create({
          data: {
            id: randomUUID(),
            cursoId,
            codigo: buildCodigo('TLR'),
            nome: `Turma Relacao Instrutor ${suffix}`,
            status: 'PUBLICADO',
            vagasTotais: 30,
            vagasDisponiveis: 30,
            vagasIlimitadas: false,
          },
        }),
        prisma.cursosTurmas.create({
          data: {
            id: randomUUID(),
            cursoId,
            codigo: buildCodigo('TLS'),
            nome: `Turma Sem Instrutor ${suffix}`,
            status: 'PUBLICADO',
            vagasTotais: 30,
            vagasDisponiveis: 30,
            vagasIlimitadas: false,
          },
        }),
      ],
    );

    turmaComInstrutoresId = turmaComInstrutores.id;
    turmaComInstrutorViaRelacaoId = turmaComInstrutorViaRelacao.id;
    turmaSemInstrutorId = turmaSemInstrutor.id;

    await prisma.cursosTurmasInstrutores.createMany({
      data: [
        {
          id: randomUUID(),
          turmaId: turmaComInstrutoresId,
          instrutorId: instrutorPrincipal.id,
        },
        {
          id: randomUUID(),
          turmaId: turmaComInstrutoresId,
          instrutorId: instrutorAuxiliar.id,
        },
        {
          id: randomUUID(),
          turmaId: turmaComInstrutorViaRelacaoId,
          instrutorId: instrutorAuxiliar.id,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.cursosTurmasInstrutores.deleteMany({
      where: {
        turmaId: {
          in: [turmaComInstrutoresId, turmaComInstrutorViaRelacaoId, turmaSemInstrutorId].filter(
            Boolean,
          ),
        },
      },
    });
    await prisma.cursosTurmas.deleteMany({
      where: {
        id: {
          in: [turmaComInstrutoresId, turmaComInstrutorViaRelacaoId, turmaSemInstrutorId].filter(
            Boolean,
          ),
        },
      },
    });
    if (cursoId) {
      await prisma.cursos.deleteMany({ where: { id: cursoId } });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  it.each([
    { role: 'ADMIN', token: () => admin.token },
    { role: 'MODERADOR', token: () => moderador.token },
    { role: 'PEDAGOGICO', token: () => pedagogico.token },
  ])('retorna instrutor e instrutores[] na listagem para %s', async ({ token }) => {
    const response = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas`)
      .set('Authorization', `Bearer ${token()}`)
      .query({ page: 1, pageSize: 20 })
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);

    const turmaComInstrutores = response.body.data.find(
      (item: any) => item.id === turmaComInstrutoresId,
    );
    const turmaComInstrutorViaRelacao = response.body.data.find(
      (item: any) => item.id === turmaComInstrutorViaRelacaoId,
    );
    const turmaSemInstrutor = response.body.data.find(
      (item: any) => item.id === turmaSemInstrutorId,
    );

    expect(turmaComInstrutores).toEqual(
      expect.objectContaining({
        id: turmaComInstrutoresId,
        instrutor: expect.objectContaining({
          id: instrutorPrincipal.id,
          nome: instrutorPrincipal.nomeCompleto,
          nomeCompleto: instrutorPrincipal.nomeCompleto,
          email: instrutorPrincipal.email,
          codUsuario: expect.any(String),
        }),
        instrutores: expect.arrayContaining([
          expect.objectContaining({
            id: instrutorPrincipal.id,
            nome: instrutorPrincipal.nomeCompleto,
            codUsuario: expect.any(String),
          }),
          expect.objectContaining({
            id: instrutorAuxiliar.id,
            nome: instrutorAuxiliar.nomeCompleto,
            codUsuario: expect.any(String),
          }),
        ]),
      }),
    );
    expect(turmaComInstrutores.instrutores).toHaveLength(2);
    expect(new Set(turmaComInstrutores.instrutores.map((item: any) => item.id)).size).toBe(2);

    expect(turmaComInstrutorViaRelacao).toEqual(
      expect.objectContaining({
        id: turmaComInstrutorViaRelacaoId,
        instrutor: expect.objectContaining({
          id: instrutorAuxiliar.id,
          nome: instrutorAuxiliar.nomeCompleto,
          codUsuario: expect.any(String),
        }),
        instrutores: [
          expect.objectContaining({
            id: instrutorAuxiliar.id,
            nome: instrutorAuxiliar.nomeCompleto,
            codUsuario: expect.any(String),
          }),
        ],
      }),
    );

    expect(turmaSemInstrutor).toEqual(
      expect.objectContaining({
        id: turmaSemInstrutorId,
        instrutor: null,
        instrutores: [],
      }),
    );
  });

  it('mantem consistencia entre listagem, detalhe e includeTurmas=true', async () => {
    const listResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ page: 1, pageSize: 20 })
      .expect(200);

    const turmaDaListagem = listResponse.body.data.find(
      (item: any) => item.id === turmaComInstrutoresId,
    );
    expect(turmaDaListagem).toBeTruthy();

    const detalheResponse = await request(app)
      .get(`/api/v1/cursos/${cursoId}/turmas/${turmaComInstrutoresId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detalheResponse.body.instrutor).toEqual(
      expect.objectContaining({
        id: turmaDaListagem.instrutor.id,
        nome: turmaDaListagem.instrutor.nome,
        codUsuario: turmaDaListagem.instrutor.codUsuario,
      }),
    );
    expect(detalheResponse.body.instrutores.map((item: any) => item.id)).toEqual(
      turmaDaListagem.instrutores.map((item: any) => item.id),
    );

    const cursosResponse = await request(app)
      .get('/api/v1/cursos')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        search: courseSearch,
        includeTurmas: true,
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    const curso = cursosResponse.body.data.find((item: any) => item.id === cursoId);
    expect(curso).toBeTruthy();

    const turmaEmbutida = (curso.turmas ?? []).find(
      (item: any) => item.id === turmaComInstrutoresId,
    );
    expect(turmaEmbutida).toEqual(
      expect.objectContaining({
        instrutor: expect.objectContaining({
          id: instrutorPrincipal.id,
          nome: instrutorPrincipal.nomeCompleto,
          codUsuario: expect.any(String),
        }),
      }),
    );
    expect(turmaEmbutida.instrutores.map((item: any) => item.id)).toEqual(
      turmaDaListagem.instrutores.map((item: any) => item.id),
    );
  });
});
