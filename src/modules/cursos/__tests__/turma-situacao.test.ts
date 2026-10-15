jest.mock('@/config/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    cursosTurmas: { findFirst: jest.fn() },
    cursosTurmasInscricoes: { findMany: jest.fn() },
  },
}));
jest.mock('@/utils/cache', () => ({
  invalidateCacheByPrefix: jest.fn().mockResolvedValue(undefined),
  getCachedOrFetch: jest.fn(),
  generateCacheKey: jest.fn(),
}));
jest.mock('../utils/code-generator', () => ({
  generateUniqueCertificateCode: jest.fn().mockResolvedValue('CERT-TESTE-1'),
}));

import { prisma } from '@/config/prisma';
import { certificadosService } from '../services/certificados.service';
import {
  alterarSituacaoEmLote,
  planejarSituacao,
  type InscricaoParaSituacao,
} from '../services/inscricoes-situacao.service';

const db = prisma as any;
const CURSO = 'c1';
const TURMA = 't1';
const ATOR = { id: 'admin-1', role: 'ADMIN' };

const inscricao = (
  id: string,
  cpf: string,
  status: any = 'CONCLUIDO',
  certificados: InscricaoParaSituacao['certificados'] = [
    { id: `cert-${id}`, formato: 'DIGITAL' as any, revogadoEm: null },
  ],
): InscricaoParaSituacao => ({ id, status, cpf, certificados });

const turma = [
  inscricao('i1', '111.111.111-11'),
  inscricao('i2', '22222222222'),
  inscricao('i3', '33333333333'),
  inscricao('i4', '44444444444', 'INSCRITO', []),
];

describe('planejar a situação em lote', () => {
  it('lista de CPFs "não concluiu": revoga os certificados e aponta CPF não encontrado', () => {
    const plano = planejarSituacao(turma, {
      cpfs: ['111.111.111-11', '22222222222', '99999999999', '123'],
      situacao: 'NAO_CONCLUIU',
    });
    expect(plano.novoStatus).toBe('CANCELADO');
    expect(plano.resumo).toMatchObject({
      selecionados: 2,
      atingidos: 2,
      mudam: 2,
      certificadosARevogar: 2,
      naoEncontrados: ['99999999999'],
      cpfsInvalidos: ['123'],
    });
  });

  it('"só estes concluíram": os demais da turma é que mudam', () => {
    const plano = planejarSituacao(turma, {
      cpfs: ['11111111111', '22222222222'],
      aplicarAosDemais: true,
      situacao: 'NAO_CONCLUIU',
    });
    expect(plano.alvo.map((i) => i.id)).toEqual(['i3', 'i4']);
    expect(plano.resumo.certificadosARevogar).toBe(1);
  });

  it('voltar para "concluiu" restaura o certificado revogado (mesmo código)', () => {
    const revogado = inscricao('i9', '55555555555', 'CANCELADO', [
      { id: 'cert-i9', formato: 'DIGITAL' as any, revogadoEm: new Date() },
    ]);
    const plano = planejarSituacao([revogado], { inscricaoIds: ['i9'], situacao: 'CONCLUIU' });
    expect(plano.resumo).toMatchObject({ certificadosARestaurar: 1, certificadosARevogar: 0 });
  });

  it('concluintes sem certificado são contados para emitir depois', () => {
    const plano = planejarSituacao(turma, { inscricaoIds: ['i4'], situacao: 'CONCLUIU' });
    expect(plano.resumo.concluintesSemCertificado).toBe(1);
  });

  it('ids de outra turma são ignorados', () => {
    expect(planejarSituacao(turma, { inscricaoIds: ['x'], situacao: 'CONCLUIU' }).alvo).toEqual([]);
  });
});

