jest.mock('@/config/prisma', () => ({
  prisma: { cursosTurmasInscricoes: { findFirst: jest.fn() } },
}));

import { prisma } from '@/config/prisma';
import { filtrarParaUsuario, podeVerLinksDaTurma, semDadosPrivados } from '../utils/links-privados';

const db = prisma as any;

const turma = () => ({
  id: 't1',
  nome: 'Turma Fiscal',
  criadoEm: new Date('2026-09-01T12:00:00Z'),
  instrutor: { id: 'i1', nome: 'Prof', email: 'prof@x.com', cpf: '11122233344' },
  alunos: [{ id: 'a1', nome: 'Ana', email: 'ana@x.com', telefone: '82999990000' }],
  modulos: [
    {
      aulas: [
        {
          id: 'au1',
          titulo: 'Aula 1',
          urlMeet: 'https://meet.google.com/abc-defg-hij',
          urlVideo: 'https://youtu.be/x',
          linkGravacao: 'https://drive/x',
          meetEventId: 'ev1',
          materiais: [{ id: 'm1', titulo: 'Apostila', url: 'https://blob/apostila.pdf' }],
        },
      ],
    },
  ],
  provas: [{ id: 'p1', titulo: 'Prova', meetUrl: 'https://meet.google.com/xyz' }],
});

beforeEach(() => jest.clearAllMocks());

describe('dados privados de turma e aulas', () => {
  it('rota pública: sem links das aulas e provas, sem URL de material e sem dados de pessoas', () => {
    const limpo: any = semDadosPrivados(turma(), { links: true, dadosPessoais: true });
    const aula = limpo.modulos[0].aulas[0];
    expect(aula).toEqual({
      id: 'au1',
      titulo: 'Aula 1',
      materiais: [{ id: 'm1', titulo: 'Apostila' }],
    });
    expect(limpo.provas[0]).toEqual({ id: 'p1', titulo: 'Prova' });
    expect(limpo.instrutor).toEqual({ id: 'i1', nome: 'Prof' });
    expect(limpo.alunos).toBeUndefined();
    // Datas continuam datas
    expect(limpo.criadoEm).toBeInstanceOf(Date);
  });

  it('aluno ativo: mantém os links, mas não os dados de pessoas', () => {
    const limpo: any = semDadosPrivados(turma(), { links: false, dadosPessoais: true });
    expect(limpo.modulos[0].aulas[0].urlMeet).toContain('meet.google.com');
    expect(limpo.modulos[0].aulas[0].materiais[0].url).toContain('apostila');
    expect(limpo.instrutor.cpf).toBeUndefined();
  });

  it('não altera o objeto original', () => {
    const original = turma();
    semDadosPrivados(original, { links: true, dadosPessoais: true });
    expect(original.modulos[0].aulas[0].urlMeet).toBeDefined();
  });

  it('quem vê os links: equipe e instrutor sempre; aluno só com matrícula ativa e paga', async () => {
    expect(await podeVerLinksDaTurma(undefined, 't1')).toBe(false);
    expect(await podeVerLinksDaTurma({ id: 'x', role: 'EMPRESA' }, 't1')).toBe(false);
    expect(await podeVerLinksDaTurma({ id: 'x', role: 'PEDAGOGICO' }, 't1')).toBe(true);
    expect(await podeVerLinksDaTurma({ id: 'x', role: 'INSTRUTOR' }, 't1')).toBe(true);

    db.cursosTurmasInscricoes.findFirst.mockResolvedValueOnce(null);
    expect(await podeVerLinksDaTurma({ id: 'a9', role: 'ALUNO_CANDIDATO' }, 't1')).toBe(false);
    expect(db.cursosTurmasInscricoes.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        turmaId: 't1',
        alunoId: 'a9',
        statusPagamento: 'APROVADO',
        removidaEm: null,
      }),
      select: { id: true },
    });

    db.cursosTurmasInscricoes.findFirst.mockResolvedValueOnce({ id: 'i1' });
    expect(await podeVerLinksDaTurma({ id: 'a1', role: 'ALUNO_CANDIDATO' }, 't1')).toBe(true);
  });

  it('anônimo recebe a turma sem links; equipe recebe tudo', async () => {
    const anonimo: any = await filtrarParaUsuario(turma(), undefined, 't1');
    expect(anonimo.modulos[0].aulas[0].urlMeet).toBeUndefined();
    expect(anonimo.alunos).toBeUndefined();

    const equipe: any = await filtrarParaUsuario(turma(), { id: 'adm', role: 'ADMIN' }, 't1');
    expect(equipe.modulos[0].aulas[0].urlMeet).toBeDefined();
    expect(equipe.alunos).toHaveLength(1);
  });
});
