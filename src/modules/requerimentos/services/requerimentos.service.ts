import { prisma } from '../../../config/prisma';
import {
  RequerimentoTipo,
  RequerimentoStatus,
  RequerimentoPrioridade,
  Prisma,
} from '@prisma/client';
import type {
  CriarRequerimentoInput,
  AtualizarRequerimentoAdminInput,
  AdicionarComentarioInput,
  ListarRequerimentosInput,
  SolicitarReembolsoInput,
} from '../validators/requerimentos.schema';

// Constante: dias para direito de arrependimento
const DIAS_DIREITO_ARREPENDIMENTO = 7;

// Gerar código único para requerimento
async function gerarCodigoRequerimento(): Promise<string> {
  const ano = new Date().getFullYear();
  const ultimoRequerimento = await prisma.requerimentos.findFirst({
    where: {
      codigo: {
        startsWith: `REQ-${ano}-`,
      },
    },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });

  let sequencial = 1;
  if (ultimoRequerimento?.codigo) {
    const partes = ultimoRequerimento.codigo.split('-');
    const ultimoNumero = parseInt(partes[2], 10);
    if (!isNaN(ultimoNumero)) {
      sequencial = ultimoNumero + 1;
    }
  }

  return `REQ-${ano}-${String(sequencial).padStart(5, '0')}`;
}

