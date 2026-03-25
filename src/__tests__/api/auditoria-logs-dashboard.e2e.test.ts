import request from 'supertest';
import { AuditoriaCategoria, Roles } from '@prisma/client';
import type { Express } from 'express';

import { prisma } from '@/config/prisma';
import { createTestUser, type TestUser } from '../helpers/auth-helper';
import { getTestApp } from '../helpers/test-setup';

jest.setTimeout(40000);

describe('API - Histórico global de auditoria', () => {
  let app: Express;
  const createdUsers: TestUser[] = [];
  const createdLogIds: string[] = [];

  const registerUser = async (
    overrides: Parameters<typeof createTestUser>[0] = {},
  ): Promise<TestUser> => {
    const user = await createTestUser(overrides);
    createdUsers.push(user);
    return user;
  };

  const registerLog = async (input: {
    categoria: AuditoriaCategoria;
    tipo: string;
    acao: string;
    usuarioId?: string | null;
    entidadeId?: string | null;
    entidadeTipo?: string | null;
    descricao: string;
    dadosAnteriores?: Record<string, unknown> | null;
    dadosNovos?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    ip?: string | null;
    userAgent?: string | null;
    criadoEm: Date;
  }) => {
    const log = await prisma.auditoriaLogs.create({
      data: {
        categoria: input.categoria,
        tipo: input.tipo,
        acao: input.acao,
        usuarioId: input.usuarioId ?? null,
        entidadeId: input.entidadeId ?? null,
        entidadeTipo: input.entidadeTipo ?? null,
        descricao: input.descricao,
        dadosAnteriores: input.dadosAnteriores ?? undefined,
        dadosNovos: input.dadosNovos ?? undefined,
        metadata: input.metadata ?? undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        criadoEm: input.criadoEm,
      },
    });

    createdLogIds.push(log.id);
    return log;
  };

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    if (createdLogIds.length > 0) {
      await prisma.auditoriaLogs.deleteMany({
        where: { id: { in: createdLogIds } },
      });
    }

    const userIds = createdUsers.map((user) => user.id);
    if (userIds.length > 0) {
      await prisma.usuariosSessoes.deleteMany({
        where: { usuarioId: { in: userIds } },
      });

      await prisma.usuarios.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });

  it('ADMIN deve listar logs globais com payload amigável para o dashboard', async () => {
    const admin = await registerUser({ role: Roles.ADMIN, nomeCompleto: 'Maria Souza Auditora' });
    const target = await registerUser({
      role: Roles.ALUNO_CANDIDATO,
      nomeCompleto: 'João da Silva Auditoria',
    });

    await registerLog({
      categoria: AuditoriaCategoria.USUARIO,
      tipo: 'USUARIO_ATUALIZADO',
      acao: 'USUARIO_ROLE_ALTERADA',
      usuarioId: admin.id,
      entidadeId: target.id,
      entidadeTipo: 'USUARIO',
      descricao: 'AUDIT_GLOBAL_CASE_1 Role alterada de ALUNO_CANDIDATO para INSTRUTOR.',
      dadosAnteriores: { role: 'ALUNO_CANDIDATO' },
      dadosNovos: { role: 'INSTRUTOR' },
      metadata: {
        motivo: 'Ajuste administrativo pelo painel',
        actorRole: Roles.ADMIN,
        origem: 'PAINEL_ADMIN',
      },
      ip: '10.0.0.10',
      userAgent: 'Mozilla/5.0 Teste',
      criadoEm: new Date('2026-03-24T13:00:00.000Z'),
    });

    await registerLog({
      categoria: AuditoriaCategoria.SEGURANCA,
      tipo: 'USUARIO_LOGIN',
      acao: 'USUARIO_LOGIN',
      usuarioId: target.id,
      entidadeId: target.id,
      entidadeTipo: 'USUARIO',
      descricao: 'AUDIT_GLOBAL_CASE_1 Login realizado com sucesso.',
      metadata: {
        origem: 'PLATAFORMA',
      },
      ip: '10.0.0.5',
      userAgent: 'Mozilla/5.0 Login',
      criadoEm: new Date('2026-03-24T14:00:00.000Z'),
    });

    await registerLog({
      categoria: AuditoriaCategoria.SISTEMA,
      tipo: 'SCRIPT_EXECUTADO',
      acao: 'SCRIPT_EXECUTADO',
      descricao: 'AUDIT_GLOBAL_CASE_1 Script de rotina executado com sucesso.',
      metadata: {
        origem: 'SISTEMA_INTERNO',
      },
      criadoEm: new Date('2026-03-24T15:00:00.000Z'),
    });

    const response = await request(app)
      .get('/api/v1/auditoria/logs?page=1&pageSize=10&search=AUDIT_GLOBAL_CASE_1')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 3,
      totalPages: 1,
    });
    expect(response.body.data.resumo).toEqual(
      expect.objectContaining({
        total: 3,
        ultimoEventoEm: '2026-03-24T15:00:00.000Z',
      }),
    );

    const roleChangeItem = response.body.data.items.find(
      (item: any) => item.tipo === 'USUARIO_ROLE_ALTERADA',
    );

    expect(roleChangeItem).toEqual(
      expect.objectContaining({
        categoria: 'USUARIO',
        acao: 'Função alterada',
        descricao: 'Função do usuário alterada de Aluno/Candidato para Instrutor.',
        ator: expect.objectContaining({
          id: admin.id,
          nome: admin.nomeCompleto,
          role: 'ADMIN',
          roleLabel: 'Administrador',
        }),
        entidade: expect.objectContaining({
          id: target.id,
          tipo: 'USUARIO',
          nomeExibicao: target.nomeCompleto,
        }),
        contexto: expect.objectContaining({
          ip: '10.0.0.10',
          origem: 'PAINEL_ADMIN',
        }),
        dadosAnteriores: expect.objectContaining({ role: 'ALUNO_CANDIDATO' }),
        dadosNovos: expect.objectContaining({ role: 'INSTRUTOR' }),
        meta: expect.objectContaining({
          motivo: 'Ajuste administrativo pelo painel',
        }),
      }),
    );

    const systemItem = response.body.data.items.find(
      (item: any) => item.tipo === 'SCRIPT_EXECUTADO',
    );
    expect(systemItem).toEqual(
      expect.objectContaining({
        ator: expect.objectContaining({
          id: null,
          nome: 'Sistema',
          role: 'SISTEMA',
          roleLabel: 'Sistema interno',
        }),
        contexto: expect.objectContaining({
          origem: 'SISTEMA_INTERNO',
        }),
      }),
    );

    expect(response.body.data.filtrosDisponiveis.categorias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'USUARIO', count: 1 }),
        expect.objectContaining({ value: 'SEGURANCA', count: 1 }),
        expect.objectContaining({ value: 'SISTEMA', count: 1 }),
      ]),
    );
  });

  it('MODERADOR não deve acessar a auditoria global', async () => {
    const moderador = await registerUser({
      role: Roles.MODERADOR,
      nomeCompleto: 'Carlos Moderador',
    });

    const response = await request(app)
      .get('/api/v1/auditoria/logs')
      .set('Authorization', `Bearer ${moderador.token}`)
      .expect(403);

    expect(response.body).toEqual({
      success: false,
      code: 'AUDITORIA_ACCESS_DENIED',
      message: 'Sem permissão para acessar o histórico de auditoria.',
    });
  });

  it('deve bloquear rotas sensíveis do módulo de auditoria para perfis não ADMIN', async () => {
    const moderador = await registerUser({
      role: Roles.MODERADOR,
      nomeCompleto: 'Carlos Moderador',
    });

    const endpoints = [
      '/api/v1/auditoria/logs',
      `/api/v1/auditoria/usuarios/${moderador.id}/historico`,
      '/api/v1/auditoria/assinaturas',
      '/api/v1/auditoria/transacoes',
      '/api/v1/auditoria/scripts',
    ];

    for (const endpoint of endpoints) {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${moderador.token}`)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        code: 'AUDITORIA_ACCESS_DENIED',
        message: 'Sem permissão para acessar o histórico de auditoria.',
      });
    }
  });

  it('deve rejeitar filtros inválidos com erro de negócio explícito', async () => {
    const admin = await registerUser({ role: Roles.ADMIN });

    const response = await request(app)
      .get(
        '/api/v1/auditoria/logs?dataInicio=2026-03-31T00:00:00.000Z&dataFim=2026-03-01T00:00:00.000Z',
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('AUDITORIA_INVALID_FILTERS');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'dataFim' })]),
    );
  });
});
