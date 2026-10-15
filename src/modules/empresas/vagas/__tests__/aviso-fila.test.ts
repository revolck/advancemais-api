jest.mock('@/config/prisma', () => ({
  prisma: {
    empresasVagas: { count: jest.fn() },
    usuarios: { findMany: jest.fn() },
    notificacoes: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/config/prisma';
import { atualizarAvisoDaFila } from '../utils/avisos-vaga';

const db = prisma as any;
const nova = {
  id: 'v1',
  usuarioId: 'empresa-1',
  titulo: 'Faturista',
  empresaNome: 'Gestão de Pessoas',
};

beforeEach(() => {
  jest.clearAllMocks();
  db.usuarios.findMany.mockResolvedValue([{ id: 'setor-1' }, { id: 'mod-1' }, { id: 'admin-1' }]);
  db.notificacoes.findMany.mockResolvedValue([]);
  db.notificacoes.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: `n-${data.usuarioId}` }),
  );
});

describe('aviso da fila de aprovação para a equipe', () => {
  it('vaga nova na fila: um aviso para cada pessoa que aprova', async () => {
    db.empresasVagas.count.mockResolvedValue(1);
    await atualizarAvisoDaFila({ novaVaga: nova, motivo: 'CADASTRADA' });
    expect(db.usuarios.findMany).toHaveBeenCalledWith({
      where: { role: { in: ['SETOR_DE_VAGAS', 'MODERADOR', 'ADMIN'] }, status: 'ATIVO' },
      select: { id: true },
    });
    const criados = db.notificacoes.create.mock.calls.map((c: any) => c[0].data);
    expect(criados.map((d: any) => d.usuarioId)).toEqual(['setor-1', 'mod-1', 'admin-1']);
    expect(criados[0]).toMatchObject({
      tipo: 'VAGA_AGUARDANDO_APROVACAO',
      titulo: '1 vaga aguardando aprovação',
      mensagem: 'Nova na fila: "Faturista" (Gestão de Pessoas).',
      linkAcao: '/dashboard/empresas/solicitacoes',
    });
  });

  it('já tem aviso não lido: atualiza a contagem e sobe, sem criar outro', async () => {
    db.empresasVagas.count.mockResolvedValue(7);
    db.notificacoes.findMany.mockResolvedValue([{ id: 'n-setor', usuarioId: 'setor-1' }]);
    await atualizarAvisoDaFila({ novaVaga: nova, motivo: 'CADASTRADA' });
    expect(db.notificacoes.update).toHaveBeenCalledWith({
      where: { id: 'n-setor' },
      data: expect.objectContaining({
        titulo: '7 vagas aguardando aprovação',
        criadoEm: expect.any(Date),
      }),
    });
    const criadosPara = db.notificacoes.create.mock.calls.map((c: any) => c[0].data.usuarioId);
    expect(criadosPara).toEqual(['mod-1', 'admin-1']);
  });

  it('quem fez a ação não é avisado dela', async () => {
    db.empresasVagas.count.mockResolvedValue(1);
    await atualizarAvisoDaFila({ novaVaga: nova, motivo: 'ENVIADA', atorId: 'admin-1' });
    const criadosPara = db.notificacoes.create.mock.calls.map((c: any) => c[0].data.usuarioId);
    expect(criadosPara).toEqual(['setor-1', 'mod-1']);
  });

  it('aprovação/rejeição: só corrige a contagem dos avisos abertos', async () => {
    db.empresasVagas.count.mockResolvedValue(2);
    db.notificacoes.findMany.mockResolvedValue([{ id: 'n1', usuarioId: 'setor-1' }]);
    await atualizarAvisoDaFila({});
    expect(db.notificacoes.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({ titulo: '2 vagas aguardando aprovação' }),
    });
    expect(db.notificacoes.update.mock.calls[0][0].data).not.toHaveProperty('criadoEm');
    expect(db.notificacoes.create).not.toHaveBeenCalled();
  });

  it('fila vazia: aviso aberto é marcado como lido', async () => {
    db.empresasVagas.count.mockResolvedValue(0);
    db.notificacoes.findMany.mockResolvedValue([
      { id: 'n1', usuarioId: 'setor-1' },
      { id: 'n2', usuarioId: 'mod-1' },
    ]);
    await atualizarAvisoDaFila({});
    expect(db.notificacoes.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] } },
      data: { status: 'LIDA', lidaEm: expect.any(Date) },
    });
  });

  it('vaga editada que voltou para a fila tem mensagem própria', async () => {
    db.empresasVagas.count.mockResolvedValue(1);
    await atualizarAvisoDaFila({ novaVaga: nova, motivo: 'EDITADA' });
    expect(db.notificacoes.create.mock.calls[0][0].data.mensagem).toBe(
      'A vaga "Faturista" (Gestão de Pessoas) foi editada e voltou para aprovação.',
    );
  });

  it('falha no aviso de uma pessoa não deixa as outras sem aviso', async () => {
    db.empresasVagas.count.mockResolvedValue(1);
    db.notificacoes.create.mockRejectedValueOnce(new Error('falhou para o setor'));
    await atualizarAvisoDaFila({ novaVaga: nova, motivo: 'CADASTRADA' });
    expect(db.notificacoes.create).toHaveBeenCalledTimes(3);
  });

  it('falha no aviso não quebra quem chamou', async () => {
    db.empresasVagas.count.mockRejectedValue(new Error('banco fora'));
    await expect(atualizarAvisoDaFila({ novaVaga: nova })).resolves.toBeUndefined();
  });
});