export const requerimentosService = {
  /**
   * Criar novo requerimento (usuário)
   */
  async criar(usuarioId: string, input: CriarRequerimentoInput) {
    const codigo = await gerarCodigoRequerimento();

    // Determinar prioridade automática para reembolso (urgente se dentro do prazo)
    let prioridade: RequerimentoPrioridade = RequerimentoPrioridade.MEDIA;
    if (input.tipo === 'REEMBOLSO' && input.empresasPlanoId) {
      const plano = await prisma.empresasPlano.findUnique({
        where: { id: input.empresasPlanoId },
        select: { criadoEm: true },
      });
      if (plano) {
        const diasDesdeCompra = Math.floor(
          (Date.now() - plano.criadoEm.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diasDesdeCompra <= DIAS_DIREITO_ARREPENDIMENTO) {
          prioridade = RequerimentoPrioridade.URGENTE;
        }
      }
    }

    const requerimento = await prisma.requerimentos.create({
      data: {
        codigo,
        usuarioId,
        tipo: input.tipo as RequerimentoTipo,
        prioridade,
        titulo: input.titulo,
        descricao: input.descricao,
        empresasPlanoId: input.empresasPlanoId,
        empresasVagaId: input.empresasVagaId,
        valorReembolso: input.valorReembolso,
        motivoReembolso: input.motivoReembolso,
        anexos: input.anexos ? (input.anexos as Prisma.JsonArray) : undefined,
      },
      include: {
        Usuario: {
          select: { id: true, nomeCompleto: true, email: true },
        },
        EmpresasPlano: {
          include: {
            PlanosEmpresariais: { select: { nome: true, valor: true } },
          },
        },
      },
    });

    // Registrar histórico
    await prisma.requerimentosHistorico.create({
      data: {
        requerimentoId: requerimento.id,
        usuarioId,
        acao: 'CRIADO',
        statusNovo: RequerimentoStatus.ABERTO,
        comentario: `Requerimento criado: ${input.titulo}`,
      },
    });

    return requerimento;
  },

  /**
   * Solicitar reembolso (direito de arrependimento - 7 dias)
   */
  async solicitarReembolso(usuarioId: string, input: SolicitarReembolsoInput) {
    // Verificar se o plano existe e pertence ao usuário
    const plano = await prisma.empresasPlano.findFirst({
      where: {
        id: input.empresasPlanoId,
        usuarioId,
      },
      include: {
        PlanosEmpresariais: { select: { nome: true, valor: true } },
      },
    });

    if (!plano) {
      throw new Error('Plano não encontrado ou não pertence a este usuário');
    }

    // Verificar se está dentro do prazo de 7 dias
    const diasDesdeCompra = Math.floor(
      (Date.now() - plano.criadoEm.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diasDesdeCompra > DIAS_DIREITO_ARREPENDIMENTO) {
      throw new Error(
        `O prazo de ${DIAS_DIREITO_ARREPENDIMENTO} dias para solicitar reembolso já expirou. ` +
          `Sua compra foi realizada há ${diasDesdeCompra} dias.`,
      );
    }

    // Verificar se já existe requerimento de reembolso para este plano
    const requerimentoExistente = await prisma.requerimentos.findFirst({
      where: {
        usuarioId,
        empresasPlanoId: input.empresasPlanoId,
        tipo: RequerimentoTipo.REEMBOLSO,
        status: {
          notIn: [RequerimentoStatus.CANCELADO, RequerimentoStatus.RECUSADO],
        },
      },
    });

    if (requerimentoExistente) {
      throw new Error(
        `Já existe uma solicitação de reembolso em andamento para este plano (${requerimentoExistente.codigo})`,
      );
    }

    // Calcular valor do reembolso
    const valorReembolso = plano.valorFinal
      ? parseFloat(plano.valorFinal.toString())
      : parseFloat(plano.PlanosEmpresariais.valor);

    // Criar requerimento de reembolso
    return this.criar(usuarioId, {
      tipo: 'REEMBOLSO',
      titulo: `Solicitação de Reembolso - ${plano.PlanosEmpresariais.nome}`,
      descricao: input.motivo,
      empresasPlanoId: input.empresasPlanoId,
      valorReembolso,
      motivoReembolso: input.motivo,
    });
  },

  /**
   * Listar requerimentos do usuário
   */
  async listarPorUsuario(usuarioId: string, input: ListarRequerimentosInput) {
    const { page, pageSize, status, tipo, search, criadoDe, criadoAte } = input;
    const skip = (page - 1) * pageSize;

    const where: Prisma.RequerimentosWhereInput = {
      usuarioId,
    };

    if (status) {
      where.status = Array.isArray(status)
        ? { in: status as RequerimentoStatus[] }
        : (status as RequerimentoStatus);
    }

    if (tipo) {
      where.tipo = Array.isArray(tipo)
        ? { in: tipo as RequerimentoTipo[] }
        : (tipo as RequerimentoTipo);
    }

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (criadoDe || criadoAte) {
      where.criadoEm = {};
      if (criadoDe) where.criadoEm.gte = criadoDe;
      if (criadoAte) where.criadoEm.lte = criadoAte;
    }

    // Queries sequenciais para evitar saturar pool no Supabase Free
    const requerimentos = await prisma.requerimentos.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { criadoEm: 'desc' },
      include: {
        EmpresasPlano: {
          include: {
            PlanosEmpresariais: { select: { nome: true } },
          },
        },
        AtribuidoPara: {
          select: { id: true, nomeCompleto: true },
        },
      },
    });
    const total = await prisma.requerimentos.count({ where });

    return {
      data: requerimentos,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Listar todos os requerimentos (admin)
   */
  async listarAdmin(input: ListarRequerimentosInput) {
    const {
      page,
      pageSize,
      status,
      tipo,
      prioridade,
      usuarioId,
      atribuidoParaId,
      search,
      criadoDe,
      criadoAte,
    } = input;
    const skip = (page - 1) * pageSize;

    const where: Prisma.RequerimentosWhereInput = {};

    if (status) {
      where.status = Array.isArray(status)
        ? { in: status as RequerimentoStatus[] }
        : (status as RequerimentoStatus);
    }

    if (tipo) {
      where.tipo = Array.isArray(tipo)
        ? { in: tipo as RequerimentoTipo[] }
        : (tipo as RequerimentoTipo);
    }

    if (prioridade) {
      where.prioridade = prioridade as RequerimentoPrioridade;
    }

    if (usuarioId) {
      where.usuarioId = usuarioId;
    }

    if (atribuidoParaId) {
      where.atribuidoParaId = atribuidoParaId;
    }

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
        { Usuario: { nomeCompleto: { contains: search, mode: 'insensitive' } } },
        { Usuario: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (criadoDe || criadoAte) {
      where.criadoEm = {};
      if (criadoDe) where.criadoEm.gte = criadoDe;
      if (criadoAte) where.criadoEm.lte = criadoAte;
    }

    // Queries sequenciais para evitar saturar pool no Supabase Free
    const requerimentos = await prisma.requerimentos.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ prioridade: 'desc' }, { criadoEm: 'desc' }],
      include: {
        Usuario: {
          select: { id: true, nomeCompleto: true, email: true, tipoUsuario: true },
        },
        EmpresasPlano: {
          include: {
            PlanosEmpresariais: { select: { nome: true, valor: true } },
          },
        },
        AtribuidoPara: {
          select: { id: true, nomeCompleto: true },
        },
      },
    });
    const total = await prisma.requerimentos.count({ where });

    return {
      data: requerimentos,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Obter requerimento por ID
   */
  async obterPorId(id: string, usuarioId?: string) {
    const where: Prisma.RequerimentosWhereInput = { id };

    // Se usuarioId for fornecido, verificar se pertence ao usuário
    if (usuarioId) {
      where.usuarioId = usuarioId;
    }

    const requerimento = await prisma.requerimentos.findFirst({
      where,
      include: {
        Usuario: {
          select: { id: true, nomeCompleto: true, email: true, tipoUsuario: true, cnpj: true },
        },
        EmpresasPlano: {
          include: {
            PlanosEmpresariais: true,
          },
        },
        EmpresasVaga: {
          select: { id: true, titulo: true, codigo: true },
        },
        AtribuidoPara: {
          select: { id: true, nomeCompleto: true, email: true },
        },
        RequerimentosHistorico: {
          orderBy: { criadoEm: 'desc' },
          include: {
            Usuario: {
              select: { id: true, nomeCompleto: true },
            },
          },
        },
      },
    });

    if (!requerimento) {
      throw new Error('Requerimento não encontrado');
    }

    return requerimento;
  },

  /**
   * Atualizar requerimento (admin)
   */
  async atualizarAdmin(id: string, adminId: string, input: AtualizarRequerimentoAdminInput) {
    const requerimento = await prisma.requerimentos.findUnique({
      where: { id },
      select: { id: true, status: true, prioridade: true, atribuidoParaId: true },
    });

    if (!requerimento) {
      throw new Error('Requerimento não encontrado');
    }

    const data: Prisma.RequerimentosUpdateInput = {
      atualizadoEm: new Date(),
    };

    const historicoAcoes: string[] = [];

    if (input.status && input.status !== requerimento.status) {
      data.status = input.status as RequerimentoStatus;
      historicoAcoes.push(`Status alterado de ${requerimento.status} para ${input.status}`);

      if (input.status === 'RESOLVIDO') {
        data.resolvidoEm = new Date();
      }
    }

    if (input.prioridade && input.prioridade !== requerimento.prioridade) {
      data.prioridade = input.prioridade as RequerimentoPrioridade;
      historicoAcoes.push(`Prioridade alterada para ${input.prioridade}`);
    }

    if (
      input.atribuidoParaId !== undefined &&
      input.atribuidoParaId !== requerimento.atribuidoParaId
    ) {
      data.AtribuidoPara = input.atribuidoParaId
        ? { connect: { id: input.atribuidoParaId } }
        : { disconnect: true };
      historicoAcoes.push(
        input.atribuidoParaId ? `Atribuído para outro administrador` : `Atribuição removida`,
      );
    }

    if (input.respostaAdmin) {
      data.respostaAdmin = input.respostaAdmin;
      historicoAcoes.push('Resposta do administrador adicionada');
    }

    const atualizado = await prisma.requerimentos.update({
      where: { id },
      data,
      include: {
        Usuario: {
          select: { id: true, nomeCompleto: true, email: true },
        },
        AtribuidoPara: {
          select: { id: true, nomeCompleto: true },
        },
      },
    });

    // Registrar histórico
    if (historicoAcoes.length > 0) {
      await prisma.requerimentosHistorico.create({
        data: {
          requerimentoId: id,
          usuarioId: adminId,
          statusAnterior: requerimento.status as RequerimentoStatus,
          statusNovo:
            (input.status as RequerimentoStatus) || (requerimento.status as RequerimentoStatus),
          acao: 'ATUALIZADO',
          comentario: historicoAcoes.join('; '),
        },
      });
    }

    return atualizado;
  },

  /**
   * Adicionar comentário ao requerimento
   */
  async adicionarComentario(id: string, usuarioId: string, input: AdicionarComentarioInput) {
    const requerimento = await prisma.requerimentos.findUnique({
      where: { id },
      select: { id: true, usuarioId: true, status: true },
    });

    if (!requerimento) {
      throw new Error('Requerimento não encontrado');
    }

    // Verificar se o usuário pode comentar (dono ou admin)
    // A verificação de admin será feita no controller

    const historico = await prisma.requerimentosHistorico.create({
      data: {
        requerimentoId: id,
        usuarioId,
        acao: 'COMENTARIO',
        comentario: input.comentario,
        statusAnterior: requerimento.status as RequerimentoStatus,
        statusNovo: requerimento.status as RequerimentoStatus,
      },
      include: {
        Usuario: {
          select: { id: true, nomeCompleto: true },
        },
      },
    });

    // Atualizar data de atualização do requerimento
    await prisma.requerimentos.update({
      where: { id },
      data: { atualizadoEm: new Date() },
    });

    return historico;
  },

  /**
   * Cancelar requerimento (usuário)
   */
  async cancelar(id: string, usuarioId: string) {
    const requerimento = await prisma.requerimentos.findFirst({
      where: { id, usuarioId },
      select: { id: true, status: true },
    });

    if (!requerimento) {
      throw new Error('Requerimento não encontrado');
    }

    if (requerimento.status !== 'ABERTO' && requerimento.status !== 'AGUARDANDO_USUARIO') {
      throw new Error('Apenas requerimentos abertos ou aguardando resposta podem ser cancelados');
    }

    const atualizado = await prisma.requerimentos.update({
      where: { id },
      data: {
        status: RequerimentoStatus.CANCELADO,
        atualizadoEm: new Date(),
      },
    });

    // Registrar histórico
    await prisma.requerimentosHistorico.create({
      data: {
        requerimentoId: id,
        usuarioId,
        statusAnterior: requerimento.status as RequerimentoStatus,
        statusNovo: RequerimentoStatus.CANCELADO,
        acao: 'CANCELADO',
        comentario: 'Requerimento cancelado pelo usuário',
      },
    });

    return atualizado;
  },

  /**
   * Métricas de requerimentos (admin)
   */
  async metricas() {
    // Queries sequenciais para evitar saturar pool no Supabase Free
    const totalAbertos = await prisma.requerimentos.count({ where: { status: 'ABERTO' } });
    const totalEmAnalise = await prisma.requerimentos.count({ where: { status: 'EM_ANALISE' } });
    const totalAguardandoUsuario = await prisma.requerimentos.count({
      where: { status: 'AGUARDANDO_USUARIO' },
    });
    const totalResolvidos = await prisma.requerimentos.count({ where: { status: 'RESOLVIDO' } });
    const totalReembolsoPendente = await prisma.requerimentos.count({
      where: { tipo: 'REEMBOLSO', status: { in: ['ABERTO', 'EM_ANALISE'] } },
    });
    const porTipo = await prisma.requerimentos.groupBy({
      by: ['tipo'],
      _count: true,
      where: { status: { notIn: ['CANCELADO', 'RECUSADO'] } },
    });
    const porPrioridade = await prisma.requerimentos.groupBy({
      by: ['prioridade'],
      _count: true,
      where: { status: { notIn: ['RESOLVIDO', 'CANCELADO', 'RECUSADO'] } },
    });

    return {
      totais: {
        abertos: totalAbertos,
        emAnalise: totalEmAnalise,
        aguardandoUsuario: totalAguardandoUsuario,
        resolvidos: totalResolvidos,
        reembolsoPendente: totalReembolsoPendente,
      },
      porTipo: porTipo.reduce(
        (acc: Record<string, number>, item: { tipo: string; _count: number }) => {
          acc[item.tipo] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      porPrioridade: porPrioridade.reduce(
        (acc: Record<string, number>, item: { prioridade: string; _count: number }) => {
          acc[item.prioridade] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  },

  /**
   * Verificar se usuário pode solicitar reembolso para um plano
   */
  async verificarElegibilidadeReembolso(usuarioId: string, empresasPlanoId: string) {
    const plano = await prisma.empresasPlano.findFirst({
      where: { id: empresasPlanoId, usuarioId },
      include: {
        PlanosEmpresariais: { select: { nome: true, valor: true } },
      },
    });

    if (!plano) {
      return {
        elegivel: false,
        motivo: 'Plano não encontrado ou não pertence a este usuário',
      };
    }

    const diasDesdeCompra = Math.floor(
      (Date.now() - plano.criadoEm.getTime()) / (1000 * 60 * 60 * 24),
    );

    const diasRestantes = DIAS_DIREITO_ARREPENDIMENTO - diasDesdeCompra;

    if (diasDesdeCompra > DIAS_DIREITO_ARREPENDIMENTO) {
      return {
        elegivel: false,
        motivo: `O prazo de ${DIAS_DIREITO_ARREPENDIMENTO} dias para solicitar reembolso já expirou`,
        diasDesdeCompra,
        diasRestantes: 0,
      };
    }

    // Verificar se já existe solicitação
    const solicitacaoExistente = await prisma.requerimentos.findFirst({
      where: {
        usuarioId,
        empresasPlanoId,
        tipo: RequerimentoTipo.REEMBOLSO,
        status: { notIn: [RequerimentoStatus.CANCELADO, RequerimentoStatus.RECUSADO] },
      },
      select: { id: true, codigo: true, status: true },
    });

    if (solicitacaoExistente) {
      return {
        elegivel: false,
        motivo: `Já existe uma solicitação de reembolso em andamento`,
        solicitacaoExistente,
      };
    }

    return {
      elegivel: true,
      diasDesdeCompra,
      diasRestantes,
      valorReembolso: plano.valorFinal
        ? parseFloat(plano.valorFinal.toString())
        : parseFloat(plano.PlanosEmpresariais.valor),
      plano: {
        id: plano.id,
        nome: plano.PlanosEmpresariais.nome,
        dataCompra: plano.criadoEm,
      },
    };
  },
};
