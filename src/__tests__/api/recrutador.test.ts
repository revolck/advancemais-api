import request from 'supertest';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { getTestApp } from '../helpers/test-setup';
import { createTestUser, cleanupTestUsers, type TestUser } from '../helpers/auth-helper';
import { prisma } from '@/config/prisma';
import {
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Roles,
  StatusDeVagas,
  TiposDeUsuarios,
  type StatusProcessosCandidatos,
} from '@prisma/client';

jest.mock('@/modules/cursos/aulas/services/google-calendar.service', () => ({
  googleCalendarService: {
    createMeetEvent: jest.fn(async () => ({
      eventId: 'evt_test_123',
      meetUrl: 'https://meet.google.com/test-meet',
    })),
  },
}));

jest.setTimeout(30000);

const createUniqueCode = () => randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

async function createVaga(params: {
  empresaUsuarioId: string;
  status: StatusDeVagas;
  titulo?: string;
}) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await prisma.empresasVagas.create({
        data: {
          codigo: createUniqueCode(),
          slug: `vaga-${randomUUID()}`,
          usuarioId: params.empresaUsuarioId,
          regimeDeTrabalho: RegimesDeTrabalhos.CLT,
          modalidade: ModalidadesDeVagas.REMOTO,
          titulo: params.titulo ?? 'Vaga Teste',
          requisitos: { obrigatorios: [], desejaveis: [] },
          atividades: { principais: [], extras: [] },
          beneficios: { lista: [], observacoes: null },
          status: params.status,
        },
        select: { id: true, titulo: true, status: true, usuarioId: true },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') continue;
      throw error;
    }
  }
  throw new Error('Falha ao criar vaga de teste (código duplicado)');
}

describe('API - Recrutador (escopo por empresas vinculadas)', () => {
  let app: Express;
  const testUsers: TestUser[] = [];

  const createdVagas: string[] = [];
  const createdCandidaturas: string[] = [];
  const createdVinculos: string[] = [];
  const createdVagaVinculos: string[] = [];
  const createdEntrevistas: string[] = [];

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (createdEntrevistas.length > 0) {
      await prisma.empresasVagasEntrevistas.deleteMany({
        where: { id: { in: createdEntrevistas } },
      });
    }
    if (createdCandidaturas.length > 0) {
      await prisma.empresasCandidatos.deleteMany({ where: { id: { in: createdCandidaturas } } });
    }
    if (createdVagas.length > 0) {
      await prisma.empresasVagas.deleteMany({ where: { id: { in: createdVagas } } });
    }
    if (createdVinculos.length > 0) {
      await prisma.usuariosEmpresasVinculos.deleteMany({ where: { id: { in: createdVinculos } } });
    }
    if (createdVagaVinculos.length > 0) {
      await prisma.usuariosVagasVinculos.deleteMany({ where: { id: { in: createdVagaVinculos } } });
    }
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((u) => u.id));
    }
  });

  it('lista empresas vinculadas e vagas (sem RASCUNHO)', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `1${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    testUsers.push(recruiter, empresa);

    const vinculo = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresa.id },
      select: { id: true },
    });
    createdVinculos.push(vinculo.id);

    const vagaPublicada = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Publicada',
    });
    createdVagas.push(vagaPublicada.id);

    const vagaRascunho = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.RASCUNHO,
      titulo: 'Vaga Rascunho',
    });
    createdVagas.push(vagaRascunho.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vagaPublicada.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const empresasResp = await request(app)
      .get('/api/v1/recrutador/empresas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(empresasResp.body).toHaveProperty('success', true);
    expect(empresasResp.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: empresa.id })]),
    );

    const vagasResp = await request(app)
      .get('/api/v1/recrutador/vagas')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(Array.isArray(vagasResp.body)).toBe(true);
    const ids = vagasResp.body.map((v: any) => v.id);
    expect(ids).toContain(vagaPublicada.id);
    expect(ids).not.toContain(vagaRascunho.id);
  });

  it('nega consulta quando status inclui RASCUNHO', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    testUsers.push(recruiter);

    const response = await request(app)
      .get('/api/v1/recrutador/vagas?status=RASCUNHO')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
  });

  it('agenda entrevista e retorna meetUrl', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `2${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const candidato = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(recruiter, empresa, candidato);

    const vinculo = await prisma.usuariosEmpresasVinculos.create({
      data: { recrutadorId: recruiter.id, empresaUsuarioId: empresa.id },
      select: { id: true },
    });
    createdVinculos.push(vinculo.id);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      status: StatusDeVagas.PUBLICADO,
      titulo: 'Vaga Entrevista',
    });
    createdVagas.push(vaga.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: { recrutadorId: recruiter.id, vagaId: vaga.id },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const status = (await prisma.statusProcessosCandidatos.findFirst({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    })) as StatusProcessosCandidatos | null;

    expect(status).not.toBeNull();

    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId: status!.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(now.getTime() + 90 * 60 * 1000);

    const resp = await request(app)
      .post(`/api/v1/recrutador/vagas/${vaga.id}/candidatos/${candidato.id}/entrevistas`)
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({
        dataInicio: start.toISOString(),
        dataFim: end.toISOString(),
      })
      .expect(201);

    expect(resp.body).toHaveProperty('success', true);
    expect(resp.body.entrevista).toHaveProperty('meetUrl', 'https://meet.google.com/test-meet');
    expect(resp.body.entrevista).toHaveProperty('meetEventId', 'evt_test_123');

    createdEntrevistas.push(resp.body.entrevista.id);
  });
});
