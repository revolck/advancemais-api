import type { Express } from 'express';
import { Roles, Status, TiposDeUsuarios } from '@prisma/client';
import request from 'supertest';
import { randomUUID } from 'crypto';

import { prisma } from '@/config/prisma';

import {
  cleanupTestUsers,
  createTestAdmin,
  createTestUser,
  type TestUser,
} from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

describe('API - Agenda aniversariantes por roles internas', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  let admin: TestUser;
  let instrutorAtivo: TestUser;
  let setorVagasAtivo: TestUser;
  let instrutorInativo: TestUser;
  let aluno: TestUser;
  let empresa: TestUser;

  beforeAll(async () => {
    app = await getTestApp();

    admin = await createTestAdmin();
    instrutorAtivo = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-ativo-agenda-${randomUUID()}@test.com`,
      nomeCompleto: 'Instrutor Ativo Agenda',
    });
    setorVagasAtivo = await createTestUser({
      role: Roles.SETOR_DE_VAGAS,
      email: `setor-vagas-agenda-${randomUUID()}@test.com`,
      nomeCompleto: 'Setor Vagas Agenda',
    });
    instrutorInativo = await createTestUser({
      role: Roles.INSTRUTOR,
      email: `instrutor-inativo-agenda-${randomUUID()}@test.com`,
      nomeCompleto: 'Instrutor Inativo Agenda',
    });
    aluno = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      email: `aluno-agenda-${randomUUID()}@test.com`,
      nomeCompleto: 'Aluno Agenda',
    });
    empresa = await createTestUser({
      role: Roles.EMPRESA,
      email: `empresa-agenda-${randomUUID()}@test.com`,
      nomeCompleto: 'Empresa Agenda',
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
    });

    testUsers.push(admin, instrutorAtivo, setorVagasAtivo, instrutorInativo, aluno, empresa);

    await Promise.all([
      prisma.usuarios.update({
        where: { id: instrutorInativo.id },
        data: { status: Status.INATIVO },
      }),
      prisma.usuariosInformation.update({
        where: { usuarioId: instrutorAtivo.id },
        data: {
          dataNasc: new Date('1990-03-10T00:00:00.000Z'),
          avatarUrl: 'https://cdn.test/avatar-instrutor-ativo.png',
        },
      }),
      prisma.usuariosInformation.update({
        where: { usuarioId: setorVagasAtivo.id },
        data: {
          dataNasc: new Date('1988-03-15T00:00:00.000Z'),
          avatarUrl: 'https://cdn.test/avatar-setor-vagas.png',
        },
      }),
      prisma.usuariosInformation.update({
        where: { usuarioId: instrutorInativo.id },
        data: { dataNasc: new Date('1986-03-11T00:00:00.000Z') },
      }),
      prisma.usuariosInformation.update({
        where: { usuarioId: aluno.id },
        data: { dataNasc: new Date('1995-03-12T00:00:00.000Z') },
      }),
      prisma.usuariosInformation.update({
        where: { usuarioId: empresa.id },
        data: { dataNasc: new Date('1992-03-13T00:00:00.000Z') },
      }),
    ]);
  });

  afterAll(async () => {
    await cleanupTestUsers(testUsers.map((user) => user.id));
  });

  it('deve listar apenas aniversariantes internos ativos no intervalo', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/agenda/aniversariantes')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const eventos = response.body.data.eventos as {
      tipo: string;
      titulo: string;
      descricao: string;
      data: string;
      cor: string;
      usuario: { nome: string; role: string; avatarUrl: string | null };
    }[];

    const nomes = eventos.map((item) => item.usuario.nome);

    expect(nomes).toContain('Instrutor Ativo Agenda');
    expect(nomes).toContain('Setor Vagas Agenda');
    expect(nomes).not.toContain('Instrutor Inativo Agenda');
    expect(nomes).not.toContain('Aluno Agenda');
    expect(nomes).not.toContain('Empresa Agenda');

    expect(eventos.every((item) => item.tipo === 'ANIVERSARIO')).toBe(true);
    expect(eventos.every((item) => item.cor === '#10B981')).toBe(true);
    expect(eventos[0]?.data <= eventos[1]?.data).toBe(true);

    const eventoInstrutorAtivo = eventos.find(
      (item) => item.usuario.nome === 'Instrutor Ativo Agenda',
    );
    expect(eventoInstrutorAtivo?.titulo).toBe('Aniversário - Instrutor Ativo Agenda');
    expect(eventoInstrutorAtivo?.descricao).toBe(Roles.INSTRUTOR);
    expect(eventoInstrutorAtivo?.usuario.avatarUrl).toBe(
      'https://cdn.test/avatar-instrutor-ativo.png',
    );

    expect(response.body.data.resumo.total).toBe(eventos.length);
  });

  it('deve permitir incluir inativos e respeitar roles sobrescritas', async () => {
    const response = await request(app)
      .get('/api/v1/cursos/agenda/aniversariantes')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
        roles: 'INSTRUTOR,ALUNO_CANDIDATO',
        incluirInativos: 'true',
      })
      .expect(200);

    const eventos = response.body.data.eventos as { usuario: { nome: string; role: string } }[];
    const nomes = eventos.map((item) => item.usuario.nome);
    const roles = eventos.map((item) => item.usuario.role);

    expect(nomes).toContain('Instrutor Ativo Agenda');
    expect(nomes).toContain('Instrutor Inativo Agenda');
    expect(nomes).not.toContain('Aluno Agenda');
    expect(roles.every((role) => role === Roles.INSTRUTOR)).toBe(true);
  });

  it('deve negar acesso para perfil sem permissão', async () => {
    await request(app)
      .get('/api/v1/cursos/agenda/aniversariantes')
      .set('Authorization', `Bearer ${instrutorAtivo.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
      })
      .expect(403);
  });
});
