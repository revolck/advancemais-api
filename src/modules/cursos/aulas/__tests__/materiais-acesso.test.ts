jest.mock('@/config/prisma', () => ({
  prisma: {
    cursosTurmasAulas: { findUnique: jest.fn() },
    cursosTurmasInscricoes: { findFirst: jest.fn() },
    cursosTurmasAulasMateriais: { findMany: jest.fn(), findFirst: jest.fn() },
  },
}));
jest.mock('@/modules/configuracoes-gerais', () => ({ runtimeConfigService: {} }));

import { prisma } from '@/config/prisma';
import { garantirAcessoAosMateriais, materiaisService } from '../services/materiais.service';

const db = prisma as any;

const aula = (extra: Record<string, unknown> = {}) => ({
  turmaId: 't1',
  instrutorId: 'inst-aula',
  criadoPorId: null,
  deletedAt: null,
  CursosTurmas: { instrutorId: 'inst-turma', CursosTurmasInstrutores: [{ instrutorId: 'co' }] },
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  db.cursosTurmasAulas.findUnique.mockResolvedValue(aula());
});

describe('acesso aos materiais da aula', () => {
  it('equipe sempre acessa', async () => {
    await expect(garantirAcessoAosMateriais('au1', { id: 'x', role: 'MODERADOR' })).resolves.toBe(
      undefined,
    );
    expect(db.cursosTurmasAulas.findUnique).not.toHaveBeenCalled();
  });

  it('instrutor da aula, da turma ou co-instrutor acessa; outro instrutor não', async () => {
    for (const id of ['inst-aula', 'inst-turma', 'co']) {
      await expect(garantirAcessoAosMateriais('au1', { id, role: 'INSTRUTOR' })).resolves.toBe(
        undefined,
      );
    }
    await expect(
      garantirAcessoAosMateriais('au1', { id: 'outro', role: 'INSTRUTOR' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('aluno precisa de matrícula ativa e paga na turma da aula', async () => {
    db.cursosTurmasInscricoes.findFirst.mockResolvedValueOnce({ id: 'i1' });
    await expect(
      garantirAcessoAosMateriais('au1', { id: 'a1', role: 'ALUNO_CANDIDATO' }),
    ).resolves.toBe(undefined);
    expect(db.cursosTurmasInscricoes.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        turmaId: 't1',
        alunoId: 'a1',
        statusPagamento: 'APROVADO',
        removidaEm: null,
        status: { in: ['INSCRITO', 'EM_ANDAMENTO', 'EM_ESTAGIO', 'CONCLUIDO'] },
      }),
      select: { id: true },
    });

    // Removido, não concluiu ou de outra turma: sem acesso
    db.cursosTurmasInscricoes.findFirst.mockResolvedValueOnce(null);
    await expect(
      garantirAcessoAosMateriais('au1', { id: 'a2', role: 'ALUNO_CANDIDATO' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('outros perfis e aula apagada não acessam', async () => {
    await expect(
      garantirAcessoAosMateriais('au1', { id: 'e1', role: 'EMPRESA' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    db.cursosTurmasAulas.findUnique.mockResolvedValueOnce(aula({ deletedAt: new Date() }));
    await expect(
      garantirAcessoAosMateriais('au1', { id: 'a1', role: 'ALUNO_CANDIDATO' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.cursosTurmasInscricoes.findFirst).not.toHaveBeenCalled();
  });

  it('listar e gerar o link de download passam pela mesma regra', async () => {
    db.cursosTurmasInscricoes.findFirst.mockResolvedValue(null);
    await expect(
      materiaisService.list('au1', { id: 'a2', role: 'ALUNO_CANDIDATO' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      materiaisService.gerarTokenDownload('au1', 'm1', { id: 'a2', role: 'ALUNO_CANDIDATO' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.cursosTurmasAulasMateriais.findMany).not.toHaveBeenCalled();
    expect(db.cursosTurmasAulasMateriais.findFirst).not.toHaveBeenCalled();
  });
});
