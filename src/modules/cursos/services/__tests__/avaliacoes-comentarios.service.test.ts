import { Roles, Status } from '@prisma/client';

const mockAvaliacaoFindUnique = jest.fn();
const mockEnvioFindFirst = jest.fn();
const mockRespostaFindFirst = jest.fn();
const mockInscricaoFindFirst = jest.fn();
const mockUsuariosFindMany = jest.fn();
const mockComentarioCreate = jest.fn();
const mockComentarioFindFirst = jest.fn();
const mockComentariosFindMany = jest.fn();
const mockComentariosUpdateMany = jest.fn();
const mockNotificacoesCreateMany = jest.fn();
const mockTransaction = jest.fn();
const mockAuditoria = jest.fn();

const tx = {
  cursosTurmasProvasComentarios: { create: mockComentarioCreate },
  notificacoes: { createMany: mockNotificacoesCreateMany },
};

jest.mock('@/config/prisma', () => ({
  prisma: {
    cursosTurmasProvas: { findUnique: mockAvaliacaoFindUnique },
    cursosTurmasProvasEnvios: { findFirst: mockEnvioFindFirst },
    cursosTurmasProvasRespostas: { findFirst: mockRespostaFindFirst },
    cursosTurmasInscricoes: { findFirst: mockInscricaoFindFirst },
    cursosTurmasProvasComentarios: {
      findFirst: mockComentarioFindFirst,
      findMany: mockComentariosFindMany,
      updateMany: mockComentariosUpdateMany,
    },
    usuarios: { findMany: mockUsuariosFindMany },
    $transaction: mockTransaction,
  },
}));

jest.mock('@/modules/auditoria/services/auditoria.service', () => ({
  auditoriaService: { registrarLog: mockAuditoria },
}));

import { avaliacoesComentariosService } from '../avaliacoes-comentarios.service';

const ids = {
  avaliacao: '11111111-1111-1111-1111-111111111111',
  curso: '22222222-2222-2222-2222-222222222222',
  turma: '33333333-3333-3333-3333-333333333333',
  envio: '44444444-4444-4444-4444-444444444444',
  inscricao: '55555555-5555-5555-5555-555555555555',
  aluno: '66666666-6666-6666-6666-666666666666',
  instrutorAvaliacao: '77777777-7777-7777-7777-777777777777',
  instrutorTurma: '88888888-8888-8888-8888-888888888888',
  instrutorAdicional: '99999999-9999-9999-9999-999999999999',
  pedagogico: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  admin: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  comentario: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
};

const usuarios = [
  { id: ids.aluno, role: Roles.ALUNO_CANDIDATO, status: Status.ATIVO },
  { id: ids.instrutorAvaliacao, role: Roles.INSTRUTOR, status: Status.ATIVO },
  { id: ids.instrutorTurma, role: Roles.INSTRUTOR, status: Status.ATIVO },
  { id: ids.instrutorAdicional, role: Roles.INSTRUTOR, status: Status.ATIVO },
  { id: ids.pedagogico, role: Roles.PEDAGOGICO, status: Status.ATIVO },
  { id: ids.admin, role: Roles.ADMIN, status: Status.ATIVO },
];

const matchesScope = (usuario: (typeof usuarios)[number], scope: Record<string, any>) => {
  if (scope.role && usuario.role !== scope.role) return false;
  if (typeof scope.id === 'string' && usuario.id !== scope.id) return false;
  if (scope.id?.in && !scope.id.in.includes(usuario.id)) return false;
  return true;
};

