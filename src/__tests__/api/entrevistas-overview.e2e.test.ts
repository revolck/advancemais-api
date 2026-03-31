import request from 'supertest';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import {
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Roles,
  StatusDeVagas,
  TiposDeUsuarios,
  type StatusProcessosCandidatos,
} from '@prisma/client';

import { prisma } from '@/config/prisma';

import { getTestApp } from '../helpers/test-setup';
import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';

const createUniqueCode = () => randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

jest.setTimeout(60000);

const connectGoogleForUser = async (userId: string) => {
  await prisma.usuarios.update({
    where: { id: userId },
    data: {
      googleAccessToken: 'test-access-token',
      googleRefreshToken: 'test-refresh-token',
      googleCalendarId: 'primary',
      googleTokenExpiraEm: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
};

async function createVaga(params: {
  empresaUsuarioId: string;
  status?: StatusDeVagas;
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
          status: params.status ?? StatusDeVagas.PUBLICADO,
        },
        select: { id: true, codigo: true, titulo: true, usuarioId: true, status: true },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') continue;
      throw error;
    }
  }

  throw new Error('Falha ao criar vaga de teste');
}

describe('API - Entrevistas Overview', () => {
  let app: Express;
  let statusProcesso: StatusProcessosCandidatos;

  const testUsers: TestUser[] = [];
  const createdVagas: string[] = [];
  const createdCandidaturas: string[] = [];
  const createdEntrevistas: string[] = [];
  const createdEmpresasVinculos: string[] = [];
  const createdVagaVinculos: string[] = [];
  const createdEnderecos: string[] = [];

  beforeAll(async () => {
    app = await getTestApp();

    const existingStatus = await prisma.statusProcessosCandidatos.findFirst({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });

    if (!existingStatus) {
      throw new Error('Nenhum status de processo de candidatos ativo encontrado para o teste');
    }

    statusProcesso = existingStatus;
  });

  afterAll(async () => {
    if (createdEntrevistas.length > 0) {
      await prisma.empresasVagasEntrevistas.deleteMany({
        where: { id: { in: createdEntrevistas } },
      });
    }

    if (createdCandidaturas.length > 0) {
      await prisma.empresasCandidatos.deleteMany({
        where: { id: { in: createdCandidaturas } },
      });
    }

    if (createdEnderecos.length > 0) {
      await prisma.usuariosEnderecos.deleteMany({
        where: { id: { in: createdEnderecos } },
      });
    }

    if (createdVagaVinculos.length > 0) {
      await prisma.usuariosVagasVinculos.deleteMany({
        where: { id: { in: createdVagaVinculos } },
      });
    }

    if (createdEmpresasVinculos.length > 0) {
      await prisma.usuariosEmpresasVinculos.deleteMany({
        where: { id: { in: createdEmpresasVinculos } },
      });
    }

    if (createdVagas.length > 0) {
      await prisma.empresasVagas.deleteMany({
        where: { id: { in: createdVagas } },
      });
    }

    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map((user) => user.id));
    }
  });

  const createInterviewFixture = async (params?: {
    tituloVaga?: string;
    descricao?: string;
    meetUrl?: string;
    status?: 'AGENDADA' | 'CANCELADA';
  }) => {
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `9${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: `Empresa ${randomUUID().slice(0, 6)}`,
    });
    const recrutador = await createTestUser({
      role: Roles.RECRUTADOR,
      nomeCompleto: `Recrutador ${randomUUID().slice(0, 6)}`,
    });
    const candidato = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: `João da Silva ${randomUUID().slice(0, 5)}`,
    });

    testUsers.push(empresa, recrutador, candidato);

    const vinculoEmpresa = await prisma.usuariosEmpresasVinculos.create({
      data: {
        recrutadorId: recrutador.id,
        empresaUsuarioId: empresa.id,
      },
      select: { id: true },
    });
    createdEmpresasVinculos.push(vinculoEmpresa.id);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      titulo: params?.tituloVaga ?? 'Desenvolvedor Frontend',
    });
    createdVagas.push(vaga.id);

    const vinculoVaga = await prisma.usuariosVagasVinculos.create({
      data: {
        recrutadorId: recrutador.id,
        vagaId: vaga.id,
      },
      select: { id: true },
    });
    createdVagaVinculos.push(vinculoVaga.id);

    const endereco = await prisma.usuariosEnderecos.create({
      data: {
        usuarioId: candidato.id,
        cidade: 'Maceió',
        estado: 'AL',
        bairro: 'Centro',
        logradouro: 'Rua Teste',
        numero: '123',
        cep: '57000000',
      },
      select: { id: true },
    });
    createdEnderecos.push(endereco.id);

    const candidatura = await prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        statusId: statusProcesso.id,
      },
      select: { id: true },
    });
    createdCandidaturas.push(candidatura.id);

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const entrevista = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: recrutador.id,
        titulo: `Entrevista ${params?.tituloVaga ?? 'Desenvolvedor Frontend'}`,
        descricao: params?.descricao ?? 'Entrevista técnica com foco em React e Node.js.',
        dataInicio: start,
        dataFim: end,
        meetUrl: params?.meetUrl ?? 'https://meet.google.com/test-advance',
        meetEventId: 'evt-test-123',
        status: params?.status ?? 'AGENDADA',
      },
      select: { id: true, dataInicio: true },
    });
    createdEntrevistas.push(entrevista.id);

    return {
      empresa,
      recrutador,
      candidato,
      vaga,
      candidatura,
      entrevista,
    };
  };

  it('permite ADMIN listar entrevistas com payload amigável', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);
    await connectGoogleForUser(admin.id);

    const fixture = await createInterviewFixture();

    const response = await request(app)
      .get('/api/v1/entrevistas/overview?page=1&pageSize=20&search=Frontend')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.capabilities).toEqual(
      expect.objectContaining({
        canCreate: true,
        canCreatePresencial: true,
        canCreateOnline: true,
        requiresGoogleForOnline: true,
        google: expect.objectContaining({
          connected: true,
          connectEndpoint: '/api/v1/auth/google/connect',
          disconnectEndpoint: '/api/v1/auth/google/disconnect',
          statusEndpoint: '/api/v1/auth/google/status',
        }),
      }),
    );
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.entrevista.id,
          candidaturaId: fixture.candidatura.id,
          statusEntrevista: 'AGENDADA',
          statusEntrevistaLabel: 'Agendada',
          modalidade: 'ONLINE',
          modalidadeLabel: 'Online',
          meetUrl: 'https://meet.google.com/test-advance',
          candidato: expect.objectContaining({
            id: fixture.candidato.id,
            nome: fixture.candidato.nomeCompleto,
            codigo: expect.any(String),
            cidade: 'Maceió',
            estado: 'AL',
          }),
          vaga: expect.objectContaining({
            id: fixture.vaga.id,
            titulo: fixture.vaga.titulo,
            codigo: fixture.vaga.codigo,
          }),
          empresa: expect.objectContaining({
            id: fixture.empresa.id,
            nomeExibicao: fixture.empresa.nomeCompleto,
          }),
          recrutador: expect.objectContaining({
            id: fixture.recrutador.id,
            nome: fixture.recrutador.nomeCompleto,
          }),
          meta: expect.objectContaining({
            origem: 'GOOGLE_MEET',
            calendarEventId: 'evt-test-123',
          }),
        }),
      ]),
    );
    expect(response.body.data.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );
    expect(response.body.data.summary.agendadas).toBeGreaterThanOrEqual(1);
    expect(response.body.data.filtrosDisponiveis.statusEntrevista).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'AGENDADA', label: 'Agendada' })]),
    );
  });

  it('permite SETOR_DE_VAGAS acessar a listagem', async () => {
    const setorDeVagas = await createTestUser({ role: Roles.SETOR_DE_VAGAS });
    testUsers.push(setorDeVagas);

    await createInterviewFixture({ tituloVaga: 'Analista de Dados' });

    const response = await request(app)
      .get('/api/v1/entrevistas/overview?page=1&pageSize=20')
      .set('Authorization', `Bearer ${setorDeVagas.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.pagination.page).toBe(1);
  });

  it('restringe RECRUTADOR ao próprio escopo', async () => {
    const ownFixture = await createInterviewFixture({ tituloVaga: 'Produto Digital' });
    const otherFixture = await createInterviewFixture({ tituloVaga: 'UX Writer' });

    const response = await request(app)
      .get('/api/v1/entrevistas/overview?page=1&pageSize=20')
      .set('Authorization', `Bearer ${ownFixture.recrutador.token}`)
      .expect(200);

    const ids = response.body.data.items.map((item: any) => item.id);
    expect(ids).toContain(ownFixture.entrevista.id);
    expect(ids).not.toContain(otherFixture.entrevista.id);
  });

  it('retorna 200 com lista vazia para RECRUTADOR sem vínculos', async () => {
    const recruiter = await createTestUser({ role: Roles.RECRUTADOR });
    testUsers.push(recruiter);

    const response = await request(app)
      .get('/api/v1/entrevistas/overview?page=1&pageSize=20')
      .set('Authorization', `Bearer ${recruiter.token}`)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
        },
        summary: {
          totalEntrevistas: 0,
          agendadas: 0,
          confirmadas: 0,
          realizadas: 0,
          canceladas: 0,
          naoCompareceram: 0,
        },
        filtrosDisponiveis: {
          statusEntrevista: [],
          modalidades: [],
        },
        capabilities: {
          canCreate: true,
          canCreatePresencial: true,
          canCreateOnline: false,
          requiresGoogleForOnline: true,
          google: {
            connected: false,
            expired: false,
            calendarId: null,
            expiraEm: null,
            connectEndpoint: '/api/v1/auth/google/connect',
            disconnectEndpoint: '/api/v1/auth/google/disconnect',
            statusEndpoint: '/api/v1/auth/google/status',
          },
        },
      },
    });
  });

  it('bloqueia EMPRESA tentando informar outra empresa no filtro e nega ALUNO_CANDIDATO', async () => {
    const fixture = await createInterviewFixture({ tituloVaga: 'QA Engineer' });
    const otherEmpresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `8${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    const aluno = await createTestUser({ role: Roles.ALUNO_CANDIDATO });
    testUsers.push(otherEmpresa, aluno);

    await request(app)
      .get(`/api/v1/entrevistas/overview?empresaUsuarioId=${otherEmpresa.id}`)
      .set('Authorization', `Bearer ${fixture.empresa.token}`)
      .expect(403);

    const forbidden = await request(app)
      .get('/api/v1/entrevistas/overview')
      .set('Authorization', `Bearer ${aluno.token}`)
      .expect(403);

    expect(forbidden.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
  });
});
