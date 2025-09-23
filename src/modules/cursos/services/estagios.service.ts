import {
  CursosEstagioNotificacaoTipo,
  CursosEstagioStatus,
  Prisma,
} from '@prisma/client';
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
    id: number;
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

const formatEndereco = (local: { logradouro?: string | null; numero?: string | null; bairro?: string | null; cidade?: string | null; estado?: string | null; cep?: string | null }) => {
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

const normalizeCursoTurma = async (client: PrismaClientOrTx, cursoId: number, turmaId: string) => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId },
    select: {
      id: true,
      nome: true,
      codigo: true,
      curso: {
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

const ensureMatricula = async (client: PrismaClientOrTx, turmaId: string, matriculaId: string) => {
  const matricula = await client.cursosTurmasMatriculas.findFirst({
    where: { id: matriculaId, turmaId },
    include: {
      aluno: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
        },
      },
    },
  });

  if (!matricula) {
    const error = new Error('Matrícula não encontrada para a turma informada');
    (error as any).code = 'MATRICULA_NOT_FOUND';
    throw error;
  }

  return matricula;
};

const prepararLocaisEmail = (
  locais: Prisma.CursosEstagiosGetPayload<typeof estagioWithRelations>['locais'],
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
  async create(
    cursoId: number,
    turmaId: string,
    matriculaId: string,
    data: EstagioCreateInput,
    usuarioId?: string,
  ) {
    const resultado = await prisma.$transaction<CreateEstagioTxResult>(async (tx) => {
      const turma = await normalizeCursoTurma(tx, cursoId, turmaId);
      const matricula = await ensureMatricula(tx, turmaId, matriculaId);

      const token = generateToken();

      const estagio = await tx.cursosEstagios.create({
        data: {
          cursoId,
          turmaId,
          matriculaId,
          alunoId: matricula.aluno.id,
          nome: data.nome,
          descricao: data.descricao ?? null,
          obrigatorio: data.obrigatorio ?? turma.curso.estagioObrigatorio,
          status: CursosEstagioStatus.PENDENTE,
          dataInicio: data.dataInicio,
          dataFim: data.dataFim,
          cargaHoraria: data.cargaHoraria ?? null,
          empresaPrincipal: data.empresaPrincipal ?? null,
          observacoes: data.observacoes ?? null,
          criadoPorId: usuarioId ?? null,
          locais: {
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
          confirmacao: {
            create: {
              token,
            },
          },
        },
        ...estagioWithRelations,
      });

      estagiosLogger.info({ estagioId: estagio.id, matriculaId }, 'Estágio criado com sucesso');

      return {
        estagio,
        token,
        aluno: matricula.aluno,
        curso: turma.curso,
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
        locais: prepararLocaisEmail(resultado.estagio.locais),
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

  async listByMatricula(cursoId: number, turmaId: string, matriculaId: string) {
    await normalizeCursoTurma(prisma, cursoId, turmaId);
    await ensureMatricula(prisma, turmaId, matriculaId);

    const estagios = await prisma.cursosEstagios.findMany({
      where: { cursoId, turmaId, matriculaId },
      orderBy: { criadoEm: 'desc' },
      ...estagioWithRelations,
    });

    return estagios.map((estagio) => mapEstagio(estagio));
  },

  async listForAluno(matriculaId: string, alunoId: string) {
    const matricula = await prisma.cursosTurmasMatriculas.findUnique({
      where: { id: matriculaId },
      select: { alunoId: true },
    });

    if (!matricula || matricula.alunoId !== alunoId) {
      const error = new Error('Matrícula não encontrada ou não pertence ao aluno');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const estagios = await prisma.cursosEstagios.findMany({
      where: { matriculaId },
      orderBy: { criadoEm: 'desc' },
      ...estagioWithRelations,
    });

    return estagios.map((estagio) => mapEstagio(estagio));
  },

  async getById(estagioId: string, requesterId?: string, { allowAdmin = false } = {}) {
    const estagio = await prisma.cursosEstagios.findUnique({
      where: { id: estagioId },
      ...estagioWithRelations,
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
        updateData.atualizadoPor = {
          connect: { id: usuarioId },
        };
      }

      if (data.locais) {
        updateData.locais = {
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
        ...estagioWithRelations,
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
        updateData.atualizadoPor = {
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
        ...estagioWithRelations,
      });

      return mapEstagio(estagio);
    });
  },

  async confirmar(token: string, payload: EstagioConfirmacaoInput & { ip?: string; userAgent?: string }) {
    return prisma.$transaction(async (tx) => {
      const confirmacao = await tx.cursosEstagiosConfirmacoes.findUnique({
        where: { token },
        include: {
          estagio: {
            ...estagioWithRelations,
          },
        },
      });

      if (!confirmacao) {
        const error = new Error('Confirmação não encontrada ou já utilizada');
        (error as any).code = 'CONFIRMACAO_INVALIDA';
        throw error;
      }

      if (confirmacao.confirmadoEm) {
        return mapEstagio(confirmacao.estagio, { includeToken: false });
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
            confirmacao.estagio.status === CursosEstagioStatus.PENDENTE
              ? CursosEstagioStatus.EM_ANDAMENTO
              : confirmacao.estagio.status,
        },
        ...estagioWithRelations,
      });

      return mapEstagio(estagioAtualizado);
    });
  },

  async reenviarConfirmacao(estagioId: string, usuarioId?: string, destinatarioAlternativo?: string) {
    const estagio = await prisma.cursosEstagios.findUnique({
      where: { id: estagioId },
      ...estagioWithRelations,
    });

    if (!estagio || !estagio.confirmacao) {
      const error = new Error('Estágio não encontrado ou sem confirmação configurada');
      (error as any).code = 'ESTAGIO_NOT_FOUND';
      throw error;
    }

    try {
      await estagiosEmailService.enviarConvocacao({
        alunoEmail: estagio.aluno.email,
        alunoNome: estagio.aluno.nomeCompleto,
        cursoNome: estagio.curso.nome,
        turmaNome: estagio.turma.nome,
        estagioNome: estagio.nome,
        dataInicio: estagio.dataInicio,
        dataFim: estagio.dataFim,
        obrigatorio: estagio.obrigatorio,
        confirmacaoToken: estagio.confirmacao.token,
        empresaPrincipal: estagio.empresaPrincipal,
        cargaHoraria: estagio.cargaHoraria,
        observacoes: estagio.observacoes,
        locais: prepararLocaisEmail(estagio.locais),
        destinatarioAlternativo,
      });

      await registrarNotificacao(
        prisma,
        estagio.id,
        CursosEstagioNotificacaoTipo.ASSINATURA_PENDENTE,
        destinatarioAlternativo ?? estagio.aluno.email,
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
        aluno: { select: { nomeCompleto: true } },
        curso: { select: { nome: true } },
        turma: { select: { nome: true } },
        criadoPor: { select: { nomeCompleto: true, email: true } },
      },
    });

    return estagios.map((estagio) => ({
      id: estagio.id,
      criadoPor: estagio.criadoPor,
      alunoNome: estagio.aluno.nomeCompleto,
      cursoNome: estagio.curso.nome,
      turmaNome: estagio.turma.nome,
      estagioNome: estagio.nome,
      dataFim: estagio.dataFim,
      diasRestantes: diferencaEmDias(agora, estagio.dataFim),
    }));
  },

  async registrarAvisoEncerramento(estagioId: string, destinatario: { email: string; nome?: string | null }) {
    const estagio = await prisma.cursosEstagios.findUnique({
      where: { id: estagioId },
      include: {
        aluno: { select: { nomeCompleto: true } },
        curso: { select: { nome: true } },
        turma: { select: { nome: true } },
      },
    });

    if (!estagio) {
      return;
    }

    const agora = new Date();

    await estagiosEmailService.enviarAvisoEncerramento({
      adminEmail: destinatario.email,
      adminNome: destinatario.nome ?? destinatario.email,
      alunoNome: estagio.aluno.nomeCompleto,
      cursoNome: estagio.curso.nome,
      turmaNome: estagio.turma.nome,
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
