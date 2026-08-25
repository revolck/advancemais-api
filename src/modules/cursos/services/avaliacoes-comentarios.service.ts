import { AuditoriaCategoria, Prisma, Roles, Status } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { auditoriaService } from '@/modules/auditoria/services/auditoria.service';

import type {
  CreateAvaliacaoRespostaComentarioInput,
  FixarAvaliacaoRespostaComentarioInput,
  ListAvaliacaoRespostaComentariosQuery,
  UpdateAvaliacaoRespostaComentarioInput,
} from '../validators/avaliacoes-respostas.schema';

type UsuarioLogado = {
  id?: string;
  role?: string;
};

type RequestMetadata = {
  ip?: string;
  userAgent?: string;
};

type ComentarioDb = Prisma.CursosTurmasProvasComentariosGetPayload<{
  include: {
    Autor: {
      select: {
        id: true;
        nomeCompleto: true;
        role: true;
        UsuariosInformation: { select: { avatarUrl: true } };
      };
    };
  };
}>;

type ComentarioDto = {
  id: string;
  parentId: string | null;
  conteudo: string;
  anexos: ComentarioAnexoDto[];
  fixado: boolean;
  criadoEm: string | null;
  atualizadoEm: string | null;
  autor: {
    id: string;
    nome: string;
    role: Roles;
    avatarUrl: string | null;
  };
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  replies: ComentarioDto[];
};

type ComentarioAnexoDto = {
  url: string;
  nome: string;
  tipo: string;
  tamanho: number;
};

const INTERNAL_ROLES = new Set<string>([
  Roles.ADMIN,
  Roles.MODERADOR,
  Roles.PEDAGOGICO,
  Roles.INSTRUTOR,
]);

const ADMINISTRATIVE_ROLES = new Set<string>([Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO]);

const toIso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

const normalizeAnexos = (value: Prisma.JsonValue | null | undefined): ComentarioAnexoDto[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const anexo = item as Record<string, Prisma.JsonValue>;
    if (
      typeof anexo.url !== 'string' ||
      typeof anexo.nome !== 'string' ||
      typeof anexo.tipo !== 'string' ||
      typeof anexo.tamanho !== 'number'
    ) {
      return [];
    }

    return [
      {
        url: anexo.url,
        nome: anexo.nome,
        tipo: anexo.tipo,
        tamanho: anexo.tamanho,
      },
    ];
  });
};

const forbidden = (message: string) => {
  const error = new Error(message);
  (error as any).code = 'FORBIDDEN';
  return error;
};

const notFound = (message: string) => {
  const error = new Error(message);
  (error as any).code = 'RESPOSTA_NOT_FOUND';
  return error;
};

const comentarioNotFound = () => {
  const error = new Error('Comentário não encontrado');
  (error as any).code = 'COMENTARIO_NOT_FOUND';
  return error;
};

const isInternalRole = (role?: string) => Boolean(role && INTERNAL_ROLES.has(role));
const isAdministrativeRole = (role?: string) => Boolean(role && ADMINISTRATIVE_ROLES.has(role));

