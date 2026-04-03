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
import { encodeInterviewChannel } from '@/modules/entrevistas/utils/presentation';

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

async function createVaga(params: { empresaUsuarioId: string; titulo?: string }) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await prisma.empresasVagas.create({
        data: {
          codigo: createUniqueCode(),
          slug: `agenda-${randomUUID()}`,
          usuarioId: params.empresaUsuarioId,
          regimeDeTrabalho: RegimesDeTrabalhos.CLT,
          modalidade: ModalidadesDeVagas.REMOTO,
          titulo: params.titulo ?? 'Vaga Agenda',
          requisitos: { obrigatorios: [], desejaveis: [] },
          atividades: { principais: [], extras: [] },
          beneficios: { lista: [], observacoes: null },
          status: StatusDeVagas.PUBLICADO,
        },
        select: { id: true, titulo: true, usuarioId: true },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') continue;
      throw error;
    }
  }

  throw new Error('Falha ao criar vaga de agenda');
}

describe('API - Agenda Unificada', () => {
  let app: Express;
  let statusProcesso: StatusProcessosCandidatos;

  const testUsers: TestUser[] = [];
  const createdVagas: string[] = [];
  const createdCandidaturas: string[] = [];
  const createdEntrevistas: string[] = [];
  const createdEmpresasVinculos: string[] = [];
  const createdVagaVinculos: string[] = [];

  beforeAll(async () => {
    app = await getTestApp();

    const existingStatus = await prisma.statusProcessosCandidatos.findFirst({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });

    if (!existingStatus) {
      throw new Error('Nenhum status de processo ativo encontrado para os testes de agenda');
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
    creatorRole?: Roles;
    companyName?: string;
    vagaTitulo?: string;
    candidateName?: string;
    creatorName?: string;
    dataInicio?: Date;
    dataFim?: Date;
    meetUrl?: string;
  }) => {
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `7${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
      nomeCompleto: params?.companyName ?? `Empresa Agenda ${randomUUID().slice(0, 6)}`,
    });
    const creator = await createTestUser({
      role: params?.creatorRole ?? Roles.SETOR_DE_VAGAS,
      nomeCompleto: params?.creatorName ?? `Operador Agenda ${randomUUID().slice(0, 6)}`,
    });
    const candidato = await createTestUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: params?.candidateName ?? `Candidato Agenda ${randomUUID().slice(0, 6)}`,
    });

    testUsers.push(empresa, creator, candidato);
    await connectGoogleForUser(creator.id);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      titulo: params?.vagaTitulo ?? 'Analista de RH',
    });
    createdVagas.push(vaga.id);

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

    const dataInicio = params?.dataInicio ?? new Date('2026-03-31T18:00:00.000Z');
    const dataFim = params?.dataFim ?? new Date('2026-03-31T20:00:00.000Z');

    const entrevista = await prisma.empresasVagasEntrevistas.create({
      data: {
        vagaId: vaga.id,
        candidatoId: candidato.id,
        empresaUsuarioId: empresa.id,
        recrutadorId: creator.id,
        titulo: `Entrevista — ${candidato.nomeCompleto}`,
        descricao: vaga.titulo,
        dataInicio,
        dataFim,
        meetUrl: params?.meetUrl ?? 'https://meet.google.com/abc-mnop-xyz',
        meetEventId: `evt-${randomUUID()}`,
        status: 'AGENDADA',
      },
      select: { id: true },
    });
    createdEntrevistas.push(entrevista.id);

    return { empresa, creator, candidato, vaga, candidatura, entrevista, dataInicio, dataFim };
  };

  it('lista entrevistas na rota unificada /api/v1/agenda com payload amigável', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);

    const fixture = await createInterviewFixture({
      creatorRole: Roles.SETOR_DE_VAGAS,
      companyName: 'Consultoria RH Plus',
      vagaTitulo: 'Estagiário de Recursos Humanos',
      candidateName: 'Pedro Oliveira',
      creatorName: 'Ana Setor de Vagas',
    });

    const response = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
        tipos: 'ENTREVISTA',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.eventos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.entrevista.id,
          tipo: 'ENTREVISTA',
          titulo: 'Entrevista — Pedro Oliveira',
          descricao: 'Estagiário de Recursos Humanos',
          meetUrl: 'https://meet.google.com/abc-mnop-xyz',
          cor: '#0F172A',
          usuario: {
            id: fixture.creator.id,
            nome: 'Ana Setor de Vagas',
            role: Roles.SETOR_DE_VAGAS,
          },
          empresa: {
            id: fixture.empresa.id,
            nomeExibicao: 'Consultoria RH Plus',
          },
          vaga: {
            id: fixture.vaga.id,
            titulo: 'Estagiário de Recursos Humanos',
          },
          candidato: {
            id: fixture.candidato.id,
            nome: 'Pedro Oliveira',
          },
          agenda: expect.objectContaining({
            eventoInternoId: fixture.entrevista.id,
            criadoNoSistema: true,
            provider: 'GOOGLE_MEET',
            organizerSource: 'USER_OAUTH',
            organizerUserId: fixture.creator.id,
          }),
        }),
      ]),
    );
  });

  it('inclui entrevistas presenciais na agenda com local e endereco estruturado', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);

    const fixture = await createInterviewFixture({
      creatorRole: Roles.SETOR_DE_VAGAS,
      companyName: 'Consultoria Presencial',
      vagaTitulo: 'Analista Presencial',
      candidateName: 'Mariana Presencial',
      creatorName: 'Ana Setor de Vagas',
      meetUrl: encodeInterviewChannel({
        modalidade: 'PRESENCIAL',
        enderecoPresencial: {
          cep: '57084-028',
          logradouro: 'Rua Manoel Pedro de Oliveira',
          numero: '245',
          complemento: 'Sala 5',
          bairro: 'Benedito Bentes',
          cidade: 'Maceió',
          estado: 'AL',
          pontoReferencia: 'Próximo ao shopping',
        },
      }),
    });

    const response = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
        tipos: 'ENTREVISTA',
      })
      .expect(200);

    expect(response.body.eventos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.entrevista.id,
          tipo: 'ENTREVISTA',
          modalidade: 'PRESENCIAL',
          modalidadeLabel: 'Presencial',
          meetUrl: null,
          local: expect.stringContaining('Rua Manoel Pedro de Oliveira'),
          enderecoPresencial: expect.objectContaining({
            cep: '57084-028',
            logradouro: 'Rua Manoel Pedro de Oliveira',
            numero: '245',
            bairro: 'Benedito Bentes',
            cidade: 'Maceió',
            estado: 'AL',
          }),
          agenda: expect.objectContaining({
            eventoInternoId: fixture.entrevista.id,
            criadoNoSistema: true,
            provider: 'INTERNAL_ONLY',
          }),
        }),
      ]),
    );
  });

  it('oculta entrevistas da agenda para SETOR_DE_VAGAS mesmo com filtro explícito', async () => {
    const setorViewer = await createTestUser({ role: Roles.SETOR_DE_VAGAS });
    testUsers.push(setorViewer);

    await createInterviewFixture({
      creatorRole: Roles.ADMIN,
      candidateName: 'Maria Global',
      vagaTitulo: 'Analista de Produto',
    });

    const response = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${setorViewer.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
        tipos: 'ENTREVISTA',
      })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      eventos: [],
    });
  });

  it('oculta entrevistas da agenda para SETOR_DE_VAGAS também sem filtro explícito', async () => {
    const setorViewer = await createTestUser({ role: Roles.SETOR_DE_VAGAS });
    testUsers.push(setorViewer);

    await createInterviewFixture({
      creatorRole: Roles.ADMIN,
      candidateName: 'Maria Sem Filtro',
      vagaTitulo: 'Analista Agenda',
    });

    const response = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${setorViewer.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(
      response.body.eventos.every((item: { tipo: string }) => item.tipo !== 'ENTREVISTA'),
    ).toBe(true);
  });

  it('restringe RECRUTADOR às vagas do próprio escopo mesmo quando outro usuário criou a entrevista', async () => {
    const recruiterViewer = await createTestUser({ role: Roles.RECRUTADOR });
    testUsers.push(recruiterViewer);

    const allowedFixture = await createInterviewFixture({
      creatorRole: Roles.ADMIN,
      candidateName: 'Candidato Escopo Permitido',
      vagaTitulo: 'Recruiter Allowed',
    });

    const blockedFixture = await createInterviewFixture({
      creatorRole: Roles.ADMIN,
      candidateName: 'Candidato Fora Escopo',
      vagaTitulo: 'Recruiter Blocked',
    });

    const companyLink = await prisma.usuariosEmpresasVinculos.create({
      data: {
        recrutadorId: recruiterViewer.id,
        empresaUsuarioId: allowedFixture.empresa.id,
      },
      select: { id: true },
    });
    createdEmpresasVinculos.push(companyLink.id);

    const vagaLink = await prisma.usuariosVagasVinculos.create({
      data: {
        recrutadorId: recruiterViewer.id,
        vagaId: allowedFixture.vaga.id,
      },
      select: { id: true },
    });
    createdVagaVinculos.push(vagaLink.id);

    const response = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${recruiterViewer.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
        tipos: 'ENTREVISTA',
      })
      .expect(200);

    const ids = response.body.eventos.map((item: { id: string }) => item.id);
    expect(ids).toContain(allowedFixture.entrevista.id);
    expect(ids).not.toContain(blockedFixture.entrevista.id);
  });

  it('retorna 200 com eventos vazios para EMPRESA sem entrevistas no período', async () => {
    const empresa = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      cnpj: `6${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    testUsers.push(empresa);

    const response = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${empresa.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
        tipos: 'ENTREVISTA',
      })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      eventos: [],
    });
  });

  it('retorna 400 quando os filtros da agenda são inválidos', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);

    const response = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        dataInicio: '2026-03-31T23:59:59.999Z',
        dataFim: '2026-03-01T00:00:00.000Z',
        tipos: 'ENTREVISTA',
      })
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        code: 'AGENDA_INVALID_FILTERS',
      }),
    );
  });

  it('aceita TURMA como alias de TURMA_INICIO e TURMA_FIM', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);

    const response = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        dataInicio: '2026-03-01T00:00:00.000Z',
        dataFim: '2026-03-31T23:59:59.999Z',
        tipos: 'TURMA',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        eventos: expect.any(Array),
      }),
    );
  });
});
