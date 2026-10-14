jest.mock('@/config/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    usuarios: { findUnique: jest.fn() },
    empresasPlano: { findFirst: jest.fn() },
  },
  retryOperation: (fn: () => unknown) => fn(),
}));

import { prisma } from '@/config/prisma';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import { LimiteVagasPlanoAtingidoError } from '@/modules/empresas/vagas/services/errors';
import { adminEmpresasService } from '../services/admin-empresas.service';

const db = prisma as any;
const EMPRESA = 'e1';

const contrato = (quantidadeVagas: number) => ({
  id: 'contrato-1',
  usuarioId: EMPRESA,
  modo: 'TESTE',
  status: 'ATIVO',
  PlanosEmpresariais: {
    id: 'plano-catalogo',
    nome: 'Inicial',
    quantidadeVagas,
    vagaEmDestaque: false,
  },
});

function montarTx(publicadas: number[]) {
  const contagens = [...publicadas];
  const tx = {
    usuarios: {
      findUnique: jest.fn().mockResolvedValue({ id: EMPRESA, tipoUsuario: 'PESSOA_JURIDICA' }),
    },
    empresasVagas: {
      findFirst: jest.fn().mockResolvedValue({ id: 'v9', status: 'EM_ANALISE', inseridaEm: null }),
      count: jest.fn(() => Promise.resolve(contagens.shift() ?? 0)),
      update: jest.fn().mockResolvedValue({ id: 'v9', status: 'PUBLICADO' }),
      updateMany: jest.fn(),
    },
    empresasRecursosPremiumVagas: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  return tx;
}

describe('limite de vagas do plano na aprovação', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.usuarios.findUnique.mockResolvedValue({ tipoUsuario: 'PESSOA_JURIDICA' });
  });

  it('plano ativo vem como contrato da empresa, com o plano dentro', async () => {
    db.empresasPlano.findFirst.mockResolvedValue(contrato(3));
    const plano = await clientesService.findActiveByUsuario(EMPRESA);
    expect(plano?.id).toBe('contrato-1');
    expect(plano?.PlanosEmpresariais?.quantidadeVagas).toBe(3);
  });

  it('com 3 de 3 vagas publicadas, a aprovação é recusada', async () => {
    db.empresasPlano.findFirst.mockResolvedValue(contrato(3));
    const tx = montarTx([3]);
    await expect(adminEmpresasService.approveVaga(EMPRESA, 'v9')).rejects.toBeInstanceOf(
      LimiteVagasPlanoAtingidoError,
    );
    expect(tx.empresasVagas.update).not.toHaveBeenCalled();
  });

  it('com vaga livre, publica; se atingir o limite, as outras em análise voltam a rascunho', async () => {
    db.empresasPlano.findFirst.mockResolvedValue(contrato(3));
    const tx = montarTx([2, 3]);
    await adminEmpresasService.approveVaga(EMPRESA, 'v9');
    expect(tx.empresasVagas.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLICADO' }) }),
    );
    expect(tx.empresasVagas.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: EMPRESA, status: 'EM_ANALISE' },
      data: { status: 'RASCUNHO' },
    });
  });

  it('sem plano ativo não aplica limite (a criação da vaga já exige plano)', async () => {
    db.empresasPlano.findFirst.mockResolvedValue(null);
    const tx = montarTx([10]);
    await adminEmpresasService.approveVaga(EMPRESA, 'v9');
    expect(tx.empresasVagas.update).toHaveBeenCalled();
  });
});
