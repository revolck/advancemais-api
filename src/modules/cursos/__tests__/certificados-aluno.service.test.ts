import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { prisma } from '@/config/prisma';
import { certificadosService } from '../services/certificados.service';

const alunoId = '11111111-1111-1111-1111-111111111111';

const buildCertificado = (id: string, cursoId: string, turmaId: string) =>
  ({
    id,
    codigo: `CERT-${id}`,
    tipo: 'CONCLUSAO',
    formato: 'VERIFICAVEL',
    cargaHoraria: 20,
    assinaturaUrl: null,
    emitidoEm: new Date('2026-05-20T12:00:00.000Z'),
    observacoes: null,
    alunoCpf: null,
    Usuarios: null,
    CursosCertificadosLogs: [],
    CursosCertificadosConteudoProgramatico: null,
    CursosTurmasInscricoes: {
      id: `inscricao-${id}`,
      codigo: null,
      Usuarios: {
        id: alunoId,
        nomeCompleto: 'Aluno Real',
        email: 'aluno@email.com',
        cpf: null,
        UsuariosInformation: null,
      },
      CursosTurmas: {
        id: turmaId,
        nome: `Turma ${turmaId}`,
        codigo: null,
        dataInicio: null,
        dataFim: null,
        Cursos: {
          id: cursoId,
          nome: `Curso ${cursoId}`,
          codigo: null,
          cargaHoraria: 20,
        },
      },
    },
  }) as any;

describe('certificadosService.listarDoAlunoPaginado', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('pagina certificados do aluno e retorna opções independentes da página atual', async () => {
    const primeiro = buildCertificado('1', 'curso-1', 'turma-1');
    const segundo = buildCertificado('2', 'curso-2', 'turma-2');
    jest.spyOn(prisma.cursosCertificadosEmitidos, 'count').mockResolvedValue(1);
    jest
      .spyOn(prisma.cursosCertificadosEmitidos, 'findMany')
      .mockResolvedValueOnce([primeiro, segundo])
      .mockResolvedValueOnce([primeiro]);

    const result = await certificadosService.listarDoAlunoPaginado(alunoId, {
      emitidoDe: new Date('2026-05-20T00:00:00.000Z'),
      emitidoA: new Date('2026-05-20T00:00:00.000Z'),
      page: 1,
      pageSize: 1,
    });

    expect(result.data.items).toHaveLength(1);
    expect(result.data.pagination).toMatchObject({ total: 1, pageSize: 1 });
    expect(result.data.filters.cursos).toHaveLength(2);
    expect(result.data.filters.turmas).toHaveLength(2);
    const filterQuery = (prisma.cursosCertificadosEmitidos.findMany as jest.Mock).mock
      .calls[0][0] as any;
    expect(filterQuery.where).toEqual({ CursosTurmasInscricoes: { alunoId } });
    const pagedQuery = (prisma.cursosCertificadosEmitidos.findMany as jest.Mock).mock
      .calls[1][0] as any;
    expect(pagedQuery.where.emitidoEm).toEqual({
      gte: new Date('2026-05-20T00:00:00.000Z'),
      lte: new Date('2026-05-20T23:59:59.999Z'),
    });
  });
});
