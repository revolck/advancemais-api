jest.mock('@/config/prisma', () => ({
  prisma: { $transaction: jest.fn(), usuarios: { findUnique: jest.fn() } },
}));
jest.mock('@/modules/email/services/email-service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({ sendAssinaturaNotificacao: jest.fn() })),
}));
jest.mock('@/modules/email/templates/email-templates', () => ({
  EmailTemplates: { generateUserBlockedEmail: jest.fn(() => ({})) },
}));
jest.mock('@/modules/usuarios/utils/cache', () => ({ invalidateUserCache: jest.fn() }));

import { prisma } from '@/config/prisma';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { aplicarBloqueioUsuario } from '../services/usuario-bloqueios.service';
import { adminAlunoBloqueioSchema } from '../validators/auth.schema';

const prismaMock = prisma as any;
const ADMIN = { id: 'admin-1', role: 'ADMIN' };
const MODERADOR = { id: 'mod-1', role: 'MODERADOR' };
const entrada = { tipo: 'PERMANENTE', motivo: 'OUTROS', observacoes: 'Saiu da empresa' } as any;

function montarTx(alvo: { id: string; role: string }, quemBloqueia: { id: string; role: string }) {
  const tx = {
    usuarios: {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce({ ...alvo, nomeCompleto: 'Pessoa', email: 'p@example.com' })
        .mockResolvedValueOnce(quemBloqueia),
      update: jest.fn(),
    },
    usuariosSessoes: { updateMany: jest.fn() },
    usuariosEmBloqueios: { create: jest.fn().mockResolvedValue({ id: 'b1' }) },
  };
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  prismaMock.usuarios.findUnique.mockResolvedValue(null); // sem e-mail no teste
  return tx;
}

describe('bloqueio de usuários pelo painel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('admin bloqueia moderador: status BLOQUEADO, sessões encerradas e cache limpo', async () => {
    const tx = montarTx({ id: 'alvo', role: 'MODERADOR' }, ADMIN);
    await aplicarBloqueioUsuario('alvo', ADMIN.id, entrada);

    expect(tx.usuarios.update).toHaveBeenCalledWith({
      where: { id: 'alvo' },
      data: { status: 'BLOQUEADO', refreshToken: null },
    });
    expect(tx.usuariosSessoes.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'alvo', revogadoEm: null },
      data: { revogadoEm: expect.any(Date) },
    });
    expect(invalidateUserCache).toHaveBeenCalledWith('alvo');
  });

  it('moderador não bloqueia administrador nem moderador', async () => {
    for (const role of ['ADMIN', 'MODERADOR']) {
      const tx = montarTx({ id: 'alvo', role }, MODERADOR);
      await expect(aplicarBloqueioUsuario('alvo', MODERADOR.id, entrada)).rejects.toMatchObject({
        code: 'FORBIDDEN_USER_ROLE',
      });
      expect(tx.usuarios.update).not.toHaveBeenCalled();
    }
  });

  it('moderador bloqueia recrutador normalmente', async () => {
    const tx = montarTx({ id: 'alvo', role: 'RECRUTADOR' }, MODERADOR);
    await aplicarBloqueioUsuario('alvo', MODERADOR.id, entrada);
    expect(tx.usuarios.update).toHaveBeenCalled();
  });

  it('ninguém bloqueia a própria conta', async () => {
    montarTx(ADMIN, ADMIN);
    await expect(aplicarBloqueioUsuario(ADMIN.id, ADMIN.id, entrada)).rejects.toMatchObject({
      code: 'FORBIDDEN_SELF_BLOCK',
    });
  });

  it('observação com menos de 3 caracteres é recusada com mensagem clara', () => {
    const r = adminAlunoBloqueioSchema.safeParse({ ...entrada, observacoes: '.' });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0].message).toBe(
      'Informe observações com pelo menos 3 caracteres',
    );
  });
});
