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

jest.mock('@/modules/cursos/aulas/services/google-calendar.service', () => ({
  googleCalendarService: {
    createMeetEvent: jest.fn(async () => ({
      eventId: 'evt-test-create-123',
      meetUrl: 'https://meet.google.com/abc-mnop-xyz',
    })),
    deleteEvent: jest.fn(async () => undefined),
    sincronizarEntrevista: jest.fn(async () => undefined),
  },
}));

jest.mock('@/modules/cursos/aulas/services/notificacoes-helper.service', () => ({
  notificacoesHelper: {
    criar: jest.fn(async () => ({ id: 'notif-test-id' })),
    enviarEmailCritico: jest.fn(async () => undefined),
    deveEnviarEmail: jest.fn(() => false),
  },
}));

import { prisma } from '@/config/prisma';
import { googleCalendarService } from '@/modules/cursos/aulas/services/google-calendar.service';
import { notificacoesHelper } from '@/modules/cursos/aulas/services/notificacoes-helper.service';

import { getTestApp } from '../helpers/test-setup';
import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';

const createUniqueCode = () => randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
const mockedGoogleCalendarService = googleCalendarService as jest.Mocked<
  typeof googleCalendarService
>;
const mockedNotificacoesHelper = notificacoesHelper as jest.Mocked<typeof notificacoesHelper>;

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
          titulo: params.titulo ?? 'Vaga Teste Entrevista',
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

