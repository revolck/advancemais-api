import { CursosEstagioNotificacaoTipo, CursosEstagioStatus, Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { estagiosEmailService } from './estagios-email.service';
import { estagioWithRelations, mapEstagio, translateDiasSemana } from './estagios.mapper';
import type {
  EstagioConfirmacaoInput,
  EstagioCreateInput,
  EstagioLocalInput,
  EstagioStatusInput,
  EstagioUpdateInput,
  ListEstagiosQuery,
} from '../validators/estagios.schema';

const estagiosLogger = logger.child({ module: 'CursosEstagiosService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

type CreateEstagioTxResult = {
  estagio: Prisma.CursosEstagiosGetPayload<typeof estagioWithRelations>;
  token: string;
  aluno: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  curso: {
    id: string;
    nome: string;
    codigo: string;
  };
  turma: {
    id: string;
    nome: string;
    codigo: string;
  };
};

const generateToken = () => randomBytes(32).toString('hex');

const generateProtocolo = () => `EST-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

const formatEndereco = (local: {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}) => {
  const partes: string[] = [];
  if (local.logradouro) {
    partes.push(local.logradouro.trim());
  }
  if (local.numero) {
    partes.push(`nº ${local.numero.trim()}`);
  }
  if (local.bairro) {
    partes.push(local.bairro.trim());
  }
  const cidadeEstado = [local.cidade?.trim(), local.estado?.trim()].filter(Boolean).join(' - ');
  if (cidadeEstado) {
    partes.push(cidadeEstado);
  }
  if (local.cep) {
    partes.push(`CEP ${local.cep}`);
  }
  return partes.length > 0 ? partes.join(', ') : null;
};

const formatHorario = (inicio?: string | null, fim?: string | null) => {
  if (!inicio && !fim) {
    return null;
  }

  if (inicio && fim) {
    return `${inicio} às ${fim}`;
  }

  return inicio ?? fim ?? null;
};

const normalizeCursoTurma = async (client: PrismaClientOrTx, cursoId: string, turmaId: string) => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId },
    select: {
      id: true,
      nome: true,
      codigo: true,
      Cursos: {
        select: {
          id: true,
          nome: true,
          codigo: true,
          estagioObrigatorio: true,
        },
      },
    },
  });

  if (!turma) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }

  return turma;
};

const ensureInscricao = async (client: PrismaClientOrTx, turmaId: string, inscricaoId: string) => {
  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: { id: inscricaoId, turmaId },
    include: {
      Usuarios: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
        },
      },
    },
  });

  if (!inscricao) {
    const error = new Error('Inscrição não encontrada para a turma informada');
    (error as any).code = 'INSCRICAO_NOT_FOUND';
    throw error;
  }

  return inscricao;
};

const prepararLocaisEmail = (
  locais: Prisma.CursosEstagiosGetPayload<typeof estagioWithRelations>['CursosEstagiosLocais'],
) =>
  locais.map((local) => ({
    empresaNome: local.empresaNome,
    endereco: formatEndereco(local),
    horarios: formatHorario(local.horarioInicio, local.horarioFim),
    diasSemana: translateDiasSemana(local.diasSemana ?? []),
    pontoReferencia: local.pontoReferencia ?? null,
    observacoes: local.observacoes ?? null,
  }));

const registrarNotificacao = async (
  client: PrismaClientOrTx,
  estagioId: string,
  tipo: CursosEstagioNotificacaoTipo,
  enviadoPara: string,
  detalhes?: string | null,
) => {
  await client.cursosEstagiosNotificacoes.create({
    data: {
      estagioId,
      tipo,
      canal: 'EMAIL',
      enviadoPara,
      detalhes: detalhes ?? null,
    },
  });
};

const diferencaEmDias = (inicio: Date, fim: Date) => {
  const diff = fim.getTime() - inicio.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const estagiosService = {
  async list(query: ListEstagiosQuery) {
    const { cursoId, turmaId, status, search, page, pageSize } = query;

    // Validar se o curso existe
    const curso = await prisma.cursos.findUnique({
      where: { id: cursoId },
      select: { id: true },
    });

    if (!curso) {
      const error = new Error('Curso não encontrado');
      (error as any).code = 'CURSO_NOT_FOUND';
      throw error;
    }

    const where: Prisma.CursosEstagiosWhereInput = {
      cursoId,
      turmaId: turmaId ?? undefined,
      status: status ?? undefined,
    };

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { nome: { contains: term, mode: 'insensitive' } },
        { empresaPrincipal: { contains: term, mode: 'insensitive' } },
        { CursosTurmas: { nome: { contains: term, mode: 'insensitive' } } },
        {
          Usuarios_CursosEstagios_alunoIdToUsuarios: {
            nomeCompleto: { contains: term, mode: 'insensitive' },
          },
        },
        {
          Usuarios_CursosEstagios_alunoIdToUsuarios: {
            email: { contains: term, mode: 'insensitive' },
          },
        },
      ];
    }

    const total = await prisma.cursosEstagios.count({ where });
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const estagios = await prisma.cursosEstagios.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: pageSize,
      include: estagioWithRelations.include,
    });

    return {
      success: true,
      data: {
        items: estagios.map((item) =>
          mapEstagio(item, { includeToken: false, includeNotificacoes: false }),
        ),
        pagination: {
          page: safePage,
          requestedPage: page,
          pageSize,
          total,
          totalPages: totalPages || 1,
          hasNext: totalPages > 0 && safePage < totalPages,
          hasPrevious: safePage > 1,
          isPageAdjusted: safePage !== page,
        },
      },
    };
  },

  async create(
    cursoId: string,
    turmaId: string,
    inscricaoId: string,
    data: EstagioCreateInput,
    usuarioId?: string,
  ) {
    const resultado = await prisma.$transaction<CreateEstagioTxResult>(async (tx) => {
      const turma = await normalizeCursoTurma(tx, cursoId, turmaId);
      const inscricao = await ensureInscricao(tx, turmaId, inscricaoId);

      const token = generateToken();

      const estagioCreated = await tx.cursosEstagios.create({
        data: {
          cursoId,
          turmaId,
          inscricaoId,
          alunoId: inscricao.Usuarios.id,
          nome: data.nome,
          descricao: data.descricao ?? null,
          obrigatorio: data.obrigatorio ?? turma.Cursos.estagioObrigatorio,
          status: CursosEstagioStatus.PENDENTE,
          dataInicio: data.dataInicio,
          dataFim: data.dataFim,
          cargaHoraria: data.cargaHoraria ?? null,
          empresaPrincipal: data.empresaPrincipal ?? null,
          observacoes: data.observacoes ?? null,
          criadoPorId: usuarioId ?? null,
          CursosEstagiosLocais: {
            create: data.locais.map((local) => ({
              titulo: local.titulo ?? null,
              empresaNome: local.empresaNome,
              empresaDocumento: local.empresaDocumento ?? null,
              contatoNome: local.contatoNome ?? null,
              contatoEmail: local.contatoEmail ?? null,
              contatoTelefone: local.contatoTelefone ?? null,
              dataInicio: local.dataInicio ?? null,
              dataFim: local.dataFim ?? null,
              horarioInicio: local.horarioInicio ?? null,
              horarioFim: local.horarioFim ?? null,
              diasSemana: local.diasSemana ?? [],
              cargaHorariaSemanal: local.cargaHorariaSemanal ?? null,
              cep: local.cep ?? null,
              logradouro: local.logradouro ?? null,
              numero: local.numero ?? null,
              bairro: local.bairro ?? null,
              cidade: local.cidade ?? null,
              estado: local.estado ?? null,
              complemento: local.complemento ?? null,
              pontoReferencia: local.pontoReferencia ?? null,
              observacoes: local.observacoes ?? null,
            })),
          },
          CursosEstagiosConfirmacoes: {
            create: {
              token,
            },
          },
        },
      });

      const estagio = await tx.cursosEstagios.findUniqueOrThrow({
        where: { id: estagioCreated.id },
        include: estagioWithRelations.include,
      });

      estagiosLogger.info({ estagioId: estagio.id, inscricaoId }, 'Estágio criado com sucesso');

      return {
        estagio,
        token,
        aluno: inscricao.Usuarios,
        curso: turma.Cursos,
        turma: { id: turma.id, nome: turma.nome, codigo: turma.codigo },
      };
    });

    try {
      await estagiosEmailService.enviarConvocacao({
        alunoEmail: resultado.aluno.email,
        alunoNome: resultado.aluno.nomeCompleto,
        cursoNome: resultado.curso.nome,
        turmaNome: resultado.turma.nome,
        estagioNome: resultado.estagio.nome,
        dataInicio: resultado.estagio.dataInicio,
        dataFim: resultado.estagio.dataFim,
        obrigatorio: resultado.estagio.obrigatorio,
        confirmacaoToken: resultado.token,
        empresaPrincipal: resultado.estagio.empresaPrincipal,
        cargaHoraria: resultado.estagio.cargaHoraria,
        observacoes: resultado.estagio.observacoes,
        locais: prepararLocaisEmail(resultado.estagio.CursosEstagiosLocais),
      });

      await registrarNotificacao(
        prisma,
        resultado.estagio.id,
        CursosEstagioNotificacaoTipo.ASSINATURA_PENDENTE,
        resultado.aluno.email,
        'Convite de estágio enviado',
      );
    } catch (error) {
      estagiosLogger.warn(
        { estagioId: resultado.estagio.id, err: error },
        'Falha ao enviar email de convocação do estágio',
      );
    }

    return mapEstagio(resultado.estagio);
  },

  async listByInscricao(cursoId: string, turmaId: string, inscricaoId: string) {
    await normalizeCursoTurma(prisma, cursoId, turmaId);
    await ensureInscricao(prisma, turmaId, inscricaoId);

    const estagios = await prisma.cursosEstagios.findMany({
      where: { cursoId, turmaId, inscricaoId },
      orderBy: { criadoEm: 'desc' },
      include: estagioWithRelations.include,
    });

    return estagios.map((estagio) => mapEstagio(estagio));
  },

  async listForAluno(inscricaoId: string, alunoId: string) {
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: inscricaoId },
      select: { alunoId: true },
    });

    if (!inscricao || inscricao.alunoId !== alunoId) {
      const error = new Error('Inscrição não encontrada ou não pertence ao aluno');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const estagios = await prisma.cursosEstagios.findMany({
      where: { inscricaoId },
      orderBy: { criadoEm: 'desc' },
      include: estagioWithRelations.include,
    });

    return estagios.map((estagio) => mapEstagio(estagio));
  },

  async getById(estagioId: string, requesterId?: string, { allowAdmin = false } = {}) {
    const estagio = await prisma.cursosEstagios.findUnique({
      where: { id: estagioId },
      include: estagioWithRelations.include,
    });

    if (!estagio) {
      const error = new Error('Estágio não encontrado');
      (error as any).code = 'ESTAGIO_NOT_FOUND';
      throw error;
    }

    if (requesterId && !allowAdmin && estagio.alunoId !== requesterId) {
      const error = new Error('Usuário sem permissão para acessar este estágio');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    return mapEstagio(estagio);
  },

  async update(estagioId: string, data: EstagioUpdateInput, usuarioId?: string) {
    return prisma.$transaction(async (tx) => {
      const estagioAtual = await tx.cursosEstagios.findUnique({
        where: { id: estagioId },
        select: { id: true },
      });

      if (!estagioAtual) {
        const error = new Error('Estágio não encontrado');
        (error as any).code = 'ESTAGIO_NOT_FOUND';
        throw error;
      }

      const updateData: Prisma.CursosEstagiosUpdateInput = {};

      if (data.nome) {
        updateData.nome = data.nome;
      }

      if (data.dataInicio) {
        updateData.dataInicio = data.dataInicio;
      }

      if (data.dataFim) {
        updateData.dataFim = data.dataFim;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'descricao')) {
        updateData.descricao = data.descricao ?? null;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'obrigatorio')) {
        updateData.obrigatorio = data.obrigatorio ?? false;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'cargaHoraria')) {
        updateData.cargaHoraria = data.cargaHoraria ?? null;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'empresaPrincipal')) {
        updateData.empresaPrincipal = data.empresaPrincipal ?? null;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'observacoes')) {
        updateData.observacoes = data.observacoes ?? null;
      }

      if (usuarioId) {
        updateData.Usuarios_CursosEstagios_atualizadoPorIdToUsuarios = {
          connect: { id: usuarioId },
        };
      }

      if (data.locais) {
        updateData.CursosEstagiosLocais = {
          deleteMany: { estagioId },
          create: data.locais.map((local: EstagioLocalInput) => ({
            titulo: local.titulo ?? null,
            empresaNome: local.empresaNome,
            empresaDocumento: local.empresaDocumento ?? null,
            contatoNome: local.contatoNome ?? null,
            contatoEmail: local.contatoEmail ?? null,
            contatoTelefone: local.contatoTelefone ?? null,
            dataInicio: local.dataInicio ?? null,
            dataFim: local.dataFim ?? null,
            horarioInicio: local.horarioInicio ?? null,
            horarioFim: local.horarioFim ?? null,
            diasSemana: local.diasSemana ?? [],
            cargaHorariaSemanal: local.cargaHorariaSemanal ?? null,
            cep: local.cep ?? null,
            logradouro: local.logradouro ?? null,
            numero: local.numero ?? null,
            bairro: local.bairro ?? null,
            cidade: local.cidade ?? null,
            estado: local.estado ?? null,
            complemento: local.complemento ?? null,
            pontoReferencia: local.pontoReferencia ?? null,
            observacoes: local.observacoes ?? null,
          })),
        };
      }

      const estagio = await tx.cursosEstagios.update({
        where: { id: estagioId },
        data: updateData,
        include: estagioWithRelations.include,
      });

      return mapEstagio(estagio);
    });
  },

  async updateStatus(estagioId: string, data: EstagioStatusInput, usuarioId?: string) {
    return prisma.$transaction(async (tx) => {
      const estagioExistente = await tx.cursosEstagios.findUnique({
        where: { id: estagioId },
        select: { id: true },
      });

      if (!estagioExistente) {
        const error = new Error('Estágio não encontrado');
        (error as any).code = 'ESTAGIO_NOT_FOUND';
        throw error;
      }

      const updateData: Prisma.CursosEstagiosUpdateInput = {
        status: data.status,
      };

      if (usuarioId) {
        updateData.Usuarios_CursosEstagios_atualizadoPorIdToUsuarios = {
          connect: { id: usuarioId },
        };
      }

      if (data.status === CursosEstagioStatus.CONCLUIDO) {
        updateData.concluidoEm = data.concluidoEm ?? new Date();
        updateData.reprovadoEm = null;
        updateData.reprovadoMotivo = null;
      }

      if (data.status === CursosEstagioStatus.REPROVADO) {
        updateData.reprovadoEm = new Date();
        updateData.reprovadoMotivo = data.reprovadoMotivo ?? null;
        updateData.concluidoEm = null;
      }

      if (data.status === CursosEstagioStatus.CANCELADO) {
        updateData.reprovadoEm = new Date();
        updateData.reprovadoMotivo = data.reprovadoMotivo ?? null;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'observacoes')) {
        updateData.observacoes = data.observacoes ?? null;
      }

      const estagio = await tx.cursosEstagios.update({
        where: { id: estagioId },
        data: updateData,
        include: estagioWithRelations.include,
      });

      return mapEstagio(estagio);
    });
  },

  async confirmar(
    token: string,
    payload: EstagioConfirmacaoInput & { ip?: string; userAgent?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const confirmacao = await tx.cursosEstagiosConfirmacoes.findUnique({
        where: { token },
        include: {
          CursosEstagios: {
            include: estagioWithRelations.include,
          },
        },
      });

      if (!confirmacao) {
        const error = new Error('Confirmação não encontrada ou já utilizada');
        (error as any).code = 'CONFIRMACAO_INVALIDA';
        throw error;
      }

      if (confirmacao.confirmadoEm) {
        return mapEstagio(confirmacao.CursosEstagios, { includeToken: false });
      }

      const confirmadoEm = new Date();
      const protocolo = confirmacao.protocolo ?? generateProtocolo();

      await tx.cursosEstagiosConfirmacoes.update({
        where: { id: confirmacao.id },
        data: {
          confirmadoEm,
          protocolo,
          ip: payload.ip ?? confirmacao.ip ?? null,
          userAgent: payload.userAgent ?? confirmacao.userAgent ?? null,
          deviceTipo: payload.deviceTipo ?? confirmacao.deviceTipo ?? null,
          deviceDescricao: payload.deviceDescricao ?? confirmacao.deviceDescricao ?? null,
          deviceId: payload.deviceId ?? confirmacao.deviceId ?? null,
          sistemaOperacional: payload.sistemaOperacional ?? confirmacao.sistemaOperacional ?? null,
          navegador: payload.navegador ?? confirmacao.navegador ?? null,
          localizacao: payload.localizacao ?? confirmacao.localizacao ?? null,
        },
      });

      const estagioAtualizado = await tx.cursosEstagios.update({
        where: { id: confirmacao.estagioId },
        data: {
          confirmadoEm,
          status:
            confirmacao.CursosEstagios.status === CursosEstagioStatus.PENDENTE
              ? CursosEstagioStatus.EM_ANDAMENTO
              : confirmacao.CursosEstagios.status,
        },
        include: estagioWithRelations.include,
      });

      return mapEstagio(estagioAtualizado);
    });
  },

  async reenviarConfirmacao(
    estagioId: string,
    usuarioId?: string,
    destinatarioAlternativo?: string,
  ) {
    const estagio = await prisma.cursosEstagios.findUnique({
      where: { id: estagioId },
      include: estagioWithRelations.include,
    });

    if (!estagio || !estagio.CursosEstagiosConfirmacoes) {
      const error = new Error('Estágio não encontrado ou sem confirmação configurada');
      (error as any).code = 'ESTAGIO_NOT_FOUND';
      throw error;
    }

    try {
      await estagiosEmailService.enviarConvocacao({
        alunoEmail: estagio.Usuarios_CursosEstagios_alunoIdToUsuarios.email,
        alunoNome: estagio.Usuarios_CursosEstagios_alunoIdToUsuarios.nomeCompleto,
        cursoNome: estagio.Cursos.nome,
        turmaNome: estagio.CursosTurmas.nome,
        estagioNome: estagio.nome,
        dataInicio: estagio.dataInicio,
        dataFim: estagio.dataFim,
        obrigatorio: estagio.obrigatorio,
        confirmacaoToken: estagio.CursosEstagiosConfirmacoes?.token ?? '',
        empresaPrincipal: estagio.empresaPrincipal,
        cargaHoraria: estagio.cargaHoraria,
        observacoes: estagio.observacoes,
        locais: prepararLocaisEmail(estagio.CursosEstagiosLocais || []),
        destinatarioAlternativo,
      });

      await registrarNotificacao(
        prisma,
        estagio.id,
        CursosEstagioNotificacaoTipo.ASSINATURA_PENDENTE,
        destinatarioAlternativo ?? estagio.Usuarios_CursosEstagios_alunoIdToUsuarios.email,
        usuarioId ? `Reenvio solicitado por ${usuarioId}` : 'Reenvio de confirmação',
      );
    } catch (error) {
      estagiosLogger.warn(
        { estagioId, err: error },
        'Falha ao reenviar email de confirmação do estágio',
      );
      throw error;
    }

    return mapEstagio(estagio);
  },

  async localizarEncerramentosProximos(horasAntecedencia: number) {
    const agora = new Date();
    const limite = new Date(agora.getTime() + horasAntecedencia * 60 * 60 * 1000);

    const estagios = await prisma.cursosEstagios.findMany({
      where: {
        status: {
          in: [CursosEstagioStatus.PENDENTE, CursosEstagioStatus.EM_ANDAMENTO],
        },
        dataFim: {
          gte: agora,
          lte: limite,
        },
        OR: [
          { ultimoAvisoEncerramento: null },
          {
            ultimoAvisoEncerramento: {
              lt: new Date(agora.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
      include: {
        Usuarios_CursosEstagios_alunoIdToUsuarios: { select: { nomeCompleto: true } },
        Cursos: { select: { nome: true } },
        CursosTurmas: { select: { nome: true } },
        Usuarios_CursosEstagios_criadoPorIdToUsuarios: {
          select: { nomeCompleto: true, email: true },
        },
      },
    });

    return estagios.map((estagio) => ({
      id: estagio.id,
      criadoPor: estagio.Usuarios_CursosEstagios_criadoPorIdToUsuarios,
      alunoNome: estagio.Usuarios_CursosEstagios_alunoIdToUsuarios.nomeCompleto,
      cursoNome: estagio.Cursos.nome,
      turmaNome: estagio.CursosTurmas.nome,
      estagioNome: estagio.nome,
      dataFim: estagio.dataFim,
      diasRestantes: diferencaEmDias(agora, estagio.dataFim),
    }));
  },

  async registrarAvisoEncerramento(
    estagioId: string,
    destinatario: { email: string; nome?: string | null },
  ) {
    const estagio = await prisma.cursosEstagios.findUnique({
      where: { id: estagioId },
      include: {
        Usuarios_CursosEstagios_alunoIdToUsuarios: { select: { nomeCompleto: true } },
        Cursos: { select: { nome: true } },
        CursosTurmas: { select: { nome: true } },
      },
    });

    if (!estagio) {
      return;
    }

    const agora = new Date();

    await estagiosEmailService.enviarAvisoEncerramento({
      adminEmail: destinatario.email,
      adminNome: destinatario.nome ?? destinatario.email,
      alunoNome: estagio.Usuarios_CursosEstagios_alunoIdToUsuarios.nomeCompleto,
      cursoNome: estagio.Cursos.nome,
      turmaNome: estagio.CursosTurmas.nome,
      estagioNome: estagio.nome,
      dataFim: estagio.dataFim,
      diasRestantes: diferencaEmDias(agora, estagio.dataFim),
      observacoes: estagio.observacoes ?? null,
    });

    await prisma.$transaction(async (tx) => {
      await tx.cursosEstagios.update({
        where: { id: estagioId },
        data: { ultimoAvisoEncerramento: agora },
      });

      await registrarNotificacao(
        tx,
        estagioId,
        CursosEstagioNotificacaoTipo.ENCERRAMENTO_PROXIMO,
        destinatario.email,
        'Aviso de encerramento enviado',
      );
    });
  },
};
