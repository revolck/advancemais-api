const mockUsuariosFindMany = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: { findMany: mockUsuariosFindMany },
  },
}));

jest.mock('@/modules/brevo/services/email-service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({ sendGeneric: jest.fn() })),
}));

import { notificacoesHelper } from '../notificacoes-helper.service';

describe('notificacoesHelper.notificarEquipeDaTurma', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(notificacoesHelper, 'criar').mockResolvedValue({ id: 'notif-1' } as any);
    jest.spyOn(notificacoesHelper, 'enviarEmailCritico').mockResolvedValue(undefined as any);
  });

  it('notifica gestores (ADMIN/MODERADOR/PEDAGOGICO) e instrutores da turma sem duplicar', async () => {
    mockUsuariosFindMany
      .mockResolvedValueOnce([
        { id: 'admin-1', nomeCompleto: 'Admin Um', email: 'admin1@x.com' },
        { id: 'instrutor-1', nomeCompleto: 'Instrutor Também Admin', email: 'i1@x.com' }, // caso raro: mesmo id nas duas listas
      ])
      .mockResolvedValueOnce([
        { id: 'instrutor-1', nomeCompleto: 'Instrutor Também Admin', email: 'i1@x.com' },
        { id: 'instrutor-2', nomeCompleto: 'Instrutor Dois', email: 'i2@x.com' },
      ]);

    const resultado = await notificacoesHelper.notificarEquipeDaTurma({
      turmaId: 'turma-1',
      instrutorIds: ['instrutor-1', 'instrutor-2'],
      tipo: 'TURMA_FREQUENCIA_ALERTA',
      titulo: 'Título',
      mensagem: 'Mensagem',
      prioridade: 'ALTA',
      linkAcao: '/dashboard/turma/turma-1/alerta/tok',
      eventoId: 'evento-1',
    });

    // 3 destinatários únicos: admin-1, instrutor-1, instrutor-2 (deduplicado)
    expect(resultado.notificados).toBe(3);
    expect(notificacoesHelper.criar).toHaveBeenCalledTimes(3);
    expect(notificacoesHelper.enviarEmailCritico).toHaveBeenCalledTimes(3);
  });

  it('não consulta instrutores quando instrutorIds está vazio', async () => {
    mockUsuariosFindMany.mockResolvedValueOnce([]);

    await notificacoesHelper.notificarEquipeDaTurma({
      turmaId: 'turma-1',
      instrutorIds: [],
      tipo: 'TURMA_FREQUENCIA_ALERTA',
      titulo: 'Título',
      mensagem: 'Mensagem',
      linkAcao: '/dashboard/turma/turma-1/alerta/tok',
      eventoId: 'evento-1',
    });

    expect(mockUsuariosFindMany).toHaveBeenCalledTimes(1);
  });

  it('não envia email se a notificação já existia (dedup do criar)', async () => {
    jest.spyOn(notificacoesHelper, 'criar').mockResolvedValue(null);
    mockUsuariosFindMany.mockResolvedValueOnce([
      { id: 'admin-1', nomeCompleto: 'Admin Um', email: 'admin1@x.com' },
    ]);

    await notificacoesHelper.notificarEquipeDaTurma({
      turmaId: 'turma-1',
      instrutorIds: [],
      tipo: 'TURMA_FREQUENCIA_ALERTA',
      titulo: 'Título',
      mensagem: 'Mensagem',
      linkAcao: '/dashboard/turma/turma-1/alerta/tok',
      eventoId: 'evento-1',
    });

    expect(notificacoesHelper.enviarEmailCritico).not.toHaveBeenCalled();
  });
});