describe('avaliacoesComentariosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAvaliacaoFindUnique.mockResolvedValue({
      id: ids.avaliacao,
      cursoId: ids.curso,
      turmaId: ids.turma,
      instrutorId: ids.instrutorAvaliacao,
      titulo: 'Atividade de treinamento',
      tipo: 'ATIVIDADE',
      CursosTurmas: {
        cursoId: ids.curso,
        instrutorId: ids.instrutorTurma,
        CursosTurmasInstrutores: [
          { instrutorId: ids.instrutorAdicional },
          { instrutorId: ids.instrutorAvaliacao },
        ],
      },
    });
    mockEnvioFindFirst.mockResolvedValue({
      id: ids.envio,
      inscricaoId: ids.inscricao,
      CursosTurmasInscricoes: {
        alunoId: ids.aluno,
        turmaId: ids.turma,
        Usuarios: { nomeCompleto: 'Aluno Teste' },
      },
    });
    mockRespostaFindFirst.mockResolvedValue(null);
    mockInscricaoFindFirst.mockResolvedValue(null);
    mockUsuariosFindMany.mockImplementation(({ where }: { where: Record<string, any> }) =>
      usuarios
        .filter((usuario) => usuario.status === where.status)
        .filter((usuario) => usuario.id !== where.id?.not)
        .filter((usuario) =>
          where.OR.some((scope: Record<string, any>) => matchesScope(usuario, scope)),
        )
        .map(({ id, role }) => ({ id, role })),
    );
    mockComentarioCreate.mockImplementation(({ data }: { data: Record<string, any> }) => {
      const autor = usuarios.find((usuario) => usuario.id === data.autorId)!;
      return {
        id: ids.comentario,
        ...data,
        fixado: false,
        criadoEm: new Date('2026-08-24T15:00:00.000Z'),
        atualizadoEm: new Date('2026-08-24T15:00:00.000Z'),
        Autor: {
          id: autor.id,
          nomeCompleto:
            autor.role === Roles.ALUNO_CANDIDATO
              ? 'Aluno Teste'
              : autor.role === Roles.ADMIN
                ? 'Administrador Teste'
                : 'Instrutor Teste',
          role: autor.role,
          UsuariosInformation: null,
        },
      };
    });
    mockNotificacoesCreateMany.mockResolvedValue({ count: 1 });
    mockComentariosUpdateMany.mockResolvedValue({ count: 1 });
    mockTransaction.mockImplementation((callback) => callback(tx));
    mockAuditoria.mockResolvedValue(undefined);
  });

  const create = (id: string, role: Roles) =>
    avaliacoesComentariosService.create(
      ids.avaliacao,
      ids.envio,
      { conteudo: 'Novo comentário', parentId: null },
      { id, role },
    );

  const notificationData = () => mockNotificacoesCreateMany.mock.calls[0][0].data;

  it('notifica pedagógico e todos os instrutores vinculados quando o aluno comenta', async () => {
    await create(ids.aluno, Roles.ALUNO_CANDIDATO);

    expect(
      notificationData()
        .map((item: any) => item.usuarioId)
        .sort(),
    ).toEqual(
      [ids.instrutorAvaliacao, ids.instrutorTurma, ids.instrutorAdicional, ids.pedagogico].sort(),
    );
    expect(notificationData()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          usuarioId: ids.pedagogico,
          tipo: 'SISTEMA',
          linkAcao: `/dashboard/cursos/atividades-provas/${ids.avaliacao}/respostas/${ids.envio}`,
          dados: expect.objectContaining({ evento: 'AVALIACAO_RESPOSTA_COMENTARIO' }),
        }),
      ]),
    );
  });

  it('notifica aluno e pedagógico quando o instrutor comenta', async () => {
    await create(ids.instrutorAvaliacao, Roles.INSTRUTOR);

    expect(
      notificationData()
        .map((item: any) => item.usuarioId)
        .sort(),
    ).toEqual([ids.aluno, ids.pedagogico].sort());
    expect(notificationData()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          usuarioId: ids.aluno,
          linkAcao: `/dashboard/cursos/alunos/cursos/${ids.curso}/${ids.turma}/${ids.avaliacao}`,
        }),
      ]),
    );
  });

  it('notifica aluno, instrutores e pedagógico quando o administrador comenta', async () => {
    await create(ids.admin, Roles.ADMIN);

    expect(
      notificationData()
        .map((item: any) => item.usuarioId)
        .sort(),
    ).toEqual(
      [
        ids.aluno,
        ids.instrutorAvaliacao,
        ids.instrutorTurma,
        ids.instrutorAdicional,
        ids.pedagogico,
      ].sort(),
    );
    expect(notificationData().some((item: any) => item.usuarioId === ids.admin)).toBe(false);
  });

  it('pagina tópicos raiz sem separar as respostas e mapeia anexos', async () => {
    const autor = {
      id: ids.instrutorAvaliacao,
      nomeCompleto: 'Instrutor Teste',
      role: Roles.INSTRUTOR,
      UsuariosInformation: null,
    };
    const root = (id: string, hour: number) => ({
      id,
      provaId: ids.avaliacao,
      inscricaoId: ids.inscricao,
      envioId: ids.envio,
      parentId: null,
      autorId: ids.instrutorAvaliacao,
      conteudo: `Comentário ${id}`,
      anexos: null,
      fixado: false,
      deletedAt: null,
      criadoEm: new Date(`2026-08-24T${hour}:00:00.000Z`),
      atualizadoEm: new Date(`2026-08-24T${hour}:00:00.000Z`),
      Autor: autor,
    });
    const rootOne = root('10000000-0000-0000-0000-000000000001', 10);
    const rootTwo = root('10000000-0000-0000-0000-000000000002', 11);
    const rootThree = {
      ...root('10000000-0000-0000-0000-000000000003', 12),
      anexos: [
        {
          url: 'https://arquivos.example.com/evidencia.pdf',
          nome: 'evidencia.pdf',
          tipo: 'application/pdf',
          tamanho: 2048,
        },
      ],
    };
    const reply = {
      ...root('10000000-0000-0000-0000-000000000004', 13),
      parentId: rootOne.id,
    };
    mockComentariosFindMany.mockResolvedValue([rootOne, rootTwo, rootThree, reply]);

    const result = await avaliacoesComentariosService.list(
      ids.avaliacao,
      ids.envio,
      { filtro: 'PRINCIPAL', page: 2, pageSize: 2 },
      { id: ids.instrutorAvaliacao, role: Roles.INSTRUTOR },
    );

    expect(result.total).toBe(4);
    expect(result.pagination).toEqual(
      expect.objectContaining({
        page: 2,
        totalRoots: 3,
        hasMore: false,
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].anexos).toEqual([
      expect.objectContaining({ nome: 'evidencia.pdf', tamanho: 2048 }),
    ]);
  });

  it('exclui a árvore do comentário e retorna todos os anexos para remoção do blob', async () => {
    const childId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const unrelatedId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    const parentUrl = 'https://arquivos.public.blob.vercel-storage.com/comentario-pai.pdf';
    const childUrl = 'https://arquivos.public.blob.vercel-storage.com/resposta-filho.docx';

    mockComentarioFindFirst.mockResolvedValue({
      id: ids.comentario,
      autorId: ids.instrutorAvaliacao,
      conteudo: 'Comentário com arquivo',
      anexos: [
        { url: parentUrl, nome: 'comentario-pai.pdf', tipo: 'application/pdf', tamanho: 100 },
      ],
    });
    mockComentariosFindMany.mockResolvedValue([
      {
        id: ids.comentario,
        parentId: null,
        anexos: [
          { url: parentUrl, nome: 'comentario-pai.pdf', tipo: 'application/pdf', tamanho: 100 },
        ],
      },
      {
        id: childId,
        parentId: ids.comentario,
        anexos: [
          {
            url: childUrl,
            nome: 'resposta-filho.docx',
            tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            tamanho: 200,
          },
        ],
      },
      { id: unrelatedId, parentId: null, anexos: null },
    ]);

    const result = await avaliacoesComentariosService.remove(
      ids.avaliacao,
      ids.envio,
      ids.comentario,
      { id: ids.instrutorAvaliacao, role: Roles.INSTRUTOR },
    );

    expect(mockComentariosUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [ids.comentario, childId] } },
      data: { deletedAt: expect.any(Date), fixado: false },
    });
    expect(result).toEqual({
      success: true,
      deletedAttachmentUrls: [parentUrl, childUrl],
    });
  });
});