describe('aplicar a situação em lote', () => {
  const tx = {
    cursosTurmasInscricoes: { updateMany: jest.fn() },
    cursosCertificadosEmitidos: { updateMany: jest.fn() },
    cursosCertificadosLogs: { createMany: jest.fn() },
    auditoriaLogs: { createMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db.cursosTurmas.findFirst.mockResolvedValue({ id: TURMA, nome: 'Turma' });
    db.cursosTurmasInscricoes.findMany.mockResolvedValue(
      turma.map((i) => ({
        id: i.id,
        status: i.status,
        Usuarios: { cpf: i.cpf },
        CursosCertificadosEmitidos: i.certificados,
      })),
    );
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  });

  it('prévia não grava nada', async () => {
    const r = await alterarSituacaoEmLote(
      {
        cursoId: CURSO,
        turmaId: TURMA,
        cpfs: ['11111111111'],
        situacao: 'NAO_CONCLUIU',
        motivo: 'Não concluiu na plataforma antiga',
        simular: true,
      },
      ATOR,
    );
    expect(r).toMatchObject({ aplicado: false, atingidos: 1, certificadosARevogar: 1 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('aplica: muda a situação, revoga certificado, registra no histórico e na auditoria', async () => {
    const r = await alterarSituacaoEmLote(
      {
        cursoId: CURSO,
        turmaId: TURMA,
        cpfs: ['11111111111'],
        situacao: 'NAO_CONCLUIU',
        motivo: 'Não concluiu na plataforma antiga',
        totalEsperado: 1,
      },
      ATOR,
    );
    expect(r).toMatchObject({ aplicado: true, mudam: 1 });
    expect(tx.cursosTurmasInscricoes.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['i1'] }, turmaId: TURMA },
      data: { status: 'CANCELADO' },
    });
    expect(tx.cursosCertificadosEmitidos.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['cert-i1'] }, revogadoEm: null },
      data: {
        revogadoEm: expect.any(Date),
        revogadoPorId: 'admin-1',
        motivoRevogacao: 'Não concluiu na plataforma antiga',
      },
    });
    expect(tx.cursosCertificadosLogs.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ certificadoId: 'cert-i1', acao: 'REVOGACAO' })],
    });
    expect(tx.auditoriaLogs.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          acao: 'INSCRICAO_SITUACAO_ALTERADA',
          entidadeId: 'i1',
          dadosAnteriores: { status: 'CONCLUIDO' },
          dadosNovos: { status: 'CANCELADO' },
        }),
      ],
    });
  });

  it('se a turma mudou depois da prévia, pede nova prévia', async () => {
    await expect(
      alterarSituacaoEmLote(
        {
          cursoId: CURSO,
          turmaId: TURMA,
          cpfs: ['11111111111'],
          situacao: 'NAO_CONCLUIU',
          motivo: 'motivo',
          totalEsperado: 5,
        },
        ATOR,
      ),
    ).rejects.toMatchObject({ code: 'SITUACAO_ALVO_MUDOU', statusCode: 409 });
  });

  it('CPF que não é da turma: nenhum aluno atingido', async () => {
    await expect(
      alterarSituacaoEmLote(
        {
          cursoId: CURSO,
          turmaId: TURMA,
          cpfs: ['99999999999'],
          situacao: 'CONCLUIU',
          motivo: 'x x',
        },
        ATOR,
      ),
    ).rejects.toMatchObject({ code: 'SITUACAO_SEM_ALUNOS' });
  });
});

describe('certificado é só de quem concluiu', () => {
  function emissaoComInscricao(status: string, certificadoAtivo: boolean) {
    const tx = {
      cursosTurmas: { findFirst: jest.fn().mockResolvedValue({ id: TURMA }) },
      cursosTurmasInscricoes: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'i1',
          status,
          Usuarios: { id: 'a1', nomeCompleto: 'Aluno', email: 'a@x.com', cpf: '111' },
          CursosTurmas: {
            id: TURMA,
            nome: 'Turma',
            codigo: 'T1',
            Cursos: {
              id: CURSO,
              nome: 'Curso',
              codigo: 'C1',
              estagioObrigatorio: false,
              cargaHoraria: 40,
            },
          },
        }),
        update: jest.fn(),
      },
      cursosCertificadosEmitidos: {
        findFirst: jest.fn().mockResolvedValue(certificadoAtivo ? { id: 'c-ativo' } : null),
        create: jest.fn().mockResolvedValue({ id: 'novo' }),
        findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('fim do teste')),
      },
    };
    db.cursosTurmas.findFirst.mockResolvedValue({ id: TURMA });
    db.cursosTurmasInscricoes.findMany.mockResolvedValue([{ id: 'i1' }]);
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    return tx;
  }

  beforeEach(() => jest.clearAllMocks());

  it('não emite para quem está como "não concluiu" (cancelado)', async () => {
    const tx = emissaoComInscricao('CANCELADO', false);
    const r = await certificadosService.emitirParaConcluintes(CURSO, TURMA, {}, 'admin-1');
    expect(r.falhas).toEqual([expect.objectContaining({ codigo: 'INSCRICAO_NAO_ELEGIVEL' })]);
    expect(tx.cursosCertificadosEmitidos.create).not.toHaveBeenCalled();
  });

  it('não emite certificado duplicado', async () => {
    const tx = emissaoComInscricao('CONCLUIDO', true);
    const r = await certificadosService.emitirParaConcluintes(CURSO, TURMA, {}, 'admin-1');
    expect(r.falhas).toEqual([expect.objectContaining({ codigo: 'CERTIFICADO_JA_EXISTE' })]);
    expect(tx.cursosCertificadosEmitidos.create).not.toHaveBeenCalled();
  });

  it('quem recebe certificado fica como concluído', async () => {
    const tx = emissaoComInscricao('INSCRITO', false);
    await certificadosService.emitirParaConcluintes(CURSO, TURMA, {}, 'admin-1');
    expect(tx.cursosCertificadosEmitidos.create).toHaveBeenCalled();
    expect(tx.cursosTurmasInscricoes.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { status: 'CONCLUIDO' },
    });
  });

  it('prévia da emissão só conta os pendentes', async () => {
    db.cursosTurmas.findFirst.mockResolvedValue({ id: TURMA });
    db.cursosTurmasInscricoes.findMany.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }]);
    await expect(
      certificadosService.emitirParaConcluintes(CURSO, TURMA, { simular: true }),
    ).resolves.toMatchObject({ pendentes: 2, emitidos: 0, restantes: 2 });
  });
});
