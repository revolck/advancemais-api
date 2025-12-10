import { prisma } from '@/config/prisma';

interface VisaoGeralResponse {
  empresa: {
    id: string;
    nome: string;
    email: string;
    cnpj: string | null;
    telefone: string | null;
    cidade: string | null;
    estado: string | null;
  };
  plano: {
    id: string;
    nome: string;
    status: string;
    statusPagamento: string | null;
    inicio: Date | null;
    fim: Date | null;
    proximaCobranca: Date | null;
    graceUntil: Date | null;
    quantidadeVagas: number;
    vagasUtilizadas: number;
    vagasDisponiveis: number;
  } | null;
  resumoVagas: {
    total: number;
    publicadas: number;
    rascunho: number;
    encerradas: number;
    emAnalise: number;
  };
  candidaturasRecentes: Array<{
    id: string;
    candidatoNome: string;
    vagaTitulo: string;
    vagaCodigo: string;
    status: string;
    aplicadaEm: Date;
  }>;
  notificacoesRecentes: Array<{
    id: string;
    tipo: string;
    titulo: string;
    mensagem: string;
    status: string;
    criadoEm: Date;
  }>;
  estatisticas: {
    totalCandidaturas: number;
    candidaturasNovas: number;
    taxaVisualizacao: number;
  };
}

/**
 * Service para visão geral da empresa
 * Retorna dados essenciais de forma rápida e simples
 */
export const visaoGeralService = {
  async getVisaoGeral(empresaId: string): Promise<VisaoGeralResponse> {
    // Buscar dados da empresa
    const empresa = await prisma.usuarios.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        cnpj: true,
        UsuariosInformation: {
          select: {
            telefone: true,
          },
        },
        UsuariosEnderecos: {
          select: {
            cidade: true,
            estado: true,
          },
          take: 1,
        },
      },
    });

    if (!empresa) {
      throw new Error('Empresa não encontrada');
    }

    // Buscar plano ativo da empresa
    const planoAtivo = await prisma.empresasPlano.findFirst({
      where: { usuarioId: empresaId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        status: true,
        statusPagamento: true,
        inicio: true,
        fim: true,
        proximaCobranca: true,
        graceUntil: true,
        PlanosEmpresariais: {
          select: {
            id: true,
            nome: true,
            quantidadeVagas: true,
          },
        },
      },
    });

    // Contar vagas da empresa por status
    const vagasPorStatus = await prisma.empresasVagas.groupBy({
      by: ['status'],
      where: { usuarioId: empresaId },
      _count: { id: true },
    });

    const resumoVagas = {
      total: 0,
      publicadas: 0,
      rascunho: 0,
      encerradas: 0,
      emAnalise: 0,
    };

    vagasPorStatus.forEach((v) => {
      resumoVagas.total += v._count.id;
      switch (v.status) {
        case 'PUBLICADO':
          resumoVagas.publicadas += v._count.id;
          break;
        case 'RASCUNHO':
          resumoVagas.rascunho += v._count.id;
          break;
        case 'ENCERRADA':
          resumoVagas.encerradas += v._count.id;
          break;
        case 'EM_ANALISE':
          resumoVagas.emAnalise += v._count.id;
          break;
      }
    });

    // Buscar últimas 5 candidaturas
    const candidaturasRecentes = await prisma.empresasCandidatos.findMany({
      where: { empresaUsuarioId: empresaId },
      orderBy: { aplicadaEm: 'desc' },
      take: 5,
      include: {
        Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
          select: {
            nomeCompleto: true,
          },
        },
        EmpresasVagas: {
          select: {
            titulo: true,
            codigo: true,
          },
        },
        status_processo: {
          select: {
            nome: true,
          },
        },
      },
    });

    // Buscar últimas 5 notificações
    const notificacoesRecentes = await prisma.notificacoes.findMany({
      where: { usuarioId: empresaId },
      orderBy: { criadoEm: 'desc' },
      take: 5,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensagem: true,
        status: true,
        criadoEm: true,
      },
    });

    // Contar total de candidaturas
    const totalCandidaturas = await prisma.empresasCandidatos.count({
      where: { empresaUsuarioId: empresaId },
    });

    // Contar candidaturas novas (últimos 7 dias)
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const candidaturasNovas = await prisma.empresasCandidatos.count({
      where: {
        empresaUsuarioId: empresaId,
        aplicadaEm: { gte: seteDiasAtras },
      },
    });

    // Calcular vagas utilizadas (publicadas + em análise)
    const vagasUtilizadas = resumoVagas.publicadas + resumoVagas.emAnalise;
    const quantidadeVagasPlano = planoAtivo?.PlanosEmpresariais?.quantidadeVagas || 0;
    const vagasDisponiveis = Math.max(0, quantidadeVagasPlano - vagasUtilizadas);

    return {
      empresa: {
        id: empresa.id,
        nome: empresa.nomeCompleto,
        email: empresa.email,
        cnpj: empresa.cnpj,
        telefone: empresa.UsuariosInformation?.telefone || null,
        cidade: empresa.UsuariosEnderecos[0]?.cidade || null,
        estado: empresa.UsuariosEnderecos[0]?.estado || null,
      },
      plano: planoAtivo
        ? {
            id: planoAtivo.id,
            nome: planoAtivo.PlanosEmpresariais.nome,
            status: planoAtivo.status,
            statusPagamento: planoAtivo.statusPagamento,
            inicio: planoAtivo.inicio,
            fim: planoAtivo.fim,
            proximaCobranca: planoAtivo.proximaCobranca,
            graceUntil: planoAtivo.graceUntil,
            quantidadeVagas: quantidadeVagasPlano,
            vagasUtilizadas,
            vagasDisponiveis,
          }
        : null,
      resumoVagas,
      candidaturasRecentes: candidaturasRecentes.map((c) => ({
        id: c.id,
        candidatoNome: c.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.nomeCompleto,
        vagaTitulo: c.EmpresasVagas.titulo,
        vagaCodigo: c.EmpresasVagas.codigo,
        status: c.status_processo?.nome || 'Pendente',
        aplicadaEm: c.aplicadaEm,
      })),
      notificacoesRecentes: notificacoesRecentes.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        titulo: n.titulo,
        mensagem: n.mensagem,
        status: n.status,
        criadoEm: n.criadoEm,
      })),
      estatisticas: {
        totalCandidaturas,
        candidaturasNovas,
        taxaVisualizacao: 0, // Implementar quando houver tracking de visualizações
      },
    };
  },
};

