import type { Express } from 'express';
import { randomUUID } from 'crypto';
import request from 'supertest';
import {
  EmpresasAuditoriaAcao,
  Jornadas,
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Roles,
  Senioridade,
  StatusDeVagas,
  TiposDeUsuarios,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { cleanupTestUsers, createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(60000);

const createShortCode = (prefix: string) =>
  `${prefix}${randomUUID()
    .replace(/-/g, '')
    .slice(0, 12 - prefix.length)
    .toUpperCase()}`;

describe('API - Recursos premium de vagas para empresa', () => {
  let app: Express;
  const createdUsers: TestUser[] = [];
  const createdCategoriaIds: string[] = [];

  const registerUser = async (
    overrides: Parameters<typeof createTestUser>[0] = {},
  ): Promise<TestUser> => {
    const user = await createTestUser(overrides);
    createdUsers.push(user);
    return user;
  };

  const createCategoria = async () => {
    const categoria = await prisma.empresasVagasCategorias.create({
      data: {
        codCategoria: createShortCode('CAT'),
        nome: `Categoria Premium ${randomUUID()}`,
        descricao: 'Categoria criada para testes de recursos premium',
      },
    });
    createdCategoriaIds.push(categoria.id);
    return categoria;
  };

  const buildVagaPayload = (empresaId: string, categoriaVagaId: string, suffix: string) => ({
    usuarioId: empresaId,
    categoriaVagaId,
    slug: `vaga-premium-${suffix}-${randomUUID()}`.toLowerCase(),
    regimeDeTrabalho: RegimesDeTrabalhos.CLT,
    modalidade: ModalidadesDeVagas.REMOTO,
    titulo: `Vaga Premium ${suffix}`,
    descricao: 'Vaga criada por empresa com recursos premium ativos.',
    requisitos: {
      obrigatorios: ['Experiencia na area'],
      desejaveis: ['Comunicacao objetiva'],
    },
    atividades: {
      principais: ['Executar atividades da vaga'],
      extras: ['Apoiar melhoria de processos'],
    },
    beneficios: {
      lista: ['Vale transporte'],
    },
    jornada: Jornadas.INTEGRAL,
    senioridade: Senioridade.PLENO,
    vagaEmDestaque: true,
  });

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    const userIds = createdUsers.map((user) => user.id);

    if (userIds.length > 0) {
      await prisma.empresasVagasDestaque.deleteMany({
        where: { EmpresasVagas: { usuarioId: { in: userIds } } },
      });
      await prisma.empresasVagas.deleteMany({ where: { usuarioId: { in: userIds } } });
      await prisma.empresasAuditoria.deleteMany({
        where: {
          OR: [{ empresaId: { in: userIds } }, { alteradoPor: { in: userIds } }],
        },
      });
      await prisma.empresasRecursosPremiumVagas.deleteMany({
        where: {
          OR: [
            { empresaId: { in: userIds } },
            { aplicadoPorId: { in: userIds } },
            { removidoPorId: { in: userIds } },
          ],
        },
      });
      await cleanupTestUsers(userIds);
    }

    if (createdCategoriaIds.length > 0) {
      await prisma.empresasVagasCategorias.deleteMany({
        where: { id: { in: createdCategoriaIds } },
      });
    }
  });

  it('permite ADMIN/MODERADOR aplicar recursos premium e bloqueia outros perfis', async () => {
    const admin = await registerUser({ role: Roles.ADMIN, nomeCompleto: 'Admin Premium' });
    const moderador = await registerUser({
      role: Roles.MODERADOR,
      nomeCompleto: 'Moderador Premium',
    });
    const operadorEmpresa = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `Empresa Operadora Premium ${Date.now()}`,
    });
    const empresaAdmin = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `Empresa Admin Premium ${Date.now()}`,
    });
    const empresaModerador = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `Empresa Moderador Premium ${Date.now()}`,
    });

    await request(app)
      .post(`/api/v1/empresas/${empresaAdmin.id}/recursos-premium-vagas`)
      .set('Authorization', `Bearer ${operadorEmpresa.token}`)
      .send({ motivo: 'Tentativa operacional' })
      .expect(403);

    const adminApply = await request(app)
      .post(`/api/v1/empresas/${empresaAdmin.id}/recursos-premium-vagas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'Empresa propria da Advance' })
      .expect(200);

    expect(adminApply.body).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Recursos premium aplicados com sucesso.',
        empresa: expect.objectContaining({
          id: empresaAdmin.id,
          recursosPremiumVagas: expect.objectContaining({
            ativo: true,
            vagasIlimitadas: true,
            destaquesIlimitados: true,
            motivo: 'Empresa propria da Advance',
            aplicadoPor: expect.objectContaining({
              id: admin.id,
              role: Roles.ADMIN,
            }),
          }),
        }),
      }),
    );

    await request(app)
      .post(`/api/v1/empresas/${empresaAdmin.id}/recursos-premium-vagas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'Empresa propria da Advance' })
      .expect(200);

    const moderadorApply = await request(app)
      .post(`/api/v1/empresas/${empresaModerador.id}/recursos-premium-vagas`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ motivo: 'Empresa estrategica' })
      .expect(200);

    expect(moderadorApply.body.empresa.recursosPremiumVagas.aplicadoPor).toEqual(
      expect.objectContaining({
        id: moderador.id,
        role: Roles.MODERADOR,
      }),
    );
  });

  it('inclui recursos premium no detalhe/listagem elegivel e nao inclui para SETOR_DE_VAGAS', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const setor = await registerUser({ role: Roles.SETOR_DE_VAGAS });
    const marker = `EMP_PREMIUM_${Date.now()}`;
    const empresa = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `${marker} Sem Plano`,
    });

    await request(app)
      .post(`/api/v1/empresas/${empresa.id}/recursos-premium-vagas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'Empresa propria da Advance' })
      .expect(200);

    const detail = await request(app)
      .get(`/api/v1/empresas/${empresa.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detail.body.empresa.recursosPremiumVagas).toEqual(
      expect.objectContaining({
        ativo: true,
        vagasIlimitadas: true,
        destaquesIlimitados: true,
      }),
    );

    const adminList = await request(app)
      .get('/api/v1/empresas')
      .query({ page: 1, pageSize: 10, search: marker, elegivelCadastroVaga: true })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(adminList.body.pagination.total).toBe(1);
    expect(adminList.body.data[0]).toEqual(
      expect.objectContaining({
        id: empresa.id,
        recursosPremiumVagas: expect.objectContaining({ ativo: true }),
      }),
    );

    const setorList = await request(app)
      .get('/api/v1/empresas')
      .query({ page: 1, pageSize: 10, search: marker, elegivelCadastroVaga: true })
      .set('Authorization', `Bearer ${setor.token}`)
      .expect(200);

    expect(setorList.body.pagination.total).toBe(0);
  });

  it('permite criar vaga em destaque sem plano e remove efeitos premium com auditoria', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const empresa = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `Empresa Premium Vagas ${Date.now()}`,
    });
    const categoria = await createCategoria();

    await request(app)
      .post(`/api/v1/empresas/${empresa.id}/recursos-premium-vagas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'Empresa propria da Advance' })
      .expect(200);

    const createVaga = await request(app)
      .post('/api/v1/empresas/vagas')
      .set('Authorization', `Bearer ${empresa.token}`)
      .send(buildVagaPayload(empresa.id, categoria.id, 'criacao'))
      .expect(201);

    expect(createVaga.body).toEqual(
      expect.objectContaining({
        usuarioId: empresa.id,
        status: StatusDeVagas.PUBLICADO,
        vagaEmDestaque: true,
        destaqueInfo: null,
      }),
    );

    const remove = await request(app)
      .delete(`/api/v1/empresas/${empresa.id}/recursos-premium-vagas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        motivo: 'Remocao administrativa',
        novoStatusVagasPublicadas: StatusDeVagas.RASCUNHO,
      })
      .expect(200);

    expect(remove.body).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Recursos premium removidos com sucesso.',
        empresa: expect.objectContaining({
          id: empresa.id,
          recursosPremiumVagas: expect.objectContaining({
            ativo: false,
            vagasIlimitadas: false,
            destaquesIlimitados: false,
            aplicadoEm: null,
            aplicadoPor: null,
            motivo: null,
          }),
        }),
        efeitos: {
          vagasPublicadasAlteradas: 1,
          novoStatusVagasPublicadas: StatusDeVagas.RASCUNHO,
          destaquesRemovidos: 1,
        },
      }),
    );

    const vagaAtualizada = await prisma.empresasVagas.findUniqueOrThrow({
      where: { id: createVaga.body.id },
      select: { status: true, destaque: true },
    });

    expect(vagaAtualizada).toEqual({
      status: StatusDeVagas.RASCUNHO,
      destaque: false,
    });

    const auditorias = await prisma.empresasAuditoria.findMany({
      where: {
        empresaId: empresa.id,
        acao: {
          in: [
            EmpresasAuditoriaAcao.RECURSOS_PREMIUM_VAGAS_APLICADOS,
            EmpresasAuditoriaAcao.RECURSOS_PREMIUM_VAGAS_REMOVIDOS,
          ],
        },
      },
      orderBy: { criadoEm: 'asc' },
    });

    expect(auditorias).toHaveLength(2);
    expect(auditorias[1].metadata).toEqual(
      expect.objectContaining({
        motivo: 'Remocao administrativa',
        efeitos: expect.objectContaining({
          vagasPublicadasAlteradas: 1,
          destaquesRemovidos: 1,
        }),
      }),
    );
  });

  it('gera slug unico automaticamente ao criar vagas premium com titulo repetido', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });
    const empresa = await registerUser({
      role: Roles.EMPRESA,
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      nomeCompleto: `Empresa Premium Slug ${Date.now()}`,
    });
    const categoria = await createCategoria();
    const baseSlug = `filipeteste-${Date.now()}`;

    await request(app)
      .post(`/api/v1/empresas/${empresa.id}/recursos-premium-vagas`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'Empresa propria da Advance' })
      .expect(200);

    const payload = {
      ...buildVagaPayload(empresa.id, categoria.id, 'slug-duplicado'),
      titulo: 'filipeteste',
      slug: baseSlug,
    };

    const primeiraVaga = await request(app)
      .post('/api/v1/empresas/vagas')
      .set('Authorization', `Bearer ${empresa.token}`)
      .send(payload)
      .expect(201);

    const segundaVaga = await request(app)
      .post('/api/v1/empresas/vagas')
      .set('Authorization', `Bearer ${empresa.token}`)
      .send(payload)
      .expect(201);

    expect(primeiraVaga.body).toEqual(
      expect.objectContaining({
        slug: baseSlug,
        status: StatusDeVagas.PUBLICADO,
        vagaEmDestaque: true,
        destaqueInfo: null,
      }),
    );
    expect(segundaVaga.body).toEqual(
      expect.objectContaining({
        slug: `${baseSlug}-2`,
        status: StatusDeVagas.PUBLICADO,
        vagaEmDestaque: true,
        destaqueInfo: null,
      }),
    );

    const payloadSemSlug = {
      ...buildVagaPayload(empresa.id, categoria.id, 'sem-slug'),
      titulo: `Título sem slug ${Date.now()}`,
    };
    delete (payloadSemSlug as { slug?: string }).slug;

    const vagaSemSlug = await request(app)
      .post('/api/v1/empresas/vagas')
      .set('Authorization', `Bearer ${empresa.token}`)
      .send(payloadSemSlug)
      .expect(201);

    expect(vagaSemSlug.body.slug).toMatch(/^titulo-sem-slug-/);
    expect(vagaSemSlug.body.status).toBe(StatusDeVagas.PUBLICADO);
  });
});