describe('API - Entrevistas Create Flow', () => {
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

  beforeEach(() => {
    mockedGoogleCalendarService.createMeetEvent.mockClear();
    mockedGoogleCalendarService.deleteEvent.mockClear();
    mockedGoogleCalendarService.sincronizarEntrevista.mockClear();
    mockedGoogleCalendarService.createMeetEvent.mockResolvedValue({
      eventId: 'evt-test-create-123',
      meetUrl: 'https://meet.google.com/abc-mnop-xyz',
    });
    mockedGoogleCalendarService.deleteEvent.mockResolvedValue(undefined as any);
    mockedGoogleCalendarService.sincronizarEntrevista.mockResolvedValue(undefined as any);
    mockedNotificacoesHelper.criar.mockClear();
    mockedNotificacoesHelper.enviarEmailCritico.mockClear();
    mockedNotificacoesHelper.deveEnviarEmail.mockClear();
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

  const createFixture = async (options?: {
    withSecondCandidate?: boolean;
    withActiveInterview?: boolean;
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
      nomeCompleto: `Candidato ${randomUUID().slice(0, 5)}`,
    });

    const extraCandidates: TestUser[] = [];
    if (options?.withSecondCandidate) {
      extraCandidates.push(
        await createTestUser({
          role: Roles.ALUNO_CANDIDATO,
          nomeCompleto: `Candidato ${randomUUID().slice(0, 5)}`,
        }),
      );
    }

    testUsers.push(empresa, recrutador, candidato, ...extraCandidates);

    const vinculoEmpresa = await prisma.usuariosEmpresasVinculos.create({
      data: {
        recrutadorId: recrutador.id,
        empresaUsuarioId: empresa.id,
      },
      select: { id: true },
    });
    createdEmpresasVinculos.push(vinculoEmpresa.id);

    const enderecoEmpresa = await prisma.usuariosEnderecos.create({
      data: {
        usuarioId: empresa.id,
        cidade: 'Maceió',
        estado: 'AL',
        bairro: 'Centro',
        logradouro: 'Avenida Empresa',
        numero: '200',
        cep: '57000000',
      },
      select: { id: true },
    });
    createdEnderecos.push(enderecoEmpresa.id);

    const vaga = await createVaga({
      empresaUsuarioId: empresa.id,
      titulo: 'Desenvolvedor Full Stack',
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

    const allCandidates = [candidato, ...extraCandidates];
    const candidaturas = [] as { id: string; candidatoId: string }[];

    for (const [index, candidateUser] of allCandidates.entries()) {
      const endereco = await prisma.usuariosEnderecos.create({
        data: {
          usuarioId: candidateUser.id,
          cidade: index === 0 ? 'Maceió' : 'Arapiraca',
          estado: 'AL',
          bairro: 'Centro',
          logradouro: 'Rua Teste',
          numero: String(100 + index),
          cep: '57000000',
        },
        select: { id: true },
      });
      createdEnderecos.push(endereco.id);

      const candidatura = await prisma.empresasCandidatos.create({
        data: {
          vagaId: vaga.id,
          candidatoId: candidateUser.id,
          empresaUsuarioId: empresa.id,
          statusId: statusProcesso.id,
        },
        select: { id: true, candidatoId: true },
      });
      createdCandidaturas.push(candidatura.id);
      candidaturas.push(candidatura);
    }

    let entrevistaAtivaId: string | null = null;
    if (options?.withActiveInterview) {
      const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      const entrevista = await prisma.empresasVagasEntrevistas.create({
        data: {
          vagaId: vaga.id,
          candidatoId: candidaturas[0].candidatoId,
          empresaUsuarioId: empresa.id,
          recrutadorId: recrutador.id,
          titulo: 'Entrevista já existente',
          descricao: 'Entrevista existente para validar bloqueio.',
          dataInicio: start,
          dataFim: end,
          meetUrl: 'https://meet.google.com/def-ghij-klm',
          meetEventId: 'evt-existing-123',
          status: 'AGENDADA',
        },
        select: { id: true },
      });

      createdEntrevistas.push(entrevista.id);
      entrevistaAtivaId = entrevista.id;
    }

    return {
      empresa,
      recrutador,
      vaga,
      candidaturas,
      candidatos: allCandidates,
      entrevistaAtivaId,
    };
  };

  it('lista empresas elegíveis para ADMIN e restringe EMPRESA ao próprio escopo', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);

    const fixture = await createFixture();

    const adminResponse = await request(app)
      .get('/api/v1/entrevistas/opcoes/empresas')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(adminResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              id: fixture.empresa.id,
              nomeExibicao: fixture.empresa.nomeCompleto,
              codigo: expect.any(String),
              cnpj: fixture.empresa.cnpj,
              email: fixture.empresa.email,
              totalVagasElegiveis: 1,
              enderecoPadraoEntrevista: expect.objectContaining({
                cep: '57000000',
                logradouro: 'Avenida Empresa',
                numero: '200',
                bairro: 'Centro',
                cidade: 'Maceió',
                estado: 'AL',
              }),
            }),
          ]),
        },
      }),
    );

    const empresaResponse = await request(app)
      .get('/api/v1/entrevistas/opcoes/empresas')
      .set('Authorization', `Bearer ${fixture.empresa.token}`)
      .expect(200);

    expect(empresaResponse.body.data.items).toEqual([
      expect.objectContaining({
        id: fixture.empresa.id,
        nomeExibicao: fixture.empresa.nomeCompleto,
        cnpj: fixture.empresa.cnpj,
        email: fixture.empresa.email,
        totalVagasElegiveis: 1,
        enderecoPadraoEntrevista: expect.objectContaining({
          logradouro: 'Avenida Empresa',
          numero: '200',
          cidade: 'Maceió',
          estado: 'AL',
        }),
      }),
    ]);
  });

  it('lista vagas elegíveis por empresa respeitando o escopo do recrutador', async () => {
    const fixture = await createFixture({ withSecondCandidate: true, withActiveInterview: true });

    const response = await request(app)
      .get(`/api/v1/entrevistas/opcoes/vagas?empresaUsuarioId=${fixture.empresa.id}`)
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        items: [
          expect.objectContaining({
            id: fixture.vaga.id,
            codigo: fixture.vaga.codigo,
            titulo: fixture.vaga.titulo,
            status: fixture.vaga.status,
            statusLabel: 'Publicado',
            empresaUsuarioId: fixture.empresa.id,
            candidatosElegiveis: 1,
          }),
        ],
      },
    });
  });

  it('aceita empresaUsuarioId válido mesmo quando a query chega duplicada ou serializada como array e retorna 200 com items vazios sem vagas elegíveis', async () => {
    const fixture = await createFixture({ withActiveInterview: true });
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);

    const duplicatedQueryResponse = await request(app)
      .get(
        `/api/v1/entrevistas/opcoes/vagas?empresaUsuarioId=${fixture.empresa.id}&empresaUsuarioId=${fixture.empresa.id}`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(duplicatedQueryResponse.body).toEqual({
      success: true,
      data: {
        items: [],
      },
    });

    const bracketArrayResponse = await request(app)
      .get(`/api/v1/entrevistas/opcoes/vagas?empresaUsuarioId[0]=${fixture.empresa.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(bracketArrayResponse.body).toEqual({
      success: true,
      data: {
        items: [],
      },
    });

    const jsonArrayResponse = await request(app)
      .get(
        `/api/v1/entrevistas/opcoes/vagas?empresaUsuarioId=${encodeURIComponent(JSON.stringify([fixture.empresa.id]))}`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(jsonArrayResponse.body).toEqual({
      success: true,
      data: {
        items: [],
      },
    });

    const empresaSemVagas = await createTestUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `Empresa Sem Vagas ${randomUUID().slice(0, 6)}`,
      cnpj: `8${String(Date.now()).padStart(13, '0').slice(0, 13)}`,
    });
    testUsers.push(empresaSemVagas);

    const noEligibleJobsResponse = await request(app)
      .get(`/api/v1/entrevistas/opcoes/vagas?empresaUsuarioId=${empresaSemVagas.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(noEligibleJobsResponse.body).toEqual({
      success: true,
      data: {
        items: [],
      },
    });
  });

  it('retorna 403 quando a empresa informada está fora do escopo do usuário logado', async () => {
    const fixture = await createFixture();
    const otherFixture = await createFixture();

    await request(app)
      .get(`/api/v1/entrevistas/opcoes/vagas?empresaUsuarioId=${otherFixture.empresa.id}`)
      .set('Authorization', `Bearer ${fixture.empresa.token}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
      });
  });

  it('lista candidatos da vaga com candidaturaId e sinalizador de entrevista ativa', async () => {
    const fixture = await createFixture({ withSecondCandidate: true, withActiveInterview: true });

    const response = await request(app)
      .get(`/api/v1/entrevistas/opcoes/candidatos?vagaId=${fixture.vaga.id}`)
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidaturaId: fixture.candidaturas[0].id,
          entrevistaAtiva: true,
          entrevistaAtivaId: fixture.entrevistaAtivaId,
          candidato: expect.objectContaining({
            id: fixture.candidatos[0].id,
            nome: fixture.candidatos[0].nomeCompleto,
            cidade: 'Maceió',
            estado: 'AL',
          }),
        }),
        expect.objectContaining({
          candidaturaId: fixture.candidaturas[1].id,
          entrevistaAtiva: false,
          entrevistaAtivaId: null,
          candidato: expect.objectContaining({
            id: fixture.candidatos[1].id,
            nome: fixture.candidatos[1].nomeCompleto,
            cidade: 'Arapiraca',
            estado: 'AL',
          }),
        }),
      ]),
    );
  });

  it('cria entrevista pelo endpoint canônico com payload amigável', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);
    await connectGoogleForUser(admin.id);

    const fixture = await createFixture();
    const dataInicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);

    const response = await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        empresaUsuarioId: fixture.empresa.id,
        vagaId: fixture.vaga.id,
        candidaturaId: fixture.candidaturas[0].id,
        candidatoId: fixture.candidatos[0].id,
        modalidade: 'ONLINE',
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        descricao: 'Entrevista técnica com foco em React e Node.js.',
        gerarMeet: true,
      })
      .expect(201);

    createdEntrevistas.push(response.body.data.id);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          candidaturaId: fixture.candidaturas[0].id,
          statusEntrevista: 'AGENDADA',
          statusEntrevistaLabel: 'Agendada',
          modalidade: 'ONLINE',
          modalidadeLabel: 'Online',
          meetUrl: 'https://meet.google.com/abc-mnop-xyz',
          local: null,
          enderecoPresencial: null,
          agenda: expect.objectContaining({
            eventoInternoId: expect.any(String),
            criadoNoSistema: true,
            provider: 'GOOGLE_MEET',
            organizerSource: 'USER_OAUTH',
            organizerUserId: admin.id,
            organizerEmail: admin.email,
          }),
          candidato: expect.objectContaining({
            id: fixture.candidatos[0].id,
            nome: fixture.candidatos[0].nomeCompleto,
          }),
          vaga: expect.objectContaining({
            id: fixture.vaga.id,
            titulo: fixture.vaga.titulo,
          }),
          empresa: expect.objectContaining({
            id: fixture.empresa.id,
            nomeExibicao: fixture.empresa.nomeCompleto,
          }),
          recrutador: expect.objectContaining({
            id: admin.id,
            nome: admin.nomeCompleto,
          }),
        }),
      }),
    );

    const persisted = await prisma.empresasVagasEntrevistas.findUnique({
      where: { id: response.body.data.id },
      select: {
        id: true,
        vagaId: true,
        candidatoId: true,
        empresaUsuarioId: true,
        recrutadorId: true,
        meetUrl: true,
        status: true,
      },
    });

    expect(persisted).toEqual(
      expect.objectContaining({
        id: response.body.data.id,
        vagaId: fixture.vaga.id,
        candidatoId: fixture.candidatos[0].id,
        empresaUsuarioId: fixture.empresa.id,
        recrutadorId: admin.id,
        meetUrl: 'https://meet.google.com/abc-mnop-xyz',
        status: 'AGENDADA',
      }),
    );

    expect(mockedGoogleCalendarService.createMeetEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        instrutorId: admin.id,
        requestId: response.body.data.id,
        externalReferenceId: response.body.data.id,
      }),
    );

    expect(mockedNotificacoesHelper.criar).toHaveBeenCalledTimes(2);
    expect(mockedNotificacoesHelper.criar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        usuarioId: fixture.candidatos[0].id,
        tipo: 'SISTEMA',
        titulo: 'Entrevista agendada',
        prioridade: 'ALTA',
        eventoId: `entrevista-criada-candidato-${response.body.data.id}`,
        dados: expect.objectContaining({
          entrevistaId: response.body.data.id,
          empresaUsuarioId: fixture.empresa.id,
          vagaId: fixture.vaga.id,
          candidaturaId: fixture.candidaturas[0].id,
          candidatoId: fixture.candidatos[0].id,
          modalidade: 'ONLINE',
        }),
      }),
    );
    expect(mockedNotificacoesHelper.criar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        usuarioId: fixture.empresa.id,
        tipo: 'SISTEMA',
        titulo: 'Entrevista marcada',
        prioridade: 'ALTA',
        eventoId: `entrevista-criada-empresa-${response.body.data.id}`,
        dados: expect.objectContaining({
          entrevistaId: response.body.data.id,
          empresaUsuarioId: fixture.empresa.id,
          vagaId: fixture.vaga.id,
          candidaturaId: fixture.candidaturas[0].id,
          candidatoId: fixture.candidatos[0].id,
          modalidade: 'ONLINE',
        }),
      }),
    );
  });

  it('bloqueia entrevista ONLINE quando o criador não conectou o Google', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);

    const fixture = await createFixture();
    const dataInicio = new Date(Date.now() + 30 * 60 * 60 * 1000);
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);

    await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        empresaUsuarioId: fixture.empresa.id,
        vagaId: fixture.vaga.id,
        candidaturaId: fixture.candidaturas[0].id,
        candidatoId: fixture.candidatos[0].id,
        modalidade: 'ONLINE',
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        descricao: 'Entrevista online com agenda interna.',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            success: false,
            code: 'INTERVIEW_GOOGLE_NOT_CONNECTED',
          }),
        );
      });

    expect(mockedGoogleCalendarService.createMeetEvent).not.toHaveBeenCalled();
  });

  it('permite entrevista ONLINE sem Google apenas quando gerarMeet=false', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);

    const fixture = await createFixture();
    const dataInicio = new Date(Date.now() + 32 * 60 * 60 * 1000);
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);

    const response = await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        empresaUsuarioId: fixture.empresa.id,
        vagaId: fixture.vaga.id,
        candidaturaId: fixture.candidaturas[0].id,
        candidatoId: fixture.candidatos[0].id,
        modalidade: 'ONLINE',
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        descricao: 'Entrevista online sem Meet explícito.',
        gerarMeet: false,
      })
      .expect(201);

    createdEntrevistas.push(response.body.data.id);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        modalidade: 'ONLINE',
        meetUrl: null,
        agenda: {
          eventoInternoId: response.body.data.id,
          criadoNoSistema: true,
          provider: 'INTERNAL_ONLY',
          organizerSource: 'SYSTEM',
          organizerUserId: null,
          organizerEmail: null,
        },
      }),
    );

    const persisted = await prisma.empresasVagasEntrevistas.findUnique({
      where: { id: response.body.data.id },
      select: {
        meetUrl: true,
        meetEventId: true,
      },
    });

    expect(persisted).toEqual({
      meetUrl: 'online://',
      meetEventId: null,
    });
  });

  it('falha a criação ONLINE quando o provedor retorna URL inválida do Google Meet', async () => {
    const admin = await createTestUser({ role: Roles.ADMIN });
    testUsers.push(admin);
    await connectGoogleForUser(admin.id);

    mockedGoogleCalendarService.createMeetEvent.mockResolvedValueOnce({
      eventId: 'evt-invalid-link-123',
      meetUrl: 'https://meet.google.com/front-demo-01',
    });

    const fixture = await createFixture();
    const dataInicio = new Date(Date.now() + 34 * 60 * 60 * 1000);
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);

    await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        empresaUsuarioId: fixture.empresa.id,
        vagaId: fixture.vaga.id,
        candidaturaId: fixture.candidaturas[0].id,
        candidatoId: fixture.candidatos[0].id,
        modalidade: 'ONLINE',
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        descricao: 'Entrevista online com link inválido do provedor.',
      })
      .expect(500)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            success: false,
            code: 'INTERVIEW_MEET_CREATE_ERROR',
          }),
        );
      });
  });

  it('exige enderecoPresencial estruturado para entrevistas presenciais e persiste snapshot', async () => {
    const fixture = await createFixture();
    const dataInicio = new Date(Date.now() + 36 * 60 * 60 * 1000);
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);

    await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .send({
        empresaUsuarioId: fixture.empresa.id,
        vagaId: fixture.vaga.id,
        candidaturaId: fixture.candidaturas[0].id,
        candidatoId: fixture.candidatos[0].id,
        modalidade: 'PRESENCIAL',
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        descricao: 'Entrevista presencial sem endereço.',
        gerarMeet: false,
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toHaveProperty('code', 'INTERVIEW_INVALID_PAYLOAD');
      });

    const response = await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .send({
        empresaUsuarioId: fixture.empresa.id,
        vagaId: fixture.vaga.id,
        candidaturaId: fixture.candidaturas[0].id,
        candidatoId: fixture.candidatos[0].id,
        modalidade: 'PRESENCIAL',
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        descricao: 'Entrevista presencial com endereço estruturado.',
        enderecoPresencial: {
          cep: '57000-000',
          logradouro: 'Rua das Palmeiras',
          numero: '123',
          complemento: 'Sala 5',
          bairro: 'Centro',
          cidade: 'Maceió',
          estado: 'AL',
          pontoReferencia: 'Próximo ao shopping',
        },
        gerarMeet: false,
      })
      .expect(201);

    createdEntrevistas.push(response.body.data.id);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        modalidade: 'PRESENCIAL',
        meetUrl: null,
        agenda: {
          eventoInternoId: response.body.data.id,
          criadoNoSistema: true,
          provider: 'INTERNAL_ONLY',
          organizerSource: 'SYSTEM',
          organizerUserId: null,
          organizerEmail: null,
        },
        enderecoPresencial: {
          cep: '57000-000',
          logradouro: 'Rua das Palmeiras',
          numero: '123',
          complemento: 'Sala 5',
          bairro: 'Centro',
          cidade: 'Maceió',
          estado: 'AL',
          pontoReferencia: 'Próximo ao shopping',
        },
        local: expect.stringContaining('Rua das Palmeiras'),
      }),
    );

    const persisted = await prisma.empresasVagasEntrevistas.findUnique({
      where: { id: response.body.data.id },
      select: { meetUrl: true },
    });

    expect(persisted?.meetUrl).toContain('presencial://');
    expect(decodeURIComponent((persisted?.meetUrl ?? '').replace('presencial://', ''))).toContain(
      '"logradouro":"Rua das Palmeiras"',
    );
  });

  it('faz entrevista PRESENCIAL criada via POST aparecer em /api/v1/agenda para RECRUTADOR, EMPRESA e SETOR_DE_VAGAS', async () => {
    const fixture = await createFixture();
    const setorDeVagas = await createTestUser({
      role: Roles.SETOR_DE_VAGAS,
      nomeCompleto: `Setor ${randomUUID().slice(0, 6)}`,
    });
    testUsers.push(setorDeVagas);

    const dataInicio = new Date('2026-03-31T18:00:00.000Z');
    const dataFim = new Date('2026-03-31T19:00:00.000Z');

    const creationResponse = await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .send({
        empresaUsuarioId: fixture.empresa.id,
        vagaId: fixture.vaga.id,
        candidaturaId: fixture.candidaturas[0].id,
        candidatoId: fixture.candidatos[0].id,
        modalidade: 'PRESENCIAL',
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        descricao: 'Entrevista presencial para validar agenda.',
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
      })
      .expect(201);

    const entrevistaId = creationResponse.body.data.id as string;
    createdEntrevistas.push(entrevistaId);

    expect(creationResponse.body.data).toEqual(
      expect.objectContaining({
        id: entrevistaId,
        modalidade: 'PRESENCIAL',
        meetUrl: null,
        agenda: expect.objectContaining({
          eventoInternoId: entrevistaId,
          criadoNoSistema: true,
          provider: 'INTERNAL_ONLY',
        }),
      }),
    );

    const agendaQuery = {
      dataInicio: '2026-03-01T00:00:00.000Z',
      dataFim: '2026-03-31T23:59:59.999Z',
      tipos: 'ENTREVISTA',
    };

    const assertPresencialInAgenda = (body: any) => {
      expect(body.eventos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: entrevistaId,
            tipo: 'ENTREVISTA',
            modalidade: 'PRESENCIAL',
            modalidadeLabel: 'Presencial',
            dataInicio: dataInicio.toISOString(),
            dataFim: dataFim.toISOString(),
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
              eventoInternoId: entrevistaId,
              criadoNoSistema: true,
              provider: 'INTERNAL_ONLY',
            }),
          }),
        ]),
      );
    };

    const recrutadorAgenda = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .query(agendaQuery)
      .expect(200);
    assertPresencialInAgenda(recrutadorAgenda.body);

    const empresaAgenda = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${fixture.empresa.token}`)
      .query(agendaQuery)
      .expect(200);
    assertPresencialInAgenda(empresaAgenda.body);

    const setorAgenda = await request(app)
      .get('/api/v1/agenda')
      .set('Authorization', `Bearer ${setorDeVagas.token}`)
      .query(agendaQuery)
      .expect(200);
    assertPresencialInAgenda(setorAgenda.body);
  });

  it('bloqueia criação duplicada e criação fora do escopo da EMPRESA', async () => {
    const fixture = await createFixture({ withActiveInterview: true });
    const otherFixture = await createFixture();

    await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${fixture.recrutador.token}`)
      .send({
        empresaUsuarioId: fixture.empresa.id,
        vagaId: fixture.vaga.id,
        candidaturaId: fixture.candidaturas[0].id,
        candidatoId: fixture.candidatos[0].id,
        modalidade: 'ONLINE',
        dataInicio: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        dataFim: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString(),
        gerarMeet: false,
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toHaveProperty('code', 'INTERVIEW_ALREADY_EXISTS');
      });

    await request(app)
      .post('/api/v1/entrevistas')
      .set('Authorization', `Bearer ${fixture.empresa.token}`)
      .send({
        empresaUsuarioId: otherFixture.empresa.id,
        vagaId: otherFixture.vaga.id,
        candidaturaId: otherFixture.candidaturas[0].id,
        candidatoId: otherFixture.candidatos[0].id,
        modalidade: 'PRESENCIAL',
        dataInicio: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        dataFim: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
        enderecoPresencial: {
          cep: '57000-000',
          logradouro: 'Rua da Empresa',
          numero: '10',
          bairro: 'Centro',
          cidade: 'Maceió',
          estado: 'AL',
        },
        gerarMeet: false,
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
      });
  });
});
