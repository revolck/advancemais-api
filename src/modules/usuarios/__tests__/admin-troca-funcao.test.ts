import { Roles, TiposDeUsuarios } from '@prisma/client';

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: { findUnique: jest.fn(), update: jest.fn() },
    usuariosSessoes: { updateMany: jest.fn() },
    cursosTurmasInscricoes: { count: jest.fn() },
    usuariosCurriculos: { count: jest.fn() },
    empresasCandidatos: { count: jest.fn() },
    $transaction: jest.fn(),
  },
  retryOperation: (fn: () => unknown) => fn(),
}));
jest.mock('@/modules/candidatos/candidaturas/services', () => ({ candidaturasService: {} }));
jest.mock('@/modules/candidatos/logs/service', () => ({ candidatoLogsService: {} }));
jest.mock('@/modules/usuarios/utils/cache', () => ({ invalidateUserCache: jest.fn() }));
jest.mock('@/utils/cache', () => ({
  generateCacheKey: jest.fn(),
  getCachedOrFetch: jest.fn(),
  invalidateCacheByPrefix: jest.fn(),
}));
jest.mock('../utils/user-history', () => ({
  buildUserProfileSnapshot: jest.fn(),
  diffSnapshot: jest.fn(),
  getUserHistoryConfig: jest.fn(),
  getUserRoleLabel: jest.fn(),
  recordUserAuditEvent: jest.fn(),
}));

import { prisma } from '@/config/prisma';
import { AdminService } from '../services/admin-service';
import { recordUserAuditEvent } from '../utils/user-history';

const prismaMock = prisma as any;
const ALUNA = 'b2f6c1de-1111-4a2b-9c3d-000000000001';
const ADMIN = 'b2f6c1de-1111-4a2b-9c3d-000000000002';

const alunaAntes = {
  id: ALUNA,
  email: 'aluna@example.com',
  nomeCompleto: 'Aluna Exemplo',
  role: Roles.ALUNO_CANDIDATO,
  tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
  status: 'ATIVO',
  UsuariosVerificacaoEmail: null,
};

describe('troca de função de aluno/candidato', () => {
  const service = new AdminService();

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    prismaMock.usuarios.findUnique.mockResolvedValue(alunaAntes);
    prismaMock.usuarios.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...alunaAntes, role: data.role, atualizadoEm: new Date() }),
    );
    prismaMock.usuariosSessoes.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.cursosTurmasInscricoes.count
      .mockResolvedValueOnce(1) // ativas
      .mockResolvedValueOnce(2); // concluídas
    prismaMock.usuariosCurriculos.count.mockResolvedValue(1);
    prismaMock.empresasCandidatos.count.mockResolvedValue(3);
  });

  it('admin muda aluna para Setor de Vagas: encerra as sessões e registra o impacto', async () => {
    const r = await service.atualizarRole(
      ALUNA,
      'SETOR_DE_VAGAS',
      'Contratada pela Advance',
      ADMIN,
      {
        actorRole: Roles.ADMIN,
      },
    );

    expect(r).toMatchObject({ roleAnterior: 'ALUNO_CANDIDATO', role: 'SETOR_DE_VAGAS' });
    expect(prismaMock.usuarios.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'SETOR_DE_VAGAS', refreshToken: null } }),
    );
    expect(prismaMock.usuariosSessoes.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: ALUNA, revogadoEm: null },
      data: { revogadoEm: expect.any(Date) },
    });
    expect(recordUserAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USUARIO_ROLE_ALTERADA',
        meta: expect.objectContaining({
          motivo: 'Contratada pela Advance',
          sessoesEncerradas: true,
          impactoAluno: {
            role: 'ALUNO_CANDIDATO',
            inscricoesAtivas: 1,
            cursosConcluidos: 2,
            curriculos: 1,
            candidaturas: 3,
          },
        }),
      }),
    );
  });

  it('moderador também pode, mas não promove a admin', async () => {
    await expect(
      service.atualizarRole(ALUNA, 'SETOR_DE_VAGAS', 'Contratada', ADMIN, {
        actorRole: Roles.MODERADOR,
      }),
    ).resolves.toMatchObject({ role: 'SETOR_DE_VAGAS' });

    await expect(
      service.atualizarRole(ALUNA, 'ADMIN', 'x', ADMIN, { actorRole: Roles.MODERADOR }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_USER_ROLE' });
  });

  it('pedagógico não tira ninguém de aluno para Setor de Vagas', async () => {
    await expect(
      service.atualizarRole(ALUNA, 'SETOR_DE_VAGAS', 'x', ADMIN, { actorRole: Roles.PEDAGOGICO }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_USER_ROLE' });
    expect(prismaMock.usuarios.update).not.toHaveBeenCalled();
  });

  it('pessoa física não vira empresa', async () => {
    await expect(
      service.atualizarRole(ALUNA, 'EMPRESA', 'x', ADMIN, { actorRole: Roles.ADMIN }),
    ).rejects.toMatchObject({ code: 'INVALID_ROLE_FOR_USER_TYPE' });
  });

  it('impacto conta o que a pessoa tem como aluna', async () => {
    await expect(service.impactoTrocaDeFuncao(ALUNA)).resolves.toEqual({
      role: 'ALUNO_CANDIDATO',
      inscricoesAtivas: 1,
      cursosConcluidos: 2,
      curriculos: 1,
      candidaturas: 3,
    });
  });
});