const resolveComentarioContext = async (
  avaliacaoId: string,
  respostaId: string,
  usuarioLogado: UsuarioLogado,
) => {
  const avaliacao = await prisma.cursosTurmasProvas.findUnique({
    where: { id: avaliacaoId },
    select: {
      id: true,
      cursoId: true,
      turmaId: true,
      instrutorId: true,
      titulo: true,
      tipo: true,
      CursosTurmas: {
        select: {
          cursoId: true,
          instrutorId: true,
          CursosTurmasInstrutores: { select: { instrutorId: true } },
        },
      },
    },
  });

  if (!avaliacao || !avaliacao.turmaId) {
    throw notFound('Avaliação sem turma não possui respostas');
  }

  let inscricaoId: string | null = null;
  let alunoId: string | null = null;
  let alunoNome: string | null = null;
  let envioId: string | null = null;

  if (respostaId === 'me') {
    if (usuarioLogado.role !== Roles.ALUNO_CANDIDATO || !usuarioLogado.id) {
      throw forbidden('Apenas aluno pode usar o identificador da própria resposta');
    }

    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: {
        turmaId: avaliacao.turmaId,
        alunoId: usuarioLogado.id,
        OR: [
          { CursosTurmasProvasEnvios: { some: { provaId: avaliacaoId } } },
          {
            CursosTurmasProvasRespostas: {
              some: { CursosTurmasProvasQuestoes: { provaId: avaliacaoId } },
            },
          },
        ],
      },
      select: {
        id: true,
        alunoId: true,
        Usuarios: { select: { nomeCompleto: true } },
        CursosTurmasProvasEnvios: {
          where: { provaId: avaliacaoId },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (inscricao) {
      inscricaoId = inscricao.id;
      alunoId = inscricao.alunoId;
      alunoNome = inscricao.Usuarios.nomeCompleto;
      envioId = inscricao.CursosTurmasProvasEnvios[0]?.id ?? null;
    }
  }

  if (!inscricaoId && respostaId !== 'me') {
    const envioById = await prisma.cursosTurmasProvasEnvios.findFirst({
      where: { id: respostaId, provaId: avaliacaoId },
      select: {
        id: true,
        inscricaoId: true,
        CursosTurmasInscricoes: {
          select: {
            alunoId: true,
            turmaId: true,
            Usuarios: { select: { nomeCompleto: true } },
          },
        },
      },
    });

    if (envioById) {
      envioId = envioById.id;
      inscricaoId = envioById.inscricaoId;
      alunoId = envioById.CursosTurmasInscricoes.alunoId;
      alunoNome = envioById.CursosTurmasInscricoes.Usuarios.nomeCompleto;
    }
  }

  if (!inscricaoId && respostaId !== 'me') {
    const respostaQuestao = await prisma.cursosTurmasProvasRespostas.findFirst({
      where: {
        id: respostaId,
        CursosTurmasProvasQuestoes: { provaId: avaliacaoId },
        CursosTurmasInscricoes: { turmaId: avaliacao.turmaId },
      },
      select: {
        inscricaoId: true,
        envioId: true,
        CursosTurmasInscricoes: {
          select: {
            alunoId: true,
            Usuarios: { select: { nomeCompleto: true } },
          },
        },
      },
    });

    if (respostaQuestao) {
      envioId = respostaQuestao.envioId;
      inscricaoId = respostaQuestao.inscricaoId;
      alunoId = respostaQuestao.CursosTurmasInscricoes.alunoId;
      alunoNome = respostaQuestao.CursosTurmasInscricoes.Usuarios.nomeCompleto;
    }
  }

  if (!inscricaoId && respostaId !== 'me') {
    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: {
        id: respostaId,
        turmaId: avaliacao.turmaId,
        OR: [
          { CursosTurmasProvasEnvios: { some: { provaId: avaliacaoId } } },
          {
            CursosTurmasProvasRespostas: {
              some: { CursosTurmasProvasQuestoes: { provaId: avaliacaoId } },
            },
          },
        ],
      },
      select: {
        id: true,
        alunoId: true,
        Usuarios: { select: { nomeCompleto: true } },
        CursosTurmasProvasEnvios: {
          where: { provaId: avaliacaoId },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (inscricao) {
      inscricaoId = inscricao.id;
      alunoId = inscricao.alunoId;
      alunoNome = inscricao.Usuarios.nomeCompleto;
      envioId = inscricao.CursosTurmasProvasEnvios[0]?.id ?? null;
    }
  }

  if (!inscricaoId || !alunoId) {
    throw notFound('Resposta não encontrada para a avaliação informada');
  }

  const userRole = usuarioLogado.role;
  const userId = usuarioLogado.id;
  const instrutorVinculado =
    userRole === Roles.INSTRUTOR &&
    Boolean(
      userId &&
        (avaliacao.instrutorId === userId ||
          avaliacao.CursosTurmas?.instrutorId === userId ||
          avaliacao.CursosTurmas?.CursosTurmasInstrutores.some(
            (vinculo) => vinculo.instrutorId === userId,
          )),
    );
  const alunoDono = userRole === Roles.ALUNO_CANDIDATO && userId === alunoId;
  const equipeGlobal = isAdministrativeRole(userRole);

  if (!equipeGlobal && !instrutorVinculado && !alunoDono) {
    throw forbidden('Sem permissão para acessar os comentários desta resposta');
  }

  return {
    avaliacao,
    inscricaoId,
    alunoId,
    alunoNome: alunoNome ?? 'Aluno',
    envioId,
  };
};

type ComentarioContext = Awaited<ReturnType<typeof resolveComentarioContext>>;

const resolveNotificacaoDestinatarios = async (
  context: ComentarioContext,
  usuarioLogado: UsuarioLogado,
) => {
  const autorId = usuarioLogado.id!;
  const autorRole = usuarioLogado.role;
  const instrutorIds = new Set(
    [
      context.avaliacao.instrutorId,
      context.avaliacao.CursosTurmas?.instrutorId,
      ...(context.avaliacao.CursosTurmas?.CursosTurmasInstrutores.map(
        (vinculo) => vinculo.instrutorId,
      ) ?? []),
    ].filter((id): id is string => Boolean(id)),
  );

  const recipientScopes: Prisma.UsuariosWhereInput[] = [{ role: Roles.PEDAGOGICO }];

  if (autorRole !== Roles.ALUNO_CANDIDATO) {
    recipientScopes.push({ id: context.alunoId, role: Roles.ALUNO_CANDIDATO });
  }

  if (autorRole !== Roles.INSTRUTOR && instrutorIds.size > 0) {
    recipientScopes.push({
      id: { in: Array.from(instrutorIds) },
      role: Roles.INSTRUTOR,
    });
  }

  return prisma.usuarios.findMany({
    where: {
      id: { not: autorId },
      status: Status.ATIVO,
      OR: recipientScopes,
    },
    select: { id: true, role: true },
  });
};

const mapComentario = (comentario: ComentarioDb, usuarioLogado: UsuarioLogado): ComentarioDto => {
  const isAuthor = comentario.autorId === usuarioLogado.id;
  const canManageAnyComment = isAdministrativeRole(usuarioLogado.role);
  const canEdit = isAuthor || canManageAnyComment;
  const canDelete = isAuthor || canManageAnyComment;
  const canPin = canManageAnyComment;

  return {
    id: comentario.id,
    parentId: comentario.parentId,
    conteudo: comentario.conteudo,
    anexos: normalizeAnexos(comentario.anexos),
    fixado: comentario.fixado,
    criadoEm: toIso(comentario.criadoEm),
    atualizadoEm: toIso(comentario.atualizadoEm),
    autor: {
      id: comentario.Autor.id,
      nome: comentario.Autor.nomeCompleto,
      role: comentario.Autor.role,
      avatarUrl: comentario.Autor.UsuariosInformation?.avatarUrl ?? null,
    },
    canEdit,
    canDelete,
    canPin,
    replies: [],
  };
};

const buildTree = (
  comentarios: ComentarioDb[],
  usuarioLogado: UsuarioLogado,
  filtro: ListAvaliacaoRespostaComentariosQuery['filtro'],
) => {
  const mapped = comentarios.map((comentario) => mapComentario(comentario, usuarioLogado));
  const byId = new Map(mapped.map((comentario) => [comentario.id, comentario]));
  const roots: typeof mapped = [];

  for (const comentario of mapped) {
    if (comentario.parentId && byId.has(comentario.parentId)) {
      byId.get(comentario.parentId)!.replies.push(comentario);
    } else {
      roots.push(comentario);
    }
  }

  const sortComments = (items: typeof mapped) => {
    items.sort((a, b) => {
      if (a.fixado !== b.fixado) return a.fixado ? -1 : 1;
      const aTime = new Date(a.criadoEm ?? 0).getTime();
      const bTime = new Date(b.criadoEm ?? 0).getTime();
      return filtro === 'RECENTES' ? bTime - aTime : aTime - bTime;
    });
    items.forEach((item) => sortComments(item.replies));
  };

  sortComments(roots);
  return roots;
};

const auditComentario = async (
  acao: string,
  descricao: string,
  usuarioId: string | undefined,
  comentarioId: string,
  metadata: Record<string, unknown>,
  requestMetadata?: RequestMetadata,
  dadosAnteriores?: Record<string, unknown> | null,
  dadosNovos?: Record<string, unknown> | null,
) => {
  if (!usuarioId) return;

  try {
    await auditoriaService.registrarLog({
      categoria: AuditoriaCategoria.CURSO,
      tipo: 'PROVA_RESPOSTA_COMENTARIO',
      acao,
      usuarioId,
      entidadeId: comentarioId,
      entidadeTipo: 'PROVA_RESPOSTA_COMENTARIO',
      descricao,
      dadosAnteriores: dadosAnteriores ?? undefined,
      dadosNovos: dadosNovos ?? undefined,
      metadata,
      ip: requestMetadata?.ip,
      userAgent: requestMetadata?.userAgent,
    });
  } catch {
    // Auditoria nao deve bloquear o comentario na experiencia de correcao.
  }
};

export const avaliacoesComentariosService = {
  async list(
    avaliacaoId: string,
    respostaId: string,
    query: ListAvaliacaoRespostaComentariosQuery,
    usuarioLogado: UsuarioLogado,
  ) {
    const context = await resolveComentarioContext(avaliacaoId, respostaId, usuarioLogado);
    const where: Prisma.CursosTurmasProvasComentariosWhereInput = {
      provaId: avaliacaoId,
      inscricaoId: context.inscricaoId,
      deletedAt: null,
      ...(query.filtro === 'MEUS_COMENTARIOS' && usuarioLogado.id
        ? { autorId: usuarioLogado.id }
        : {}),
      ...(query.search ? { conteudo: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const comentarios = await prisma.cursosTurmasProvasComentarios.findMany({
      where,
      include: {
        Autor: {
          select: {
            id: true,
            nomeCompleto: true,
            role: true,
            UsuariosInformation: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: [{ fixado: 'desc' }, { criadoEm: query.filtro === 'RECENTES' ? 'desc' : 'asc' }],
    });

    const commentsTree = buildTree(comentarios, usuarioLogado, query.filtro);
    const start = (query.page - 1) * query.pageSize;
    const paginatedComments = commentsTree.slice(start, start + query.pageSize);
    const totalPages = Math.max(1, Math.ceil(commentsTree.length / query.pageSize));

    return {
      success: true,
      data: paginatedComments,
      total: comentarios.length,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalRoots: commentsTree.length,
        totalPages,
        hasMore: query.page < totalPages,
      },
    };
  },

  async create(
    avaliacaoId: string,
    respostaId: string,
    input: CreateAvaliacaoRespostaComentarioInput,
    usuarioLogado: UsuarioLogado,
    requestMetadata?: RequestMetadata,
  ) {
    const context = await resolveComentarioContext(avaliacaoId, respostaId, usuarioLogado);
    if (
      !usuarioLogado.id ||
      (!isInternalRole(usuarioLogado.role) && usuarioLogado.role !== Roles.ALUNO_CANDIDATO)
    ) {
      throw forbidden('Sem permissão para comentar nesta resposta');
    }

    if (input.parentId) {
      const parent = await prisma.cursosTurmasProvasComentarios.findFirst({
        where: {
          id: input.parentId,
          provaId: avaliacaoId,
          inscricaoId: context.inscricaoId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!parent) throw comentarioNotFound();
    }

    const destinatarios = await resolveNotificacaoDestinatarios(context, usuarioLogado);
    const respostaReferencia = context.envioId ?? context.inscricaoId;
    const cursoId = context.avaliacao.cursoId ?? context.avaliacao.CursosTurmas?.cursoId;
    const internalPath = `/dashboard/cursos/atividades-provas/${avaliacaoId}/respostas/${respostaReferencia}`;
    const alunoPath = cursoId
      ? `/dashboard/cursos/alunos/cursos/${cursoId}/${context.avaliacao.turmaId}/${avaliacaoId}`
      : '/dashboard/cursos/alunos/cursos';

    const comentario = await prisma.$transaction(async (tx) => {
      const created = await tx.cursosTurmasProvasComentarios.create({
        data: {
          provaId: avaliacaoId,
          inscricaoId: context.inscricaoId,
          envioId: context.envioId,
          parentId: input.parentId ?? null,
          autorId: usuarioLogado.id!,
          conteudo: input.conteudo,
          anexos: input.anexos,
        },
        include: {
          Autor: {
            select: {
              id: true,
              nomeCompleto: true,
              role: true,
              UsuariosInformation: { select: { avatarUrl: true } },
            },
          },
        },
      });

      if (destinatarios.length > 0) {
        const tituloAvaliacao = context.avaliacao.titulo;
        await tx.notificacoes.createMany({
          data: destinatarios.map((destinatario) => ({
            usuarioId: destinatario.id,
            tipo: 'SISTEMA',
            titulo: 'Novo comentário em uma resposta',
            mensagem:
              destinatario.role === Roles.ALUNO_CANDIDATO
                ? `${created.Autor.nomeCompleto} comentou na sua resposta em "${tituloAvaliacao}".`
                : `${created.Autor.nomeCompleto} comentou na resposta de ${context.alunoNome} em "${tituloAvaliacao}".`,
            prioridade: 'NORMAL',
            linkAcao: destinatario.role === Roles.ALUNO_CANDIDATO ? alunoPath : internalPath,
            dados: {
              evento: 'AVALIACAO_RESPOSTA_COMENTARIO',
              avaliacaoId,
              respostaId: respostaReferencia,
              inscricaoId: context.inscricaoId,
              comentarioId: created.id,
              parentId: input.parentId ?? null,
              autorId: created.autorId,
              autorNome: created.Autor.nomeCompleto,
              autorRole: created.Autor.role,
              alunoId: context.alunoId,
              alunoNome: context.alunoNome,
            },
          })),
        });
      }

      return created;
    });

    await auditComentario(
      'COMENTARIO_CRIADO',
      'Comentário criado na resposta da avaliação',
      usuarioLogado.id,
      comentario.id,
      {
        avaliacaoId,
        respostaId,
        inscricaoId: context.inscricaoId,
        envioId: context.envioId,
        parentId: input.parentId ?? null,
      },
      requestMetadata,
      null,
      { conteudo: comentario.conteudo, anexos: normalizeAnexos(comentario.anexos) },
    );

    return {
      success: true,
      data: mapComentario(comentario, usuarioLogado),
    };
  },

  async update(
    avaliacaoId: string,
    respostaId: string,
    comentarioId: string,
    input: UpdateAvaliacaoRespostaComentarioInput,
    usuarioLogado: UsuarioLogado,
    requestMetadata?: RequestMetadata,
  ) {
    const context = await resolveComentarioContext(avaliacaoId, respostaId, usuarioLogado);
    const comentario = await prisma.cursosTurmasProvasComentarios.findFirst({
      where: {
        id: comentarioId,
        provaId: avaliacaoId,
        inscricaoId: context.inscricaoId,
        deletedAt: null,
      },
      select: { id: true, autorId: true, conteudo: true, anexos: true },
    });

    if (!comentario) throw comentarioNotFound();
    if (comentario.autorId !== usuarioLogado.id && !isAdministrativeRole(usuarioLogado.role)) {
      throw forbidden('Sem permissão para editar este comentário');
    }

    const updated = await prisma.cursosTurmasProvasComentarios.update({
      where: { id: comentario.id },
      data: { conteudo: input.conteudo, anexos: input.anexos },
      include: {
        Autor: {
          select: {
            id: true,
            nomeCompleto: true,
            role: true,
            UsuariosInformation: { select: { avatarUrl: true } },
          },
        },
      },
    });

    await auditComentario(
      'COMENTARIO_EDITADO',
      'Comentário editado na resposta da avaliação',
      usuarioLogado.id,
      comentario.id,
      { avaliacaoId, respostaId, inscricaoId: context.inscricaoId, envioId: context.envioId },
      requestMetadata,
      { conteudo: comentario.conteudo, anexos: normalizeAnexos(comentario.anexos) },
      { conteudo: updated.conteudo, anexos: normalizeAnexos(updated.anexos) },
    );

    return {
      success: true,
      data: mapComentario(updated, usuarioLogado),
    };
  },

  async remove(
    avaliacaoId: string,
    respostaId: string,
    comentarioId: string,
    usuarioLogado: UsuarioLogado,
    requestMetadata?: RequestMetadata,
  ) {
    const context = await resolveComentarioContext(avaliacaoId, respostaId, usuarioLogado);
    const comentario = await prisma.cursosTurmasProvasComentarios.findFirst({
      where: {
        id: comentarioId,
        provaId: avaliacaoId,
        inscricaoId: context.inscricaoId,
        deletedAt: null,
      },
      select: { id: true, autorId: true, conteudo: true, anexos: true },
    });

    if (!comentario) throw comentarioNotFound();
    if (comentario.autorId !== usuarioLogado.id && !isAdministrativeRole(usuarioLogado.role)) {
      throw forbidden('Sem permissão para excluir este comentário');
    }

    const commentsInResponse = await prisma.cursosTurmasProvasComentarios.findMany({
      where: {
        provaId: avaliacaoId,
        inscricaoId: context.inscricaoId,
        deletedAt: null,
      },
      select: { id: true, parentId: true, anexos: true },
    });
    const deletedIds = new Set([comentario.id]);
    let foundDescendant = true;

    while (foundDescendant) {
      foundDescendant = false;
      for (const item of commentsInResponse) {
        if (item.parentId && deletedIds.has(item.parentId) && !deletedIds.has(item.id)) {
          deletedIds.add(item.id);
          foundDescendant = true;
        }
      }
    }

    const deletedComments = commentsInResponse.filter((item) => deletedIds.has(item.id));
    const deletedAttachmentUrls = [
      ...new Set(
        deletedComments.flatMap((item) => normalizeAnexos(item.anexos).map((anexo) => anexo.url)),
      ),
    ];

    await prisma.cursosTurmasProvasComentarios.updateMany({
      where: { id: { in: [...deletedIds] } },
      data: { deletedAt: new Date(), fixado: false },
    });

    await auditComentario(
      'COMENTARIO_EXCLUIDO',
      'Comentário excluído na resposta da avaliação',
      usuarioLogado.id,
      comentario.id,
      {
        avaliacaoId,
        respostaId,
        inscricaoId: context.inscricaoId,
        envioId: context.envioId,
        comentariosExcluidos: deletedIds.size,
      },
      requestMetadata,
      { conteudo: comentario.conteudo, anexos: normalizeAnexos(comentario.anexos) },
      null,
    );

    return { success: true, deletedAttachmentUrls };
  },

  async fixar(
    avaliacaoId: string,
    respostaId: string,
    comentarioId: string,
    input: FixarAvaliacaoRespostaComentarioInput,
    usuarioLogado: UsuarioLogado,
    requestMetadata?: RequestMetadata,
  ) {
    const context = await resolveComentarioContext(avaliacaoId, respostaId, usuarioLogado);
    if (!isAdministrativeRole(usuarioLogado.role)) {
      throw forbidden('Sem permissão para fixar comentários nesta resposta');
    }

    const comentario = await prisma.cursosTurmasProvasComentarios.findFirst({
      where: {
        id: comentarioId,
        provaId: avaliacaoId,
        inscricaoId: context.inscricaoId,
        deletedAt: null,
      },
      select: { id: true, fixado: true },
    });

    if (!comentario) throw comentarioNotFound();

    const updated = await prisma.cursosTurmasProvasComentarios.update({
      where: { id: comentario.id },
      data: { fixado: input.fixado },
      include: {
        Autor: {
          select: {
            id: true,
            nomeCompleto: true,
            role: true,
            UsuariosInformation: { select: { avatarUrl: true } },
          },
        },
      },
    });

    await auditComentario(
      input.fixado ? 'COMENTARIO_FIXADO' : 'COMENTARIO_DESFIXADO',
      input.fixado
        ? 'Comentário fixado na resposta da avaliação'
        : 'Comentário desfixado na resposta da avaliação',
      usuarioLogado.id,
      comentario.id,
      { avaliacaoId, respostaId, inscricaoId: context.inscricaoId, envioId: context.envioId },
      requestMetadata,
      { fixado: comentario.fixado },
      { fixado: updated.fixado },
    );

    return {
      success: true,
      data: mapComentario(updated, usuarioLogado),
    };
  },
};
